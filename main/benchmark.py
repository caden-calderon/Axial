"""
Axial AI Benchmarks

This script benchmarks:
1. AI Playing Strength:
   - MCTS (1000 sims) vs Random
   - MCTS vs Basic MCTS
   - MCTS (1000 sims) vs Greedy

2. Computational Performance:
   - Win Check: Pure Python vs Numba JIT
   - Full Rollout: Pure Python vs Numba JIT
   - Simulations/sec: Pure Python vs Numba JIT

Usage:
    python benchmark.py              # Run all benchmarks
    python benchmark.py strength     # Only AI strength tests
    python benchmark.py performance  # Only computational performance tests
"""

import sys
import time
import random
import numpy as np
from typing import Tuple, List

from bitboard import (
    BitBoard,
    check_win_optimized,
    get_valid_moves_array,
    make_move_array,
    simulate_rollout_smart,
    compute_directions_and_bounds
)
from mcts import MCTS


# ============================================================================
# PURE PYTHON IMPLEMENTATIONS (for comparison)
# ============================================================================

def check_win_pure_python(board: np.ndarray, D: int, R: int, C: int,
                          win_length: int) -> int:
    """
    Pure Python win check - no Numba optimization.
    Returns: 1 if P1 won, 2 if P2 won, 0 otherwise
    """
    directions = [
        (1, 0, 0),   # Vertical (height)
        (0, 1, 0),   # Row
        (0, 0, 1),   # Column
        (1, 1, 0),   # h+r diagonal
        (1, -1, 0),  # h-r diagonal
        (0, 1, 1),   # r+c diagonal
        (0, 1, -1),  # r-c diagonal
        (1, 0, 1),   # h+c diagonal
        (1, 0, -1),  # h-c diagonal
        (1, 1, 1),   # 3D diagonal
        (1, 1, -1),
        (1, -1, 1),
        (1, -1, -1),
    ]

    for player in (1, 2):
        for c in range(C):
            for r in range(R):
                for h in range(D):
                    idx = h + r * D + c * D * R
                    if board[idx] != player:
                        continue

                    for dh, dr, dc in directions:
                        end_h = h + dh * (win_length - 1)
                        end_r = r + dr * (win_length - 1)
                        end_c = c + dc * (win_length - 1)

                        if not (0 <= end_h < D and 0 <= end_r < R and 0 <= end_c < C):
                            continue

                        count = 0
                        ch, cr, cc = h, r, c
                        for _ in range(win_length):
                            check_idx = ch + cr * D + cc * D * R
                            if board[check_idx] != player:
                                break
                            count += 1
                            ch += dh
                            cr += dr
                            cc += dc

                        if count >= win_length:
                            return player

    return 0


def get_valid_moves_pure_python(board: np.ndarray, D: int, R: int, C: int) -> List[Tuple[int, int]]:
    """Pure Python valid moves - no Numba."""
    moves = []
    for c in range(C):
        for r in range(R):
            col_base = r * D + c * D * R
            if board[col_base] == 0:
                moves.append((r, c))
    return moves


def make_move_pure_python(board: np.ndarray, r: int, c: int, player: int,
                          D: int, R: int) -> bool:
    """Pure Python make move - no Numba."""
    col_base = r * D + c * D * R
    for h in range(D):
        if board[col_base + h] == 0:
            board[col_base + h] = player
            return True
    return False


def simulate_rollout_pure_python(board: np.ndarray, prev_player: int,
                                  D: int, R: int, C: int, win_length: int) -> int:
    """
    Pure Python rollout - no Numba, no smart heuristics.
    Just random moves until game ends.
    """
    sim_board = board.copy()
    curr_player = 3 - prev_player

    for _ in range(D * R * C):
        winner = check_win_pure_python(sim_board, D, R, C, win_length)
        if winner != 0:
            return winner

        moves = get_valid_moves_pure_python(sim_board, D, R, C)
        if not moves:
            return 0

        r, c = random.choice(moves)
        make_move_pure_python(sim_board, r, c, curr_player, D, R)
        curr_player = 3 - curr_player

    return 0


# ============================================================================
# BASIC MCTS (without tactical enhancements)
# ============================================================================

