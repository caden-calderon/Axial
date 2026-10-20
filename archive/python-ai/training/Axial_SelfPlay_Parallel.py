"""
Parallel self-play using multiprocessing.

Each worker process runs complete games independently, 
collecting training data that can be used for neural network training.

IMPORTANT: Uses 'spawn' context to avoid Numba JIT deadlocks in forked processes.
"""
import multiprocessing as mp
import time
import random
import numpy as np
from dataclasses import dataclass
from typing import List, Tuple, Optional
import pickle

from Axial_BitBoard_Fast import FastBitBoard, get_valid_moves_array
from Axial_MCTS_Fast import FastMCTS, adaptive_time_budget


@dataclass
class GameRecord:
    """Record of a single game for training data."""
    states: list          # List of board states (numpy arrays)
    policies: list        # List of MCTS visit distributions  
    outcome: int          # 1 = P1 win, 2 = P2 win, 0 = draw
    num_moves: int
    game_time: float


def _warmup_jit():
    """Warm up Numba JIT compilation. Call once per process."""
    fb = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    fb.check_win()
    fb.get_valid_moves()
    fb.make_move(3, 3, 1)
    fb.simulate_rollout(2, seed=12345)


def play_single_game(
    game_id: int,
    dimensions: Tuple[int, int, int] = (6, 6, 7),
    win_length: int = 4,
    simulations_per_move: int = 800,
    use_time_budget: bool = False,
    base_time: float = 2.0,
    verbose: bool = False
) -> GameRecord:
    """
    Play a single self-play game.
    """
    start_time = time.time()
    
    board = FastBitBoard(dimensions=dimensions, win_length=win_length)
    mcts = FastMCTS(board, prev_player=2)
    
    states = []
    policies = []
    current_player = 1
    move_count = 0
    
    while True:
        # Check for game over
        winner = board.check_win()
        if winner != 0:
            break
        
        valid_moves = board.get_valid_moves()
        if not valid_moves:
            winner = 0  # Draw
            break
        
        # Record state before move
        states.append(board.board.copy())
        
        # Run MCTS
        if use_time_budget:
            budget = adaptive_time_budget(board, base_time)
            best_move = mcts.search(max_time=budget, adaptive=True)
        else:
            best_move = mcts.search(simulations=simulations_per_move, adaptive=True)
        
        # Record policy (visit distribution)
        policy = np.zeros(board.R * board.C)
        total_visits = sum(c.visits for c in mcts.root.children.values())
        if total_visits > 0:
            for action, child in mcts.root.children.items():
                idx = action[0] * board.C + action[1]
                policy[idx] = child.visits / total_visits
        policies.append(policy)
        
        # Make move
        board.make_move(best_move[0], best_move[1], current_player)
        
        # Advance MCTS tree
        if not mcts.advance_root(best_move):
            mcts = FastMCTS(board, prev_player=current_player)
        
        if verbose:
            print("Game {} | Move {} | P{} -> {}".format(
                game_id, move_count, current_player, best_move))
        
        current_player = 3 - current_player
        move_count += 1
    
    game_time = time.time() - start_time
    
    return GameRecord(
        states=states,
        policies=policies,
        outcome=winner,
        num_moves=move_count,
        game_time=game_time
    )


def _worker_init():
    """Initialize worker process - warm up JIT."""
    _warmup_jit()


def _worker_process(args):
    """Worker function for multiprocessing Pool."""
    game_id, config = args
    
    # Set random seed
    seed = game_id + int(time.time() * 1000) % 100000
    random.seed(seed)
    np.random.seed(seed)
    
    return play_single_game(
        game_id=game_id,
        dimensions=config['dimensions'],
        win_length=config['win_length'],
        simulations_per_move=config['simulations_per_move'],
        use_time_budget=config['use_time_budget'],
        base_time=config['base_time'],
        verbose=False
    )


def parallel_self_play(
    num_games: int,
    num_workers: Optional[int] = None,
    dimensions: Tuple[int, int, int] = (6, 6, 7),
    win_length: int = 4,
    simulations_per_move: int = 800,
    use_time_budget: bool = False,
    base_time: float = 2.0,
    progress_interval: int = 10
) -> List[GameRecord]:
    """
    Run parallel self-play games.
    """
    if num_workers is None:
        num_workers = max(1, mp.cpu_count() - 1)
    
    config = {
        'dimensions': dimensions,
        'win_length': win_length,
        'simulations_per_move': simulations_per_move,
        'use_time_budget': use_time_budget,
        'base_time': base_time
    }
    
    print("=" * 60)
    print("PARALLEL SELF-PLAY")
    print("=" * 60)
    print("Games: {}".format(num_games))
    print("Workers: {}".format(num_workers))
    print("Board: {}x{}x{}".format(dimensions[0], dimensions[1], dimensions[2]))
    print("Simulations/move: {}".format(simulations_per_move))
    print("=" * 60)
    
    # Warm up JIT in main process first
    print("Warming up Numba JIT...")
    _warmup_jit()
    print("JIT ready.")
    
    start_time = time.time()
    results = []
    
    # Create work items
    work_items = [(i, config) for i in range(num_games)]
    
    # Use spawn context explicitly for Numba compatibility
    try:
        ctx = mp.get_context('spawn')
    except ValueError:
        # Fallback if spawn not available
        ctx = mp.get_context()
    
    # Run with multiprocessing Pool
    with ctx.Pool(num_workers, initializer=_worker_init) as pool:
        for i, result in enumerate(pool.imap_unordered(_worker_process, work_items)):
            results.append(result)
            
            if (i + 1) % progress_interval == 0 or i == num_games - 1:
                elapsed = time.time() - start_time
                games_per_sec = (i + 1) / elapsed
                eta = (num_games - i - 1) / games_per_sec if games_per_sec > 0 else 0
                
                p1_wins = sum(1 for r in results if r.outcome == 1)
                p2_wins = sum(1 for r in results if r.outcome == 2)
                draws = sum(1 for r in results if r.outcome == 0)
                avg_moves = sum(r.num_moves for r in results) / len(results)
                
                print("Progress: {}/{} | {:.2f} games/s | ETA: {:.0f}s | P1:{} P2:{} D:{} | Avg: {:.1f} moves".format(
                    i+1, num_games, games_per_sec, eta, p1_wins, p2_wins, draws, avg_moves))
    
    total_time = time.time() - start_time
    
    print()
    print("=" * 60)
    print("COMPLETED")
    print("=" * 60)
    print("Total time: {:.1f}s".format(total_time))
    print("Games/second: {:.2f}".format(num_games/total_time))
    print("Avg game time: {:.2f}s".format(sum(r.game_time for r in results)/len(results)))
    
    return results


