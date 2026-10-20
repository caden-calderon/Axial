import math
import random
import time
from Axial_BitBoard_Optimized import BitBoard

class MCTSNode:
    # Class-level RAVE decay constant (controls how quickly RAVE influence fades)
    RAVE_K = 500  # Higher = RAVE stays influential longer
    
    def __init__(self, state: BitBoard, parent=None, action=None, prev_player=2):
        self.state = state
        self.parent = parent
        self.action = action
        self.prev_player = prev_player
        
        self.children = {}
        self.visits = 0
        self.value = 0.0
        
        # RAVE statistics: track how good each move is across ALL simulations through this node
        self.rave_visits = {}  # action -> visit count
        self.rave_value = {}   # action -> total value
        
        # Prioritized move ordering (center-biased, threats first)
        self.untried_moves = self._prioritize_moves(state.get_valid_moves(), state)
    
    def _prioritize_moves(self, moves: list, state: BitBoard) -> list:
        """
        Order moves with light prioritization.
        Heavy win/block checks are deferred - the first few expansions will find wins anyway.
        """
        if not moves or len(moves) <= 1:
            return moves
        
        center_r, center_c = state.R / 2, state.C / 2
        
        # Just sort by center distance - fast and effective
        return sorted(moves, key=lambda m: abs(m[0] - center_r) + abs(m[1] - center_c))

    def is_fully_expanded(self) -> bool:
        return len(self.untried_moves) == 0

    def best_child(self, c_param: float = 1.414, use_rave: bool = True) -> 'MCTSNode':
        """UCT with optional RAVE blending."""
        if self.visits == 0:
            return self
        
        def uct_rave(node):
            if node.visits == 0:
                return float('inf')  # Prioritize unvisited
            
            # Standard UCT
            exploit = node.value / node.visits
            explore = c_param * math.sqrt(math.log(self.visits) / node.visits)
            uct = exploit + explore
            
            if not use_rave or node.action not in self.rave_visits:
                return uct
            
            # RAVE component
            rave_n = self.rave_visits.get(node.action, 0)
            if rave_n == 0:
                return uct
            
            rave_q = self.rave_value.get(node.action, 0) / rave_n
            
            # Beta: how much to weight RAVE vs UCT (decays as visits increase)
            beta = rave_n / (node.visits + rave_n + 4 * node.visits * rave_n / self.RAVE_K)
            
            return (1 - beta) * uct + beta * rave_q
        
        return max(self.children.values(), key=uct_rave)