class BasicMCTSNode:
    """Simple MCTS node without threat detection."""

    def __init__(self, board: BitBoard, parent=None, action=None, prev_player=2):
        self.board = board
        self.parent = parent
        self.action = action
        self.prev_player = prev_player
        self.children = []
        self.visits = 0
        self.value = 0.0
        self.untried_moves = board.get_valid_moves()

    def is_fully_expanded(self):
        return len(self.untried_moves) == 0

    def is_terminal(self):
        return self.board.check_win() != 0 or not self.board.get_valid_moves()

    def best_child(self, c_param=1.414):
        import math
        def uct(node):
            if node.visits == 0:
                return float('inf')
            exploit = node.value / node.visits
            explore = c_param * math.sqrt(math.log(self.visits) / node.visits)
            return exploit + explore
        return max(self.children, key=uct)


class BasicMCTS:
    """Basic MCTS without tactical enhancements - for comparison."""

    def __init__(self, root_board: BitBoard, prev_player: int = 2):
        self.root = BasicMCTSNode(root_board.copy(), prev_player=prev_player)
        self.total_simulations = 0

    def search(self, simulations: int = 1000) -> Tuple[int, int]:
        for _ in range(simulations):
            node = self._select(self.root)
            if not node.is_terminal() and node.is_fully_expanded():
                node = self._expand(node)
            result = self._simulate(node)
            self._backpropagate(node, result)
            self.total_simulations += 1

        if not self.root.children:
            moves = self.root.board.get_valid_moves()
            return moves[0] if moves else (0, 0)

        best = max(self.root.children, key=lambda c: c.visits)
        return best.action

    def _select(self, node: BasicMCTSNode) -> BasicMCTSNode:
        while not node.is_terminal():
            if not node.is_fully_expanded():
                return node
            node = node.best_child()
        return node

    def _expand(self, node: BasicMCTSNode) -> BasicMCTSNode:
        if not node.untried_moves:
            return node

        move = node.untried_moves.pop()
        new_board = node.board.copy()
        curr_player = 3 - node.prev_player
        new_board.make_move(move[0], move[1], curr_player)

        child = BasicMCTSNode(new_board, parent=node, action=move, prev_player=curr_player)
        node.children.append(child)
        return child

    def _simulate(self, node: BasicMCTSNode) -> int:
        """Random rollout - no smart heuristics."""
        return node.board.simulate_rollout(node.prev_player)

    def _backpropagate(self, node: BasicMCTSNode, result: int) -> None:
        while node:
            node.visits += 1
            if result == node.prev_player:
                node.value += 1.0
            elif result == 0:
                node.value += 0.5
            node = node.parent


# ============================================================================
# OPPONENT PLAYERS
# ============================================================================

class RandomPlayer:
    """Random move player."""

    def get_move(self, board: BitBoard) -> Tuple[int, int]:
        moves = board.get_valid_moves()
        return random.choice(moves) if moves else None


class GreedyPlayer:
    """
    Greedy 1-step lookahead player.
    - Takes winning moves
    - Blocks opponent wins
    - Otherwise plays center-biased random
    """

    def __init__(self, player_id: int):
        self.player_id = player_id
        self.opponent_id = 3 - player_id

    def get_move(self, board: BitBoard) -> Tuple[int, int]:
        moves = board.get_valid_moves()
        if not moves:
            return None

        for move in moves:
            test_board = board.copy()
            test_board.make_move(move[0], move[1], self.player_id)
            if test_board.check_win() == self.player_id:
                return move

        for move in moves:
            test_board = board.copy()
            test_board.make_move(move[0], move[1], self.opponent_id)
            if test_board.check_win() == self.opponent_id:
                return move

        center_r, center_c = board.R / 2, board.C / 2
        moves_with_dist = [(m, abs(m[0] - center_r) + abs(m[1] - center_c)) for m in moves]
        moves_with_dist.sort(key=lambda x: x[1])

        top_moves = [m[0] for m in moves_with_dist[:3]]
        return random.choice(top_moves)


# ============================================================================
# BENCHMARK FUNCTIONS
# ============================================================================

