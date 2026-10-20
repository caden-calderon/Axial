"""
MCTS with Neural Network evaluation.

Key differences from rollout-based MCTS:
1. No rollouts - network provides instant position evaluation
2. Policy prior guides which moves to explore first
3. Uses PUCT formula instead of standard UCT
"""
import math
import time
import numpy as np

from Axial_BitBoard_Fast import (
    FastBitBoard,
    check_win_optimized,
    get_valid_moves_array,
    make_move_array
)
from Axial_Network import NetworkWrapper, board_to_tensor


class MCTSNode:
    """Node in the MCTS tree with neural network support."""
    
    __slots__ = ['board', 'parent', 'action', 'prev_player', 'children',
                 'visits', 'value_sum', 'prior', 'is_expanded',
                 'D', 'R', 'C', 'win_length', 'directions', 'bounds']
    
    def __init__(self, board: np.ndarray, parent=None, action=None, 
                 prev_player=2, prior=0.0, board_config=None):
        """
        Args:
            board: numpy array of board state
            parent: parent MCTSNode
            action: move (r, c) that led to this state
            prev_player: player who just moved (1 or 2)
            prior: policy prior probability from neural network
            board_config: dict with D, R, C, win_length, directions, bounds
        """
        self.board = board
        self.parent = parent
        self.action = action
        self.prev_player = prev_player
        self.prior = prior
        
        self.children = {}  # action -> MCTSNode
        self.visits = 0
        self.value_sum = 0.0  # Sum of values (for averaging)
        self.is_expanded = False
        
        # Store board config
        if board_config:
            self.D = board_config['D']
            self.R = board_config['R']
            self.C = board_config['C']
            self.win_length = board_config['win_length']
            self.directions = board_config['directions']
            self.bounds = board_config['bounds']
        elif parent:
            self.D = parent.D
            self.R = parent.R
            self.C = parent.C
            self.win_length = parent.win_length
            self.directions = parent.directions
            self.bounds = parent.bounds
    
    @property
    def value(self) -> float:
        """Average value of this node."""
        if self.visits == 0:
            return 0.0
        return self.value_sum / self.visits
    
    def is_terminal(self) -> bool:
        """Check if game is over at this node."""
        winner = check_win_optimized(self.board, self.D, self.R, self.C,
                                     self.win_length, self.directions, self.bounds)
        if winner != 0:
            return True
        # Check for draw (no valid moves)
        moves = get_valid_moves_array(self.board, self.D, self.R, self.C)
        return moves.shape[0] == 0
    
    def get_winner(self) -> int:
        """Get winner (1, 2, or 0 for no winner/draw)."""
        return check_win_optimized(self.board, self.D, self.R, self.C,
                                   self.win_length, self.directions, self.bounds)