class MCTS:
    def __init__(self, root_state: BitBoard, prev_player: int = 2):
        self.root = MCTSNode(root_state, prev_player=prev_player)
        self.total_simulations = 0
    
    def search(self, max_time: float = None, simulations: int = None, 
               adaptive: bool = True, early_exit_threshold: float = 0.85) -> tuple:
        """
        Flexible search with time OR simulation budget.
        
        Args:
            max_time: Maximum seconds to search (overrides simulations if set)
            simulations: Number of simulations (used if max_time is None)
            adaptive: If True, may exit early when confident
            early_exit_threshold: Exit if top move has this fraction of visits
        
        Returns: Best action (r, c)
        """
        # IMMEDIATE WIN/BLOCK DETECTION - don't waste time if obvious move exists
        immediate = self._check_immediate_move()
        if immediate:
            self.total_simulations = 0
            return immediate
        
        if max_time is None and simulations is None:
            simulations = 1000  # Default fallback
        
        start_time = time.time()
        sim_count = 0
        check_interval = 100  # Check early exit every N sims
        
        while True:
            # Run a simulation
            node = self._select(self.root)
            moves_made, result = self._simulate(node.state, node.prev_player)
            self._backpropagate(node, result, moves_made)
            sim_count += 1
            
            # Check termination conditions
            if max_time is not None:
                if time.time() - start_time >= max_time:
                    break
            elif sim_count >= simulations:
                break
            
            # Early exit check
            if adaptive and sim_count % check_interval == 0 and sim_count > 500:
                if self._should_early_exit(early_exit_threshold):
                    break
        
        self.total_simulations = sim_count
        
        # Return most-visited child (robust choice)
        if not self.root.children:
            # No children expanded - return first valid move
            valid = self.root.state.get_valid_moves()
            return valid[0] if valid else None
        
        best = max(self.root.children.values(), key=lambda n: n.visits)
        return best.action
    
    def _check_immediate_move(self) -> tuple | None:
        """Check for immediate winning or blocking moves. Returns move or None."""
        state = self.root.state
        curr_player = 3 - self.root.prev_player
        opp_player = self.root.prev_player
        moves = state.get_valid_moves()
        
        # Check wins first
        for move in moves:
            test = state.copy()
            test.make_move(move[0], move[1], curr_player)
            if test.check_win() == curr_player:
                return move
        
        # Check blocks
        for move in moves:
            test = state.copy()
            test.make_move(move[0], move[1], opp_player)
            if test.check_win() == opp_player:
                return move
        
        return None
    
    def _should_early_exit(self, threshold: float) -> bool:
        """Check if one move is dominant enough to stop searching."""
        if len(self.root.children) < 2:
            return False
        
        total_child_visits = sum(c.visits for c in self.root.children.values())
        if total_child_visits == 0:
            return False
        
        max_visits = max(c.visits for c in self.root.children.values())
        return (max_visits / total_child_visits) >= threshold

    def _select(self, node: MCTSNode) -> MCTSNode:
        """Selection + Expansion phases."""
        while node.is_fully_expanded() and node.state.check_win() == 0:
            if not node.children:
                break  # Terminal with no valid moves (draw)
            node = node.best_child()
        
        if node.state.check_win() != 0:
            return node
        
        if not node.untried_moves:
            return node  # No moves left (draw state)
        
        return self._expand(node)

    def _expand(self, node: MCTSNode) -> MCTSNode:
        """Expand next prioritized move."""
        action = node.untried_moves.pop(0)  # Pop from front (highest priority)
        new_state = node.state.copy()
        curr_player = 3 - node.prev_player
        new_state.make_move(action[0], action[1], curr_player)
        child = MCTSNode(state=new_state, parent=node, action=action, prev_player=curr_player)
        node.children[action] = child
        return child

    def _simulate(self, state: BitBoard, prev_player: int) -> tuple[list, int]:
        """
        Smart rollout with win/block detection.
        Returns: (list of moves made, result)
        """
        curr_state = state.copy()
        curr_player = prev_player
        moves_made = []  # Track for RAVE
        
        while curr_state.check_win() == 0:
            moves = curr_state.get_valid_moves()
            if not moves:
                break
            
            curr_player = 3 - curr_player
            action = self._smart_rollout_move(curr_state, moves, curr_player)
            moves_made.append((action, curr_player))
            curr_state.make_move(action[0], action[1], curr_player)
        
        return moves_made, curr_state.check_win()
    
    def _smart_rollout_move(self, state: BitBoard, moves: list, player: int) -> tuple:
        """
        Pick a move during rollout with probabilistic smart checks.
        50% of the time: do smart (win/block) checks on 4 center moves
        50% of the time: just pick center-biased random (fast)
        """
        # Fast path: 50% of the time, just pick center-biased random
        if random.random() < 0.5:
            return self._center_biased_choice(moves, state)
        
        opp = 3 - player
        
        # Smart path: check only 4 closest-to-center moves for win/block
        center_r, center_c = state.R / 2, state.C / 2
        
        # Quick partial sort - get 4 best candidates
        if len(moves) > 4:
            # Compute distances once
            with_dist = [(abs(m[0] - center_r) + abs(m[1] - center_c), m) for m in moves]
            with_dist.sort(key=lambda x: x[0])
            check_moves = [m for _, m in with_dist[:4]]
        else:
            check_moves = moves
        
        # Check for immediate win
        for move in check_moves:
            test = state.copy()
            test.make_move(move[0], move[1], player)
            if test.check_win() == player:
                return move
        
        # Check for block
        for move in check_moves:
            test = state.copy()
            test.make_move(move[0], move[1], opp)
            if test.check_win() == opp:
                return move
        
        return self._center_biased_choice(moves, state)
    
    def _center_biased_choice(self, moves: list, state: BitBoard) -> tuple:
        """Fast center-biased random choice."""
        if len(moves) == 1:
            return moves[0]
        
        center_r, center_c = state.R / 2, state.C / 2
        
        # 60% chance to filter to center region first
        if random.random() < 0.6:
            center_moves = [m for m in moves 
                          if abs(m[0] - center_r) <= state.R / 3 
                          and abs(m[1] - center_c) <= state.C / 3]
            if center_moves:
                return random.choice(center_moves)
        
        return random.choice(moves)

    def _backpropagate(self, node: MCTSNode, result: int, moves_made: list) -> None:
        """Backprop with RAVE updates."""
        # Collect moves by player for RAVE
        p1_moves = {m[0] for m in moves_made if m[1] == 1}
        p2_moves = {m[0] for m in moves_made if m[1] == 2}
        
        while node is not None:
            node.visits += 1
            
            # Standard value update
            if result == 0:
                node.value += 0.5
            elif result == node.prev_player:
                node.value += 1.0
            # else: loss, add 0
            
            # RAVE updates: update stats for moves made by the player-to-move at this node
            player_to_move = 3 - node.prev_player
            relevant_moves = p1_moves if player_to_move == 1 else p2_moves
            
            rave_result = 1.0 if result == player_to_move else (0.5 if result == 0 else 0.0)
            
            for action in relevant_moves:
                node.rave_visits[action] = node.rave_visits.get(action, 0) + 1
                node.rave_value[action] = node.rave_value.get(action, 0) + rave_result
            
            node = node.parent
    
    def advance_root(self, action: tuple) -> bool:
        """Move root to child after a move is made. Returns True if successful."""
        if action in self.root.children:
            self.root = self.root.children[action]
            self.root.parent = None  # Allow GC of old tree
            return True
        return False
    
    def get_move_stats(self) -> dict:
        """Return statistics about current root's children for debugging/display."""
        stats = {}
        for action, child in self.root.children.items():
            win_rate = child.value / child.visits if child.visits > 0 else 0
            stats[action] = {
                'visits': child.visits,
                'win_rate': win_rate,
                'value': child.value
            }
        return stats