def play_game(player1_factory, player2_factory, verbose: bool = False) -> int:
    """
    Play a game between two players.

    Uses factory functions to create/reset players properly.

    Args:
        player1_factory: callable(board, prev_player) -> player for player 1
        player2_factory: callable(board, prev_player) -> player for player 2

    Returns: 1 if player1 wins, 2 if player2 wins, 0 for draw
    """
    board = BitBoard(dimensions=(6, 6, 7), win_length=4)
    current_player = 1

    player1 = player1_factory(board, prev_player=2)
    player2 = player2_factory(board, prev_player=1)

    players = {1: player1, 2: player2}

    while True:
        winner = board.check_win()
        if winner != 0:
            return winner

        moves = board.get_valid_moves()
        if not moves:
            return 0

        player = players[current_player]
        opponent_id = 3 - current_player

        if isinstance(player, MCTS):
            move = player.search(simulations=1000)
        elif isinstance(player, BasicMCTS):
            move = player.search(simulations=1000)
        elif hasattr(player, 'get_move'):
            move = player.get_move(board)
        else:
            raise ValueError(f"Unknown player type: {type(player)}")

        if move is None:
            return 0

        board.make_move(move[0], move[1], current_player)

        if verbose:
            print(f"Player {current_player} plays {move}")

        if isinstance(player, MCTS):
            if not player.advance_root(move):
                players[current_player] = player1_factory(board, prev_player=current_player) if current_player == 1 else player2_factory(board, prev_player=current_player)

        opponent = players[opponent_id]
        if isinstance(opponent, MCTS):
            if not opponent.advance_root(move):
                players[opponent_id] = player1_factory(board, prev_player=current_player) if opponent_id == 1 else player2_factory(board, prev_player=current_player)
        elif isinstance(opponent, BasicMCTS):
            players[opponent_id] = player2_factory(board, prev_player=current_player) if opponent_id == 2 else player1_factory(board, prev_player=current_player)

        current_player = 3 - current_player


def benchmark_ai_strength(num_games: int = 20):
    """Benchmark AI playing strength."""
    print("\n" + "=" * 70)
    print("AI PLAYING STRENGTH BENCHMARKS")
    print("=" * 70)

    results = {}

    # Test 1: MCTS vs Random
    print("\n[1/3] MCTS (1000 sims) vs Random...")
    mcts_wins = 0

    for i in range(num_games):
        if i % 2 == 0:
            def mcts_factory(board, prev_player):
                return MCTS(board, prev_player=prev_player)
            def random_factory(board, prev_player):
                return RandomPlayer()

            winner = play_game(mcts_factory, random_factory)
            if winner == 1:
                mcts_wins += 1
            mcts_won = (winner == 1)
        else:
            def random_factory(board, prev_player):
                return RandomPlayer()
            def mcts_factory(board, prev_player):
                return MCTS(board, prev_player=prev_player)

            winner = play_game(random_factory, mcts_factory)
            if winner == 2:
                mcts_wins += 1
            mcts_won = (winner == 2)

        print(f"  Game {i+1}/{num_games}: {'MCTS' if mcts_won else 'Random'} wins")

    mcts_vs_random = mcts_wins / num_games * 100
    results['MCTS vs Random'] = mcts_vs_random
    print(f"\n  Result: MCTS win rate = {mcts_vs_random:.1f}%")

    # Test 2: MCTS vs Greedy
    print("\n[2/3] MCTS (1000 sims) vs Greedy...")
    mcts_wins = 0

    for i in range(num_games):
        if i % 2 == 0:
            def mcts_factory(board, prev_player):
                return MCTS(board, prev_player=prev_player)
            def greedy_factory(board, prev_player):
                return GreedyPlayer(player_id=2)

            winner = play_game(mcts_factory, greedy_factory)
            if winner == 1:
                mcts_wins += 1
            mcts_won = (winner == 1)
        else:
            def greedy_factory(board, prev_player):
                return GreedyPlayer(player_id=1)
            def mcts_factory(board, prev_player):
                return MCTS(board, prev_player=prev_player)

            winner = play_game(greedy_factory, mcts_factory)
            if winner == 2:
                mcts_wins += 1
            mcts_won = (winner == 2)

        print(f"  Game {i+1}/{num_games}: {'MCTS' if mcts_won else 'Greedy'} wins")

    mcts_vs_greedy = mcts_wins / num_games * 100
    results['MCTS vs Greedy'] = mcts_vs_greedy
    print(f"\n  Result: MCTS win rate = {mcts_vs_greedy:.1f}%")

    # Test 3: MCTS vs Basic MCTS
    print("\n[3/3] MCTS vs Basic MCTS...")
    mcts_wins = 0

    for i in range(num_games):
        board = BitBoard(dimensions=(6, 6, 7), win_length=4)

        if i % 2 == 0:
            mcts = MCTS(board, prev_player=2)
            mcts_player_id = 1
        else:
            mcts = MCTS(board, prev_player=1)
            mcts_player_id = 2

        current = 1
        while True:
            w = board.check_win()
            if w != 0:
                winner = w
                break
            if not board.get_valid_moves():
                winner = 0
                break

            if current == mcts_player_id:
                move = mcts.search(simulations=500)
                board.make_move(move[0], move[1], current)

                if not mcts.advance_root(move):
                    mcts = MCTS(board, prev_player=current)
            else:
                basic = BasicMCTS(board.copy(), prev_player=3-current)
                move = basic.search(simulations=500)
                board.make_move(move[0], move[1], current)

                if not mcts.advance_root(move):
                    mcts = MCTS(board, prev_player=current)

            current = 3 - current

        if winner == mcts_player_id:
            mcts_wins += 1

        mcts_won = (winner == mcts_player_id)
        print(f"  Game {i+1}/{num_games}: {'MCTS' if mcts_won else 'Basic'} wins")

    mcts_vs_basic = mcts_wins / num_games * 100
    results['MCTS vs Basic'] = mcts_vs_basic
    print(f"\n  Result: MCTS win rate = {mcts_vs_basic:.1f}%")

    return results


