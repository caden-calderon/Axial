"""
Monte Carlo Tree Search with Threat Detection.

Features:
1. Threat-aware immediate move detection
   - Block opponent's three-in-a-rows
   - Detect double-threat (fork) positions

2. Smart move ordering
   - Score moves by threat potential
   - Prioritize forcing moves and blocks

3. Improved rollouts
   - Play winning moves
   - Block opponent wins
   - Create and extend threats

4. RAVE for faster convergence
   - Share move statistics across tree
"""
import math
import random
import time
import numpy as np

from bitboard import (
    BitBoard,
    check_win_optimized,
    get_valid_moves_array,
    make_move_array,
    simulate_rollout_smart,
    find_threats,
    count_threats_by_type,
    find_winning_moves,
    find_forcing_moves,
    score_move
)


class MCTSNode:
    """Node in the MCTS tree with threat awareness."""

    RAVE_K = 500  # RAVE decay constant

    __slots__ = ['board', 'parent', 'action', 'prev_player', 'children',
                 'visits', 'value', 'rave_visits', 'rave_value', 'untried_moves',
                 'D', 'R', 'C', 'win_length', 'directions', 'bounds',
                 'center_r', 'center_c', 'move_scores']

    def __init__(self, board: BitBoard, parent=None, action=None, prev_player=2):
        self.board = board.board.copy()
        self.D = board.D
        self.R = board.R
        self.C = board.C
        self.win_length = board.win_length
        self.directions = board.directions
        self.bounds = board.bounds
        self.center_r = board.center_r
        self.center_c = board.center_c

        self.parent = parent
        self.action = action
        self.prev_player = prev_player

        self.children = {}
        self.visits = 0
        self.value = 0.0

        self.rave_visits = {}
        self.rave_value = {}

        self.untried_moves, self.move_scores = self._prioritize_moves_by_threat()

    def _prioritize_moves_by_threat(self) -> tuple:
        """Order moves by threat potential (best first)."""
        moves_arr = get_valid_moves_array(self.board, self.D, self.R, self.C)
        if moves_arr.shape[0] == 0:
            return [], {}

        curr_player = 3 - self.prev_player

        moves_with_scores = []
        scores_dict = {}

        for i in range(moves_arr.shape[0]):
            r, c = int(moves_arr[i, 0]), int(moves_arr[i, 1])

            move_score = score_move(
                self.board, r, c, curr_player,
                self.D, self.R, self.C, self.win_length,
                self.directions, self.bounds,
                self.center_r, self.center_c
            )

            moves_with_scores.append((move_score, r, c))
            scores_dict[(r, c)] = move_score

        moves_with_scores.sort(reverse=True)

        return [(r, c) for _, r, c in moves_with_scores], scores_dict

    def is_fully_expanded(self) -> bool:
        return len(self.untried_moves) == 0

    def is_terminal(self) -> bool:
        """Check if this node is a terminal state."""
        return (check_win_optimized(self.board, self.D, self.R, self.C,
                                    self.win_length, self.directions, self.bounds) != 0
                or len(self.untried_moves) == 0 and len(self.children) == 0)

    def get_winner(self) -> int:
        """Return winner (1, 2, or 0)."""
        return check_win_optimized(self.board, self.D, self.R, self.C,
                                   self.win_length, self.directions, self.bounds)

    def best_child(self, c_param: float = 1.414, use_rave: bool = True) -> 'MCTSNode':
        """Select best child using UCT with RAVE."""
        if self.visits == 0 or not self.children:
            return self

        def uct_rave_score(node):
            if node.visits == 0:
                return float('inf')

            exploit = node.value / node.visits
            explore = c_param * math.sqrt(math.log(self.visits) / node.visits)
            uct = exploit + explore

            if not use_rave or node.action not in self.rave_visits:
                return uct

            rave_n = self.rave_visits.get(node.action, 0)
            if rave_n == 0:
                return uct

            rave_q = self.rave_value.get(node.action, 0) / rave_n

            beta = rave_n / (node.visits + rave_n + 4 * node.visits * rave_n / self.RAVE_K)

            return (1 - beta) * uct + beta * rave_q

        return max(self.children.values(), key=uct_rave_score)


