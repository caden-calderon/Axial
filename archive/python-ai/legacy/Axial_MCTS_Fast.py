"""
MCTS implementation using Numba-accelerated BitBoard operations.

Key optimizations:
- Uses FastBitBoard for all board operations
- Numba-compiled rollouts (no Python overhead in simulation)
- RAVE for faster convergence
- Immediate win/block detection
- Adaptive time budgeting
"""
import math
import random
import time
import numpy as np
from numba import njit

from Axial_BitBoard_Fast import (
    FastBitBoard, 
    check_win_optimized, 
    get_valid_moves_array,
    make_move_array,
    simulate_rollout,
    compute_directions_and_bounds
)


class MCTSNode:
    """Node in the MCTS tree."""
    
    RAVE_K = 500  # RAVE decay constant
    
    __slots__ = ['board', 'parent', 'action', 'prev_player', 'children', 
                 'visits', 'value', 'rave_visits', 'rave_value', 'untried_moves',
                 'D', 'R', 'C', 'win_length', 'directions', 'bounds', 'center_r', 'center_c']
    
    def __init__(self, fast_board: FastBitBoard, parent=None, action=None, prev_player=2):
        # Store board state as numpy array (lightweight copy)
        self.board = fast_board.board.copy()
        self.D = fast_board.D
        self.R = fast_board.R
        self.C = fast_board.C
        self.win_length = fast_board.win_length
        self.directions = fast_board.directions
        self.bounds = fast_board.bounds
        self.center_r = fast_board.center_r
        self.center_c = fast_board.center_c
        
        self.parent = parent
        self.action = action
        self.prev_player = prev_player
        
        self.children = {}
        self.visits = 0
        self.value = 0.0
        
        # RAVE statistics
        self.rave_visits = {}
        self.rave_value = {}
        
        # Get and prioritize moves (center-biased)
        self.untried_moves = self._prioritize_moves()
    
    def _prioritize_moves(self) -> list:
        """Order moves by distance to center (closest first)."""
        moves_arr = get_valid_moves_array(self.board, self.D, self.R, self.C)
        if moves_arr.shape[0] == 0:
            return []
        
        # Convert to list of tuples with distances
        moves_with_dist = []
        for i in range(moves_arr.shape[0]):
            r, c = int(moves_arr[i, 0]), int(moves_arr[i, 1])
            dist = abs(r - self.center_r) + abs(c - self.center_c)
            moves_with_dist.append((dist, r, c))
        
        # Sort by distance (ascending)
        moves_with_dist.sort()
        
        return [(r, c) for _, r, c in moves_with_dist]
    
    def is_fully_expanded(self) -> bool:
        return len(self.untried_moves) == 0
    
    def is_terminal(self) -> bool:
        """Check if this node is a terminal state (win or no moves)."""
        return (check_win_optimized(self.board, self.D, self.R, self.C, 
                                    self.win_length, self.directions, self.bounds) != 0 
                or len(self.untried_moves) == 0 and len(self.children) == 0)
    
    def get_winner(self) -> int:
        """Return winner (1, 2, or 0 for no winner/draw)."""
        return check_win_optimized(self.board, self.D, self.R, self.C,
                                   self.win_length, self.directions, self.bounds)
    
    def best_child(self, c_param: float = 1.414, use_rave: bool = True) -> 'MCTSNode':
        """Select best child using UCT with optional RAVE."""
        if self.visits == 0 or not self.children:
            return self
        
        def uct_rave_score(node):
            if node.visits == 0:
                return float('inf')
            
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
            
            # Beta blending factor
            beta = rave_n / (node.visits + rave_n + 4 * node.visits * rave_n / self.RAVE_K)
            
            return (1 - beta) * uct + beta * rave_q
        
        return max(self.children.values(), key=uct_rave_score)