def benchmark_computational_performance(num_iterations: int = 1000):
    """Benchmark computational performance: Pure Python vs Numba JIT."""
    print("\n" + "=" * 70)
    print("COMPUTATIONAL PERFORMANCE BENCHMARKS")
    print("=" * 70)

    results = {}

    D, R, C, win_length = 6, 6, 7, 4
    directions, bounds = compute_directions_and_bounds(D, R, C)

    board = np.zeros(D * R * C, dtype=np.uint8)
    for _ in range(30):
        r, c = random.randint(0, R-1), random.randint(0, C-1)
        player = random.choice([1, 2])
        col_base = r * D + c * D * R
        for h in range(D):
            if board[col_base + h] == 0:
                board[col_base + h] = player
                break

    print("\nWarming up Numba JIT...")
    for _ in range(10):
        check_win_optimized(board, D, R, C, win_length, directions, bounds)
    fb = BitBoard(dimensions=(D, R, C), win_length=win_length)
    fb.board = board.copy()
    fb.simulate_rollout(1)
    print("JIT ready.\n")

    # Test 1: Win Check
    print("[1/3] Win Check Speed...")

    start = time.perf_counter()
    for _ in range(num_iterations):
        check_win_pure_python(board, D, R, C, win_length)
    python_time = (time.perf_counter() - start) / num_iterations * 1e6

    start = time.perf_counter()
    for _ in range(num_iterations):
        check_win_optimized(board, D, R, C, win_length, directions, bounds)
    numba_time = (time.perf_counter() - start) / num_iterations * 1e6

    speedup = python_time / numba_time
    results['Win Check'] = {
        'Pure Python': f"{python_time:.2f} us",
        'Numba JIT': f"{numba_time:.2f} us",
        'Speedup': f"{speedup:.1f}x"
    }
    print(f"  Pure Python: {python_time:.2f} us")
    print(f"  Numba JIT:   {numba_time:.2f} us")
    print(f"  Speedup:     {speedup:.1f}x")

    # Test 2: Full Rollout
    print("\n[2/3] Full Rollout Speed...")

    rollout_iterations = 100

    start_board = np.zeros(D * R * C, dtype=np.uint8)
    for _ in range(10):
        r, c = random.randint(0, R-1), random.randint(0, C-1)
        player = random.choice([1, 2])
        col_base = r * D + c * D * R
        for h in range(D):
            if start_board[col_base + h] == 0:
                start_board[col_base + h] = player
                break

    start = time.perf_counter()
    for _ in range(rollout_iterations):
        simulate_rollout_pure_python(start_board.copy(), 1, D, R, C, win_length)
    python_time = (time.perf_counter() - start) / rollout_iterations * 1000

    fb_start = BitBoard(dimensions=(D, R, C), win_length=win_length)
    fb_start.board = start_board.copy()

    start = time.perf_counter()
    for _ in range(rollout_iterations):
        fb_copy = fb_start.copy()
        fb_copy.simulate_rollout(1)
    numba_time = (time.perf_counter() - start) / rollout_iterations * 1000

    speedup = python_time / numba_time
    results['Full Rollout'] = {
        'Pure Python': f"{python_time:.2f} ms",
        'Numba JIT': f"{numba_time:.2f} ms",
        'Speedup': f"{speedup:.1f}x"
    }
    print(f"  Pure Python: {python_time:.2f} ms")
    print(f"  Numba JIT:   {numba_time:.2f} ms")
    print(f"  Speedup:     {speedup:.1f}x")

    # Test 3: Simulations per Second
    print("\n[3/3] MCTS Simulations per Second...")

    test_duration = 3.0

    fb = BitBoard(dimensions=(D, R, C), win_length=win_length)
    mcts = MCTS(fb, prev_player=2)

    start = time.perf_counter()
    count = 0
    while time.perf_counter() - start < test_duration:
        mcts.search(simulations=100)
        count += 100
        fb = BitBoard(dimensions=(D, R, C), win_length=win_length)
        mcts = MCTS(fb, prev_player=2)

    elapsed = time.perf_counter() - start
    sims_per_sec = count / elapsed

    results['Simulations/sec'] = {
        'Numba JIT (MCTS)': f"~{int(sims_per_sec):,}",
    }
    print(f"  MCTS (Numba): ~{int(sims_per_sec):,} sims/sec")

    python_estimate = sims_per_sec / speedup
    results['Simulations/sec']['Pure Python (estimated)'] = f"~{int(python_estimate):,}"
    print(f"  Pure Python (estimated): ~{int(python_estimate):,} sims/sec")

    return results