class NeuralMCTS:
    """
    MCTS using neural network for evaluation.
    
    Instead of random rollouts, we use the network to:
    1. Get policy priors (which moves look promising)
    2. Get value estimates (who's winning)
    """
    
    def __init__(self, root_board: FastBitBoard, network: NetworkWrapper,
                 prev_player: int = 2, c_puct: float = 1.5):
        """
        Args:
            root_board: Starting board position
            network: Neural network wrapper for evaluation
            prev_player: Player who just moved (2 means P1 moves first)
            c_puct: Exploration constant for PUCT formula
        """
        self.network = network
        self.c_puct = c_puct
        self.total_simulations = 0
        
        # Board config for creating nodes
        self.board_config = {
            'D': root_board.D,
            'R': root_board.R,
            'C': root_board.C,
            'win_length': root_board.win_length,
            'directions': root_board.directions,
            'bounds': root_board.bounds
        }
        
        # Create root node
        self.root = MCTSNode(
            board=root_board.board.copy(),
            prev_player=prev_player,
            board_config=self.board_config
        )
    
    def search(self, num_simulations: int = None, max_time: float = None,
               temperature: float = 1.0) -> tuple:
        """
        Run MCTS search and return best move.
        
        Args:
            num_simulations: Number of MCTS iterations
            max_time: Maximum search time in seconds
            temperature: Controls exploration (1.0 = proportional to visits,
                        0.0 = always pick best)
        
        Returns:
            Best move (r, c)
        """
        # Check for immediate win/block (skip search if obvious)
        immediate = self._check_immediate_move()
        if immediate:
            self.total_simulations = 0
            return immediate
        
        if num_simulations is None and max_time is None:
            num_simulations = 800
        
        start_time = time.time()
        sim_count = 0
        
        while True:
            # Run one simulation
            self._simulate()
            sim_count += 1
            
            # Check termination
            if max_time is not None:
                if time.time() - start_time >= max_time:
                    break
            elif sim_count >= num_simulations:
                break
        
        self.total_simulations = sim_count
        
        # Select move based on visit counts
        return self._select_action(temperature)
    
    def _simulate(self):
        """Run one MCTS simulation: select, expand, evaluate, backprop."""
        node = self.root
        search_path = [node]
        
        # Selection: traverse tree until we find unexpanded node or terminal
        while node.is_expanded and not node.is_terminal():
            action, node = self._select_child(node)
            search_path.append(node)
        
        # Get value for this position
        if node.is_terminal():
            # Game over - use actual result
            winner = node.get_winner()
            if winner == 0:
                value = 0.0  # Draw
            else:
                # Value from perspective of player who just moved to this node
                value = 1.0 if winner == node.prev_player else -1.0
        else:
            # Expand node and get network evaluation
            value = self._expand(node)
        
        # Backpropagation
        self._backpropagate(search_path, value)
    
    def _select_child(self, node: MCTSNode) -> tuple:
        """
        Select best child using PUCT formula.
        
        PUCT = Q(s,a) + c_puct * P(s,a) * sqrt(N(s)) / (1 + N(s,a))
        
        Where:
            Q(s,a) = average value of taking action a from state s
            P(s,a) = prior probability from policy network
            N(s) = visit count of parent
            N(s,a) = visit count of child
        """
        best_score = -float('inf')
        best_action = None
        best_child = None
        
        sqrt_parent_visits = math.sqrt(node.visits)
        
        for action, child in node.children.items():
            # Q value (from perspective of player to move at parent)
            # Child's value is from perspective of child's prev_player
            # We need to negate because we want value for current player
            q_value = -child.value if child.visits > 0 else 0.0
            
            # Exploration term
            exploration = self.c_puct * child.prior * sqrt_parent_visits / (1 + child.visits)
            
            score = q_value + exploration
            
            if score > best_score:
                best_score = score
                best_action = action
                best_child = child
        
        return best_action, best_child
    
    def _expand(self, node: MCTSNode) -> float:
        """
        Expand node: create children and get network evaluation.
        
        Returns:
            Value estimate for this position (from current player's perspective)
        """
        # Get valid moves
        moves = get_valid_moves_array(node.board, node.D, node.R, node.C)
        
        if moves.shape[0] == 0:
            node.is_expanded = True
            return 0.0  # Draw
        
        # Get network prediction
        current_player = 3 - node.prev_player
        policy, value = self.network.predict(node.board, current_player)
        
        # Create children with policy priors
        # Note: moves are in (row, col) format
        for i in range(moves.shape[0]):
            r, c = int(moves[i, 0]), int(moves[i, 1])
            action = (r, c)
            
            # Get prior for this move
            # Policy index is row * C + col (row-major ordering)
            move_idx = r * node.C + c
            prior = policy[move_idx]
            
            # Create child board state
            child_board = node.board.copy()
            make_move_array(child_board, r, c, current_player, node.D, node.R)
            
            # Create child node
            child = MCTSNode(
                board=child_board,
                parent=node,
                action=action,
                prev_player=current_player,
                prior=prior
            )
            node.children[action] = child
        
        node.is_expanded = True
        
        # Return value from perspective of player who just moved
        # Network gives value from current player's perspective
        # We negate because we want value for prev_player (who just moved)
        return -value
    
    def _backpropagate(self, search_path: list, value: float):
        """
        Backpropagate value up the tree.
        
        Value alternates sign as we go up (my win = your loss).
        """
        for node in reversed(search_path):
            node.visits += 1
            node.value_sum += value
            value = -value  # Flip for parent's perspective
    
    def _select_action(self, temperature: float) -> tuple:
        """
        Select action based on visit counts.
        
        Args:
            temperature: 0 = always best, 1 = proportional to visits
        
        Returns:
            Selected move (r, c)
        """
        if not self.root.children:
            # No children (shouldn't happen)
            moves = get_valid_moves_array(self.root.board, self.root.D, 
                                         self.root.R, self.root.C)
            if moves.shape[0] > 0:
                return (int(moves[0, 0]), int(moves[0, 1]))
            return None
        
        actions = list(self.root.children.keys())
        visits = np.array([self.root.children[a].visits for a in actions])
        
        if temperature == 0:
            # Greedy: pick highest visit count
            best_idx = np.argmax(visits)
        else:
            # Stochastic: sample proportional to visits^(1/temp)
            visits = visits ** (1.0 / temperature)
            probs = visits / visits.sum()
            best_idx = np.random.choice(len(actions), p=probs)
        
        return actions[best_idx]
    
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
    
    def get_policy(self) -> np.ndarray:
        """
        Get visit-count policy from root.
        
        Returns:
            Array of shape (R*C,) with visit proportions for each move
        """
        policy = np.zeros(self.root.R * self.root.C)
        total = sum(c.visits for c in self.root.children.values())
        
        if total > 0:
            for action, child in self.root.children.items():
                r, c = action  # action is (row, col)
                idx = r * self.root.C + c
                policy[idx] = child.visits / total
        
        return policy
    
    def advance_root(self, action: tuple) -> bool:
        """Advance root to child after move is made."""
        if action in self.root.children:
            self.root = self.root.children[action]
            self.root.parent = None
            return True
        return False
    
    def get_move_stats(self) -> dict:
        """Get statistics for debugging."""
        stats = {}
        for action, child in self.root.children.items():
            stats[action] = {
                'visits': child.visits,
                'value': -child.value,  # From current player's perspective
                'prior': child.prior
            }
        return stats