class MCTS:
    """Monte Carlo Tree Search with threat detection."""

    def __init__(self, root_board: BitBoard, prev_player: int = 2):
        self.root = MCTSNode(root_board, prev_player=prev_player)
        self.total_simulations = 0

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
        Run MCTS search with threat-aware enhancements.

        Returns: Best move (r, c)
        """
        immediate = self._check_tactical_moves()
        if immediate:
            self.total_simulations = 0
            return immediate

        if max_time is None and simulations is None:
            simulations = 1000

        start_time = time.time()
        sim_count = 0
        check_interval = 100

        while True:
            node = self._select(self.root)
            moves_made, result = self._simulate(node)
            self._backpropagate(node, result, moves_made)

            sim_count += 1

            if max_time is not None:
                if time.time() - start_time >= max_time:
                    break
            elif sim_count >= simulations:
                break

            if adaptive and sim_count % check_interval == 0 and sim_count > 500:
                if self._should_early_exit(early_exit_threshold):
                    break

        self.total_simulations = sim_count

        if not self.root.children:
            moves = self.root.untried_moves
            return moves[0] if moves else None

        best = max(self.root.children.values(), key=lambda n: n.visits)
        return best.action

    def _check_tactical_moves(self) -> tuple:
        """
        Tactical move detection.

        Priority:
        1. Immediate win
        2. Block immediate opponent win
        3. Create double threat (fork)
        4. Block opponent's double threat setup
        5. Play into opponent's three-in-a-row (block open-3)
        """
        board = self.root.board
        D, R, C = self.root.D, self.root.R, self.root.C
        win_length = self.root.win_length
        directions = self.root.directions
        bounds = self.root.bounds

        curr_player = 3 - self.root.prev_player
        opponent = self.root.prev_player

        # Check for immediate win
        wins = find_winning_moves(board, curr_player, D, R, C, win_length, directions, bounds)
        if wins.shape[0] > 0:
            return (int(wins[0, 0]), int(wins[0, 1]))

        # Check for immediate block
        opp_wins = find_winning_moves(board, opponent, D, R, C, win_length, directions, bounds)
        if opp_wins.shape[0] > 0:
            return (int(opp_wins[0, 0]), int(opp_wins[0, 1]))

        # Check for forcing moves (create double threat)
        forcing = find_forcing_moves(board, curr_player, D, R, C, win_length, directions, bounds)
        if forcing.shape[0] > 0:
            best_idx = 0
            best_threats = forcing[0, 2]
            for i in range(1, forcing.shape[0]):
                if forcing[i, 2] > best_threats:
                    best_threats = forcing[i, 2]
                    best_idx = i
            return (int(forcing[best_idx, 0]), int(forcing[best_idx, 1]))

        # Block opponent's forcing moves
        opp_forcing = find_forcing_moves(board, opponent, D, R, C, win_length, directions, bounds)
        if opp_forcing.shape[0] > 0:
            return (int(opp_forcing[0, 0]), int(opp_forcing[0, 1]))

        # Check for open three-in-a-rows to block
        opp_threats = find_threats(board, opponent, D, R, C, win_length, directions, bounds)
        threes, open_threes, _, _ = count_threats_by_type(opp_threats)

        if open_threes > 0:
            for i in range(opp_threats.shape[0]):
                if opp_threats[i, 0] == 3 and opp_threats[i, 4] == 2:
                    moves = get_valid_moves_array(board, D, R, C)
                    best_score = -float('inf')
                    best_move = None

                    for j in range(moves.shape[0]):
                        r, c = int(moves[j, 0]), int(moves[j, 1])
                        s = score_move(board, r, c, curr_player, D, R, C,
                                      win_length, directions, bounds,
                                      self.root.center_r, self.root.center_c)
                        if s > best_score:
                            best_score = s
                            best_move = (r, c)

                    if best_move and best_score > 1000:
                        return best_move

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
        """Selection phase with threat-aware expansion."""
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
        """Expansion phase - moves already ordered by threat score."""
        action = node.untried_moves.pop(0)

        new_board = node.board.copy()
        curr_player = 3 - node.prev_player
        make_move_array(new_board, action[0], action[1], curr_player, node.D, node.R)

        child_fb = BitBoard(dimensions=(node.D, node.R, node.C), win_length=node.win_length)
        child_fb.board = new_board
        child_fb.directions = node.directions
        child_fb.bounds = node.bounds
        child_fb.center_r = node.center_r
        child_fb.center_c = node.center_c

        child = MCTSNode(child_fb, parent=node, action=action, prev_player=curr_player)
        node.children[action] = child

        return child

    def _simulate(self, node: MCTSNode) -> tuple:
        """Simulation phase using smart rollouts."""
        rng_state = np.array([random.randint(0, 2**31 - 1)], dtype=np.int64)

        result = simulate_rollout_smart(
            node.board, node.prev_player,
            node.D, node.R, node.C, node.win_length,
            node.directions, node.bounds,
            node.center_r, node.center_c,
            rng_state
        )

        moves_made = []
        return moves_made, result

    def _backpropagate(self, node: MCTSNode, result: int, moves_made: list) -> None:
        """Backpropagation with RAVE updates."""
        p1_moves = set()
        p2_moves = set()

        temp = node
        while temp is not None:
            if temp.action is not None:
                if temp.prev_player == 1:
                    p1_moves.add(temp.action)
                else:
                    p2_moves.add(temp.action)
            temp = temp.parent

        while node is not None:
            node.visits += 1

            if result == 0:
                node.value += 0.5
            elif result == node.prev_player:
                node.value += 1.0

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
        """Get statistics for all explored moves."""
        stats = {}
        for action, child in self.root.children.items():
            win_rate = child.value / child.visits if child.visits > 0 else 0
            stats[action] = {
                'visits': child.visits,
                'win_rate': win_rate,
                'value': child.value,
                'threat_score': self.root.move_scores.get(action, 0)
            }
        return stats


# Backwards compatibility alias
EnhancedMCTS = MCTS


# ============================================================================
# ADAPTIVE TIME BUDGETING
# ============================================================================

def adaptive_time_budget(board: BitBoard, base_time: float = 10.0) -> float:
    """Calculate time budget based on game phase and complexity."""
    total_cells = board.D * board.R * board.C
    occupied = np.sum(board.board != 0)
    fill_ratio = occupied / total_cells

    moves_arr = get_valid_moves_array(board.board, board.D, board.R, board.C)
    valid_moves = moves_arr.shape[0]

    curr_player = 1 if occupied % 2 == 0 else 2
    opponent = 3 - curr_player

    opp_threats = find_threats(board.board, opponent, board.D, board.R, board.C,
                               board.win_length, board.directions, board.bounds)
    _, opp_open_threes, _, _ = count_threats_by_type(opp_threats)

    if opp_open_threes > 0:
        return base_time * 1.5

    if fill_ratio < 0.15:
        return base_time * 0.4

    if fill_ratio > 0.6 or valid_moves <= 10:
        return base_time * 0.5

    branch_factor = min(valid_moves / 20, 1.3)
    return base_time * branch_factor


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("MCTS TEST")
    print("=" * 60)

    print("\nWarming up Numba JIT...")
    fb = BitBoard(dimensions=(6, 6, 7), win_length=4)
    fb.simulate_rollout(2, seed=12345)
    fb.find_threats(1)
    print("JIT ready.\n")

    fb = BitBoard(dimensions=(6, 6, 7), win_length=4)
    mcts = MCTS(fb)

    print("Running 1000 simulations...")
    start = time.perf_counter()
    move = mcts.search(simulations=1000)
    elapsed = time.perf_counter() - start

    print(f"Best move: {move}")
    print(f"Time: {elapsed:.3f}s ({1000/elapsed:.0f} sims/sec)")

    print("\nTop moves by visits:")
    stats = mcts.get_move_stats()
    sorted_moves = sorted(stats.items(), key=lambda x: x[1]['visits'], reverse=True)[:5]
    for action, s in sorted_moves:
        print(f"  {action}: visits={s['visits']}, win_rate={s['win_rate']:.1%}, "
              f"threat_score={s['threat_score']:.0f}")

    print("\n" + "=" * 60)
    print("THREAT DETECTION TEST")
    print("=" * 60)

    fb2 = BitBoard(dimensions=(6, 6, 7), win_length=4)
    fb2.make_move(3, 2, 1)
    fb2.make_move(3, 3, 1)
    fb2.make_move(3, 4, 1)
    fb2.make_move(0, 0, 2)

    print("P1 has three in a row at (3,2), (3,3), (3,4)")
    print("Testing if MCTS finds the winning move...")

    mcts2 = MCTS(fb2, prev_player=2)
    move = mcts2.search(simulations=100)
    print(f"MCTS chose: {move}")

    fb2.make_move(move[0], move[1], 1)
    winner = fb2.check_win()
    print(f"Winner after move: {winner}")
    assert winner == 1, "Should have found the winning move!"
    print("Correctly found winning move!")

    print("\n" + "=" * 60)
    print("BLOCKING TEST")
    print("=" * 60)

    fb3 = BitBoard(dimensions=(6, 6, 7), win_length=4)
    fb3.make_move(3, 2, 1)
    fb3.make_move(3, 3, 1)
    fb3.make_move(3, 4, 1)

    print("P1 has three in a row, P2 must block")
    mcts3 = MCTS(fb3, prev_player=1)
    move = mcts3.search(simulations=100)
    print(f"P2 chose to block at: {move}")

    assert move[0] == 3 and (move[1] == 1 or move[1] == 5), "Should block the three!"
    print("Correctly blocked!")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED!")
    print("=" * 60)
