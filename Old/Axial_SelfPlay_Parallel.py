"""
Parallel self-play using multiprocessing.

Each worker process runs complete games independently, 
collecting training data that can be used for neural network training.
"""
import multiprocessing as mp
from multiprocessing import Pool
import time
import random
import numpy as np
from dataclasses import dataclass
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


def play_single_game(
    game_id: int,
    dimensions: tuple = (6, 6, 7),
    win_length: int = 4,
    simulations_per_move: int = 800,
    use_time_budget: bool = False,
    base_time: float = 2.0,
    verbose: bool = False
) -> GameRecord:
    """
    Play a single self-play game.
    
    Args:
        game_id: Unique identifier for this game
        dimensions: Board dimensions (D, R, C)
        win_length: Number in a row to win
        simulations_per_move: MCTS simulations per move (if not using time budget)
        use_time_budget: Use adaptive time budgeting instead of fixed simulations
        base_time: Base time for adaptive budgeting
        verbose: Print game progress
    
    Returns:
        GameRecord with training data
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
        policy = np.zeros(board.R * board.C)  # Flat policy over all columns
        total_visits = sum(c.visits for c in mcts.root.children.values())
        if total_visits > 0:
            for action, child in mcts.root.children.items():
                idx = action[0] * board.C + action[1]  # r * C + c
                policy[idx] = child.visits / total_visits
        policies.append(policy)
        
        # Make move
        board.make_move(best_move[0], best_move[1], current_player)
        
        # Advance MCTS tree
        if not mcts.advance_root(best_move):
            mcts = FastMCTS(board, prev_player=current_player)
        
        if verbose:
            print(f"Game {game_id} | Move {move_count} | P{current_player} -> {best_move}")
        
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


def worker_process(args):
    """Worker function for multiprocessing Pool."""
    game_id, config = args
    
    # Set random seed based on game_id for reproducibility
    random.seed(game_id + int(time.time() * 1000) % 10000)
    np.random.seed(game_id + int(time.time() * 1000) % 10000)
    
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
    num_workers: int = None,
    dimensions: tuple = (6, 6, 7),
    win_length: int = 4,
    simulations_per_move: int = 800,
    use_time_budget: bool = False,
    base_time: float = 2.0,
    progress_interval: int = 10
) -> list[GameRecord]:
    """
    Run parallel self-play games.
    
    Args:
        num_games: Total number of games to play
        num_workers: Number of worker processes (default: CPU count)
        dimensions: Board dimensions
        win_length: Number in a row to win
        simulations_per_move: MCTS simulations per move
        use_time_budget: Use time-based search instead of simulation count
        base_time: Base time for adaptive budgeting
        progress_interval: Print progress every N games
    
    Returns:
        List of GameRecord objects
    """
    if num_workers is None:
        num_workers = mp.cpu_count()
    
    config = {
        'dimensions': dimensions,
        'win_length': win_length,
        'simulations_per_move': simulations_per_move,
        'use_time_budget': use_time_budget,
        'base_time': base_time
    }
    
    print(f"=" * 60)
    print(f"PARALLEL SELF-PLAY")
    print(f"=" * 60)
    print(f"Games: {num_games}")
    print(f"Workers: {num_workers}")
    print(f"Board: {dimensions[0]}x{dimensions[1]}x{dimensions[2]}")
    print(f"Simulations/move: {simulations_per_move}")
    print(f"=" * 60)
    
    start_time = time.time()
    results = []
    
    # Create work items
    work_items = [(i, config) for i in range(num_games)]
    
    # Run with multiprocessing Pool
    with Pool(num_workers) as pool:
        for i, result in enumerate(pool.imap_unordered(worker_process, work_items)):
            results.append(result)
            
            if (i + 1) % progress_interval == 0 or i == num_games - 1:
                elapsed = time.time() - start_time
                games_per_sec = (i + 1) / elapsed
                eta = (num_games - i - 1) / games_per_sec if games_per_sec > 0 else 0
                
                # Calculate stats
                p1_wins = sum(1 for r in results if r.outcome == 1)
                p2_wins = sum(1 for r in results if r.outcome == 2)
                draws = sum(1 for r in results if r.outcome == 0)
                avg_moves = sum(r.num_moves for r in results) / len(results)
                
                print(f"Progress: {i+1}/{num_games} | "
                      f"{games_per_sec:.2f} games/s | "
                      f"ETA: {eta:.0f}s | "
                      f"P1:{p1_wins} P2:{p2_wins} D:{draws} | "
                      f"Avg moves: {avg_moves:.1f}")
    
    total_time = time.time() - start_time
    
    print(f"\n{'=' * 60}")
    print(f"COMPLETED")
    print(f"{'=' * 60}")
    print(f"Total time: {total_time:.1f}s")
    print(f"Games/second: {num_games/total_time:.2f}")
    print(f"Avg game time: {sum(r.game_time for r in results)/len(results):.2f}s")
    
    return results


def save_training_data(records: list[GameRecord], filepath: str):
    """Save game records to file."""
    with open(filepath, 'wb') as f:
        pickle.dump(records, f)
    print(f"Saved {len(records)} games to {filepath}")


def load_training_data(filepath: str) -> list[GameRecord]:
    """Load game records from file."""
    with open(filepath, 'rb') as f:
        return pickle.load(f)


# ============================================================================
# SINGLE-THREADED SELF-PLAY (for comparison/debugging)
# ============================================================================

def sequential_self_play(
    num_games: int,
    dimensions: tuple = (6, 6, 7),
    win_length: int = 4,
    simulations_per_move: int = 800,
    verbose: bool = True
) -> list[GameRecord]:
    """Run games sequentially (single-threaded) for comparison."""
    print(f"Running {num_games} games sequentially...")
    
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
            print(f"Game {i+1}/{num_games} | {elapsed:.1f}s elapsed | "
                  f"Outcome: P{result.outcome} in {result.num_moves} moves")
    
    total_time = time.time() - start_time
    print(f"\nSequential: {num_games} games in {total_time:.1f}s "
          f"({num_games/total_time:.2f} games/s)")
    
    return results


# ============================================================================
# DEMO / BENCHMARK
# ============================================================================

def benchmark_parallel_vs_sequential():
    """Compare parallel vs sequential performance."""
    num_games = 20
    sims_per_move = 400  # Lower for faster benchmark
    
    print("\n" + "=" * 60)
    print("BENCHMARK: Parallel vs Sequential")
    print("=" * 60)
    
    # Warm up JIT
    print("\nWarming up Numba JIT...")
    fb = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    fb.simulate_rollout(2, seed=12345)
    mcts = FastMCTS(fb)
    mcts.search(simulations=100)
    print("JIT ready.\n")
    
    # Sequential
    print("-" * 40)
    print("SEQUENTIAL (single-threaded)")
    print("-" * 40)
    start = time.time()
    seq_results = sequential_self_play(
        num_games=num_games,
        simulations_per_move=sims_per_move,
        verbose=False
    )
    seq_time = time.time() - start
    
    # Parallel
    print("\n" + "-" * 40)
    print("PARALLEL (multiprocessing)")
    print("-" * 40)
    start = time.time()
    par_results = parallel_self_play(
        num_games=num_games,
        simulations_per_move=sims_per_move,
        progress_interval=5
    )
    par_time = time.time() - start
    
    # Results
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    print(f"Sequential: {seq_time:.1f}s ({num_games/seq_time:.2f} games/s)")
    print(f"Parallel:   {par_time:.1f}s ({num_games/par_time:.2f} games/s)")
    print(f"Speedup:    {seq_time/par_time:.2f}x")
    print(f"CPU cores:  {mp.cpu_count()}")


def demo_verbose_game():
    """Play a single game with verbose output."""
    print("\n" + "=" * 60)
    print("DEMO: Single Verbose Game")
    print("=" * 60)
    
    # Warm up
    fb = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    fb.simulate_rollout(2, seed=12345)
    
    board = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    mcts = FastMCTS(board, prev_player=2)
    
    current_player = 1
    move_count = 0
    
    while True:
        winner = board.check_win()
        if winner != 0:
            print(f"\n*** GAME OVER: Player {winner} wins! ***")
            break
        
        if not board.get_valid_moves():
            print(f"\n*** GAME OVER: Draw! ***")
            break
        
        # Calculate budget
        budget = adaptive_time_budget(board, base_time=3.0)
        
        print(f"\nTurn {move_count} | Player {current_player} | Budget: {budget:.2f}s")
        
        start = time.time()
        best_move = mcts.search(max_time=budget, adaptive=True)
        elapsed = time.time() - start
        
        print(f"  Move: {best_move} | Time: {elapsed:.2f}s | Sims: {mcts.total_simulations}")
        
        # Show top moves
        stats = mcts.get_move_stats()
        if stats:
            top = sorted(stats.items(), key=lambda x: x[1]['visits'], reverse=True)[:3]
            moves_str = " | ".join(f"{a}:{s['visits']}({s['win_rate']:.0%})" for a, s in top)
            print(f"  Top: {moves_str}")
        
        board.make_move(best_move[0], best_move[1], current_player)
        
        if not mcts.advance_root(best_move):
            mcts = FastMCTS(board, prev_player=current_player)
        
        current_player = 3 - current_player
        move_count += 1
    
    board.print_board()
    print(f"\nGame completed in {move_count} moves")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "benchmark":
            benchmark_parallel_vs_sequential()
        elif sys.argv[1] == "demo":
            demo_verbose_game()
        elif sys.argv[1] == "generate":
            # Generate training data
            num_games = int(sys.argv[2]) if len(sys.argv) > 2 else 100
            results = parallel_self_play(
                num_games=num_games,
                simulations_per_move=800
            )
            save_training_data(results, f"training_data_{num_games}games.pkl")
    else:
        # Default: run benchmark
        benchmark_parallel_vs_sequential()