class FastMCTS:
    """MCTS with Numba-accelerated operations."""
    
    def __init__(self, root_board: FastBitBoard, prev_player: int = 2):
        self.root = MCTSNode(root_board, prev_player=prev_player)
        self.total_simulations = 0
        
        # Store board config for creating new boards
        self._board_config = {
            'D': root_board.D,
            'R': root_board.R, 
            'C': root_board.C,
            'win_length': root_board.win_length,
            'directions': root_board.directions,
            'bounds': root_board.bounds,
            'center_r': root_board.center_r,
            'center_c': root_board.center_c
        }
    
    def search(self, max_time: float = None, simulations: int = None,
               adaptive: bool = True, early_exit_threshold: float = 0.85) -> tuple:
        """
        Run MCTS search.
        
        Args:
            max_time: Maximum seconds to search
            simulations: Number of simulations (if max_time not set)
            adaptive: Enable early exit when confident
            early_exit_threshold: Exit if top move has this fraction of visits
        
        Returns: Best move (r, c)
        """
        # Check for immediate win/block
        immediate = self._check_immediate_move()
        if immediate:
            self.total_simulations = 0
            return immediate
        
        if max_time is None and simulations is None:
            simulations = 1000
        
        start_time = time.time()
        sim_count = 0
        check_interval = 100
        
        while True:
            # Selection + Expansion
            node = self._select(self.root)
            
            # Simulation (Numba-accelerated)
            moves_made, result = self._simulate(node)
            
            # Backpropagation
            self._backpropagate(node, result, moves_made)
            
            sim_count += 1
            
            # Check termination
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
        
        if not self.root.children:
            moves = self.root.untried_moves
            return moves[0] if moves else None
        
        # Return most-visited child
        best = max(self.root.children.values(), key=lambda n: n.visits)
        return best.action
    
    def _check_immediate_move(self) -> tuple | None:
        """Check for immediate winning or blocking move."""
        board = self.root.board
        D, R, C = self.root.D, self.root.R, self.root.C
        win_length = self.root.win_length
        directions = self.root.directions
        bounds = self.root.bounds
        
        curr_player = 3 - self.root.prev_player
        opp_player = self.root.prev_player
        
        moves = get_valid_moves_array(board, D, R, C)
        
        # Check for wins
        for i in range(moves.shape[0]):
            r, c = int(moves[i, 0]), int(moves[i, 1])
            test_board = board.copy()
            make_move_array(test_board, r, c, curr_player, D, R)
            if check_win_optimized(test_board, D, R, C, win_length, directions, bounds) == curr_player:
                return (r, c)
        
        # Check for blocks
        for i in range(moves.shape[0]):
            r, c = int(moves[i, 0]), int(moves[i, 1])
            test_board = board.copy()
            make_move_array(test_board, r, c, opp_player, D, R)
            if check_win_optimized(test_board, D, R, C, win_length, directions, bounds) == opp_player:
                return (r, c)
        
        return None
    
    def _should_early_exit(self, threshold: float) -> bool:
        """Check if one move dominates."""
        if len(self.root.children) < 2:
            return False
        
        total = sum(c.visits for c in self.root.children.values())
        if total == 0:
            return False
        
        max_visits = max(c.visits for c in self.root.children.values())
        return (max_visits / total) >= threshold
    
    def _select(self, node: MCTSNode) -> MCTSNode:
        """Selection phase: traverse tree using UCT until expandable node."""
        while node.is_fully_expanded() and not node.is_terminal():
            if not node.children:
                break
            node = node.best_child()
        
        if node.is_terminal():
            return node
        
        if not node.untried_moves:
            return node
        
        return self._expand(node)
    
    def _expand(self, node: MCTSNode) -> MCTSNode:
        """Expansion phase: add a new child node."""
        action = node.untried_moves.pop(0)  # Pop highest priority (closest to center)
        
        # Create new board state
        new_board = node.board.copy()
        curr_player = 3 - node.prev_player
        make_move_array(new_board, action[0], action[1], curr_player, node.D, node.R)
        
        # Create child node with a FastBitBoard wrapper
        child_fb = FastBitBoard(dimensions=(node.D, node.R, node.C), win_length=node.win_length)
        child_fb.board = new_board
        child_fb.directions = node.directions
        child_fb.bounds = node.bounds
        child_fb.center_r = node.center_r
        child_fb.center_c = node.center_c
        
        child = MCTSNode(child_fb, parent=node, action=action, prev_player=curr_player)
        node.children[action] = child
        
        return child
    
    def _simulate(self, node: MCTSNode) -> tuple[list, int]:
        """
        Simulation phase using Numba-accelerated rollout.
        
        Returns: (moves_made, result)
        """
        # Use Numba rollout
        rng_state = np.array([random.randint(0, 2**31 - 1)], dtype=np.int64)
        
        result = simulate_rollout(
            node.board, node.prev_player,
            node.D, node.R, node.C, node.win_length,
            node.directions, node.bounds,
            node.center_r, node.center_c,
            rng_state
        )
        
        # For RAVE, we'd need to track moves made during rollout
        # The Numba rollout doesn't return this, so RAVE will be approximate
        # This is a tradeoff: speed vs RAVE accuracy
        moves_made = []  # Empty for now - RAVE will still work from tree moves
        
        return moves_made, result
    
    def _backpropagate(self, node: MCTSNode, result: int, moves_made: list) -> None:
        """Backpropagation phase: update statistics up the tree."""
        # Collect moves from tree path for RAVE
        p1_moves = set()
        p2_moves = set()
        
        # Walk up and collect actions
        temp = node
        while temp is not None:
            if temp.action is not None:
                if temp.prev_player == 1:
                    p1_moves.add(temp.action)
                else:
                    p2_moves.add(temp.action)
            temp = temp.parent
        
        # Update nodes
        while node is not None:
            node.visits += 1
            
            # Value update
            if result == 0:
                node.value += 0.5
            elif result == node.prev_player:
                node.value += 1.0
            
            # RAVE updates
            player_to_move = 3 - node.prev_player
            relevant_moves = p1_moves if player_to_move == 1 else p2_moves
            rave_result = 1.0 if result == player_to_move else (0.5 if result == 0 else 0.0)
            
            for action in relevant_moves:
                node.rave_visits[action] = node.rave_visits.get(action, 0) + 1
                node.rave_value[action] = node.rave_value.get(action, 0) + rave_result
            
            node = node.parent
    
    def advance_root(self, action: tuple) -> bool:
        """Advance root to child after move is made."""
        if action in self.root.children:
            self.root = self.root.children[action]
            self.root.parent = None
            return True
        return False
    
    def get_move_stats(self) -> dict:
        """Get statistics for all children of root."""
        stats = {}
        for action, child in self.root.children.items():
            win_rate = child.value / child.visits if child.visits > 0 else 0
            stats[action] = {
                'visits': child.visits,
                'win_rate': win_rate,
                'value': child.value
            }
        return stats