def save_training_data(records: List[GameRecord], filepath: str):
    """Save game records to file."""
    with open(filepath, 'wb') as f:
        pickle.dump(records, f)
    print("Saved {} games to {}".format(len(records), filepath))


def load_training_data(filepath: str) -> List[GameRecord]:
    """Load game records from file."""
    with open(filepath, 'rb') as f:
        return pickle.load(f)


def sequential_self_play(
    num_games: int,
    dimensions: Tuple[int, int, int] = (6, 6, 7),
    win_length: int = 4,
    simulations_per_move: int = 800,
    verbose: bool = True
) -> List[GameRecord]:
    """Run games sequentially (single-threaded)."""
    print("Running {} games sequentially...".format(num_games))
    
    _warmup_jit()
    
    start_time = time.time()
    results = []
    
    for i in range(num_games):
        result = play_single_game(
            game_id=i,
            dimensions=dimensions,
            win_length=win_length,
            simulations_per_move=simulations_per_move,
            verbose=False
        )
        results.append(result)
        
        if verbose and (i + 1) % 5 == 0:
            elapsed = time.time() - start_time
            print("Game {}/{} | {:.1f}s elapsed | P{} wins in {} moves".format(
                i+1, num_games, elapsed, result.outcome, result.num_moves))
    
    total_time = time.time() - start_time
    print("Sequential: {} games in {:.1f}s ({:.2f} games/s)".format(
        num_games, total_time, num_games/total_time))
    
    return results


def benchmark_parallel_vs_sequential():
    """Compare parallel vs sequential performance."""
    num_games = 12
    sims_per_move = 300
    
    print()
    print("=" * 60)
    print("BENCHMARK: Parallel vs Sequential")
    print("=" * 60)
    
    # Sequential
    print()
    print("-" * 40)
    print("SEQUENTIAL")
    print("-" * 40)
    start = time.time()
    seq_results = sequential_self_play(num_games=num_games, simulations_per_move=sims_per_move)
    seq_time = time.time() - start
    
    # Parallel
    print()
    print("-" * 40)
    print("PARALLEL")
    print("-" * 40)
    start = time.time()
    par_results = parallel_self_play(num_games=num_games, simulations_per_move=sims_per_move, progress_interval=4)
    par_time = time.time() - start
    
    print()
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)
    print("Sequential: {:.1f}s ({:.2f} games/s)".format(seq_time, num_games/seq_time))
    print("Parallel:   {:.1f}s ({:.2f} games/s)".format(par_time, num_games/par_time))
    print("Speedup:    {:.2f}x".format(seq_time/par_time))
    print("CPU cores:  {}".format(mp.cpu_count()))


def demo_verbose_game():
    """Play a single game with verbose output."""
    print()
    print("=" * 60)
    print("DEMO: Single Verbose Game")
    print("=" * 60)
    
    _warmup_jit()
    
    board = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    mcts = FastMCTS(board, prev_player=2)
    
    current_player = 1
    move_count = 0
    
    while True:
        winner = board.check_win()
        if winner != 0:
            print("\n*** GAME OVER: Player {} wins! ***".format(winner))
            break
        
        if not board.get_valid_moves():
            print("\n*** GAME OVER: Draw! ***")
            break
        
        budget = adaptive_time_budget(board, base_time=3.0)
        print("\nTurn {} | Player {} | Budget: {:.2f}s".format(move_count, current_player, budget))
        
        start = time.time()
        best_move = mcts.search(max_time=budget, adaptive=True)
        elapsed = time.time() - start
        
        print("  Move: {} | Time: {:.2f}s | Sims: {}".format(best_move, elapsed, mcts.total_simulations))
        
        stats = mcts.get_move_stats()
        if stats:
            top = sorted(stats.items(), key=lambda x: x[1]['visits'], reverse=True)[:3]
            top_strs = ["{}:{}({:.0%})".format(a, s['visits'], s['win_rate']) for a, s in top]
            print("  Top: {}".format(" | ".join(top_strs)))
        
        board.make_move(best_move[0], best_move[1], current_player)
        
        if not mcts.advance_root(best_move):
            mcts = FastMCTS(board, prev_player=current_player)
        
        current_player = 3 - current_player
        move_count += 1
    
    board.print_board()
    print("\nGame completed in {} moves".format(move_count))


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "benchmark":
            benchmark_parallel_vs_sequential()
        elif sys.argv[1] == "demo":
            demo_verbose_game()
        elif sys.argv[1] == "generate":
            num_games = int(sys.argv[2]) if len(sys.argv) > 2 else 100
            results = parallel_self_play(num_games=num_games, simulations_per_move=800)
            save_training_data(results, "training_data_{}games.pkl".format(num_games))
    else:
        benchmark_parallel_vs_sequential()