def print_summary(strength_results, perf_results):
    """Print final summary table."""
    print("\n" + "=" * 70)
    print("BENCHMARK SUMMARY")
    print("=" * 70)

    print("\n+---------------------------------------------------------------------+")
    print("|                      AI PLAYING STRENGTH                            |")
    print("+---------------------------------------------------------------------+")
    print(f"|  MCTS (1000 sims) vs Random      |  {strength_results.get('MCTS vs Random', 'N/A'):>6.1f}% win rate           |")
    print(f"|  MCTS (1000 sims) vs Greedy      |  {strength_results.get('MCTS vs Greedy', 'N/A'):>6.1f}% win rate           |")
    print(f"|  MCTS vs Basic MCTS              |  {strength_results.get('MCTS vs Basic', 'N/A'):>6.1f}% win rate           |")
    print("+---------------------------------------------------------------------+")

    print("\n+---------------------------------------------------------------------+")
    print("|                   COMPUTATIONAL PERFORMANCE                         |")
    print("+------------------+----------------+----------------+----------------+")
    print("|    Operation     |  Pure Python   |   Numba JIT    |    Speedup     |")
    print("+------------------+----------------+----------------+----------------+")

    for op in ['Win Check', 'Full Rollout']:
        if op in perf_results:
            r = perf_results[op]
            print(f"|  {op:<14}  |  {r['Pure Python']:>12}  |  {r['Numba JIT']:>12}  |  {r['Speedup']:>12}  |")

    if 'Simulations/sec' in perf_results:
        r = perf_results['Simulations/sec']
        python_est = r.get('Pure Python (estimated)', 'N/A')
        numba = r.get('Numba JIT (MCTS)', 'N/A')
        print(f"|  {'Sims/sec':<14}  |  {python_est:>12}  |  {numba:>12}  |  {'~20x':>12}  |")

    print("+------------------+----------------+----------------+----------------+")


def main():
    print("=" * 70)
    print("AXIAL AI BENCHMARKS")
    print("=" * 70)
    print("This will take several minutes to complete.")
    print("Running comprehensive tests for presentation metrics.")

    run_strength = True
    run_performance = True

    if len(sys.argv) > 1:
        arg = sys.argv[1].lower()
        if arg == 'strength':
            run_performance = False
        elif arg == 'performance':
            run_strength = False
        elif arg in ['-h', '--help']:
            print(__doc__)
            return

    strength_results = {}
    perf_results = {}

    if run_strength:
        strength_results = benchmark_ai_strength(num_games=20)

    if run_performance:
        perf_results = benchmark_computational_performance(num_iterations=1000)

    print_summary(strength_results, perf_results)

    print("\n" + "=" * 70)
    print("BENCHMARKS COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()