def adaptive_simulation_budget(board: BitBoard, base_sims: int = 5000) -> int:
    """
    Calculate simulation budget based on game phase.
    Early game: fewer sims (less critical)
    Mid game: more sims (critical decisions)
    Late game: fewer sims (often forced)
    """
    total_cells = board.D * board.R * board.C
    occupied = bin(board.player1 | board.player2).count('1')
    fill_ratio = occupied / total_cells
    
    valid_moves = len(board.get_valid_moves())
    
    # Early game (< 15% full): reduce sims
    if fill_ratio < 0.15:
        return int(base_sims * 0.5)
    
    # Late game (> 60% full or few moves): reduce sims
    if fill_ratio > 0.6 or valid_moves <= 10:
        return int(base_sims * 0.6)
    
    # Mid game: full budget, scale slightly by branching factor
    branch_factor = min(valid_moves / 20, 1.5)  # Cap at 1.5x
    return int(base_sims * branch_factor)


def adaptive_time_budget(board: BitBoard, base_time: float = 10.0) -> float:
    """
    Calculate time budget based on game phase.
    Similar logic to simulation budget but returns seconds.
    """
    total_cells = board.D * board.R * board.C
    occupied = bin(board.player1 | board.player2).count('1')
    fill_ratio = occupied / total_cells
    
    valid_moves = len(board.get_valid_moves())
    
    if fill_ratio < 0.15:
        return base_time * 0.4
    
    if fill_ratio > 0.6 or valid_moves <= 10:
        return base_time * 0.5
    
    branch_factor = min(valid_moves / 20, 1.3)
    return base_time * branch_factor


if __name__ == "__main__":
    print("--- Testing Optimized MCTS ---")
    
    # Basic functionality test
    bb = BitBoard(dimensions=(6, 6, 6), win_length=4)
    mcts = MCTS(bb)
    
    print("\nRunning 2000 simulations...")
    start = time.time()
    move = mcts.search(simulations=2000)
    elapsed = time.time() - start
    print(f"Best move: {move}")
    print(f"Time: {elapsed:.2f}s")
    print(f"Sims/sec: {2000/elapsed:.0f}")
    
    print("\nMove statistics:")
    stats = mcts.get_move_stats()
    sorted_stats = sorted(stats.items(), key=lambda x: x[1]['visits'], reverse=True)[:5]
    for action, s in sorted_stats:
        print(f"  {action}: visits={s['visits']}, win_rate={s['win_rate']:.2%}")
    
    # Test time-based search
    print("\nRunning 5-second search...")
    bb2 = BitBoard(dimensions=(6, 6, 6), win_length=4)
    mcts2 = MCTS(bb2)
    start = time.time()
    move2 = mcts2.search(max_time=5.0)
    elapsed2 = time.time() - start
    print(f"Best move: {move2}")
    print(f"Actual time: {elapsed2:.2f}s")
    print(f"Simulations run: {mcts2.total_simulations}")
    
    # Test adaptive budget
    print("\nAdaptive budgets for different game states:")
    print(f"  Empty board: {adaptive_simulation_budget(bb2)} sims, {adaptive_time_budget(bb2):.1f}s")
    
    # Simulate mid-game
    for i in range(30):
        moves = bb2.get_valid_moves()
        if moves:
            m = random.choice(moves)
            bb2.make_move(m[0], m[1], (i % 2) + 1)
    print(f"  Mid-game (~30 moves): {adaptive_simulation_budget(bb2)} sims, {adaptive_time_budget(bb2):.1f}s")