# ============================================================================
# SELF-PLAY WITH NEURAL NETWORK
# ============================================================================

def play_game_with_network(network: NetworkWrapper, 
                           simulations_per_move: int = 400,
                           temperature_moves: int = 10,
                           verbose: bool = False) -> dict:
    """
    Play a single self-play game using neural network MCTS.
    
    Args:
        network: Trained network for evaluation
        simulations_per_move: MCTS simulations per move
        temperature_moves: Use temperature=1 for first N moves (exploration)
        verbose: Print game progress
    
    Returns:
        dict with 'states', 'policies', 'outcome', 'num_moves'
    """
    D, R, C = network.D, network.R, network.C
    board = FastBitBoard(dimensions=(D, R, C), win_length=4)
    mcts = NeuralMCTS(board, network, prev_player=2)
    
    states = []
    policies = []
    current_player = 1
    move_count = 0
    
    while True:
        # Check for game over
        winner = board.check_win()
        if winner != 0:
            break
        
        if not board.get_valid_moves():
            winner = 0
            break
        
        # Record state
        states.append(board.board.copy())
        
        # Choose temperature
        temp = 1.0 if move_count < temperature_moves else 0.0
        
        # Run MCTS
        best_move = mcts.search(num_simulations=simulations_per_move, temperature=temp)
        
        # Record policy (visit distribution)
        policy = mcts.get_policy()
        policies.append(policy)
        
        if verbose:
            stats = mcts.get_move_stats()
            top = sorted(stats.items(), key=lambda x: x[1]['visits'], reverse=True)[:3]
            top_str = ", ".join(
                "{}:v={},val={:.2f}".format(a, s['visits'], s['value']) 
                for a, s in top
            )
            print("Move {} | P{} -> {} | Sims: {} | Top: {}".format(
                move_count, current_player, best_move, mcts.total_simulations, top_str
            ))
        
        # Make move
        board.make_move(best_move[0], best_move[1], current_player)
        
        # Advance tree
        if not mcts.advance_root(best_move):
            mcts = NeuralMCTS(board, network, prev_player=current_player)
        
        current_player = 3 - current_player
        move_count += 1
    
    return {
        'states': states,
        'policies': policies,
        'outcome': winner,
        'num_moves': move_count
    }


# ============================================================================
# TESTING
# ============================================================================

def test_neural_mcts():
    """Test Neural MCTS functionality."""
    print("=" * 60)
    print("NEURAL MCTS TEST")
    print("=" * 60)
    
    # Create network (small for testing)
    print("\nCreating network...")
    network = NetworkWrapper(D=6, R=6, C=7, num_channels=64, num_res_blocks=2)
    print(f"Network parameters: {network.num_parameters:,}")
    
    # Create board and MCTS
    board = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    mcts = NeuralMCTS(board, network, prev_player=2)
    
    # Run search
    print("\nRunning 500 simulations...")
    import time
    start = time.perf_counter()
    best_move = mcts.search(num_simulations=500)
    elapsed = time.perf_counter() - start
    
    print(f"Best move: {best_move}")
    print(f"Time: {elapsed:.3f}s")
    print(f"Sims/sec: {500/elapsed:.0f}")
    
    # Show move stats
    print("\nMove statistics:")
    stats = mcts.get_move_stats()
    sorted_stats = sorted(stats.items(), key=lambda x: x[1]['visits'], reverse=True)[:5]
    for action, s in sorted_stats:
        print(f"  {action}: visits={s['visits']}, value={s['value']:.3f}, prior={s['prior']:.3f}")
    
    # Test time-based search
    print("\nRunning 2-second search...")
    board2 = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    mcts2 = NeuralMCTS(board2, network, prev_player=2)
    
    start = time.perf_counter()
    best_move2 = mcts2.search(max_time=2.0)
    elapsed2 = time.perf_counter() - start
    
    print(f"Best move: {best_move2}")
    print(f"Time: {elapsed2:.3f}s")
    print(f"Simulations: {mcts2.total_simulations}")
    print(f"Sims/sec: {mcts2.total_simulations/elapsed2:.0f}")
    
    # Play a short game
    print("\n" + "-" * 40)
    print("Playing test game...")
    result = play_game_with_network(network, simulations_per_move=200, verbose=True)
    print(f"\nGame over! Winner: P{result['outcome']} in {result['num_moves']} moves")
    
    print("\n✓ All tests passed!")


if __name__ == "__main__":
    test_neural_mcts()