# ============================================================================
# ADAPTIVE TIME BUDGETING
# ============================================================================

def adaptive_time_budget(board: FastBitBoard, base_time: float = 10.0) -> float:
    """Calculate time budget based on game phase."""
    total_cells = board.D * board.R * board.C
    occupied = np.sum(board.board != 0)
    fill_ratio = occupied / total_cells
    
    moves_arr = get_valid_moves_array(board.board, board.D, board.R, board.C)
    valid_moves = moves_arr.shape[0]
    
    # Early game
    if fill_ratio < 0.15:
        return base_time * 0.4
    
    # Late game
    if fill_ratio > 0.6 or valid_moves <= 10:
        return base_time * 0.5
    
    # Mid game
    branch_factor = min(valid_moves / 20, 1.3)
    return base_time * branch_factor


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    import time
    
    print("=" * 60)
    print("FAST MCTS TEST")
    print("=" * 60)
    
    # Warm up JIT
    print("\nWarming up Numba JIT...")
    fb = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    fb.simulate_rollout(2, seed=12345)
    print("JIT ready.\n")
    
    # Test basic functionality
    fb = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    mcts = FastMCTS(fb)
    
    print("Running 2000 simulations...")
    start = time.perf_counter()
    move = mcts.search(simulations=2000)
    elapsed = time.perf_counter() - start
    
    print(f"Best move: {move}")
    print(f"Time: {elapsed:.3f}s")
    print(f"Sims/sec: {2000/elapsed:.0f}")
    
    # Test time-based search
    print("\nRunning 3-second search...")
    fb2 = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    mcts2 = FastMCTS(fb2)
    
    start = time.perf_counter()
    move2 = mcts2.search(max_time=3.0)
    elapsed2 = time.perf_counter() - start
    
    print(f"Best move: {move2}")
    print(f"Time: {elapsed2:.3f}s")
    print(f"Simulations: {mcts2.total_simulations}")
    print(f"Sims/sec: {mcts2.total_simulations/elapsed2:.0f}")
    
    # Show top moves
    print("\nTop moves:")
    stats = mcts2.get_move_stats()
    sorted_moves = sorted(stats.items(), key=lambda x: x[1]['visits'], reverse=True)[:5]
    for action, s in sorted_moves:
        print(f"  {action}: visits={s['visits']}, win_rate={s['win_rate']:.1%}")
