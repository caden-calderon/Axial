import time
from Axial_BitBoard_Optimized import BitBoard
from Axial_MCTS_Optimized import MCTS, adaptive_time_budget, adaptive_simulation_budget


def play_game(base_time: float = 10.0, use_time_budget: bool = True, verbose: bool = True):
    """
    Runs a single game of MCTS vs MCTS with adaptive time management.
    
    Args:
        base_time: Base time budget per move in seconds
        use_time_budget: If True, use time-based search. If False, use simulation count.
        verbose: Print detailed output
    """
    board = BitBoard(dimensions=(6, 6, 7), win_length=4)
    mcts = MCTS(board, prev_player=2)  # P2 "just moved", so P1 starts
    
    current_player = 1
    turn_count = 0
    move_times = []
    
    if verbose:
        print("=" * 50)
        print("    AXIAL - MCTS Self-Play")
        print("=" * 50)
        print(f"Board: {board.D}x{board.R}x{board.C}, Win Length: {board.win_length}")
        print(f"Mode: {'Time-based' if use_time_budget else 'Simulation-based'}")
        print(f"Base budget: {base_time}s" if use_time_budget else f"Base sims: {int(base_time * 500)}")
        print("=" * 50)
    
    while True:
        # Check for game over
        winner = board.check_win()
        if winner != 0:
            if verbose:
                print(f"\n{'=' * 50}")
                print(f"  GAME OVER - Player {winner} Wins in {turn_count} turns!")
                print(f"{'=' * 50}")
            break
        
        if len(board.get_valid_moves()) == 0:
            if verbose:
                print(f"\n{'=' * 50}")
                print(f"  GAME OVER - Draw after {turn_count} turns!")
                print(f"{'=' * 50}")
            winner = 0
            break
        
        # Calculate adaptive budget
        if use_time_budget:
            budget = adaptive_time_budget(board, base_time)
        else:
            budget = adaptive_simulation_budget(board, int(base_time * 500))
        
        # Search
        turn_start = time.time()
        
        if verbose:
            fill_ratio = bin(board.player1 | board.player2).count('1') / (board.D * board.R * board.C)
            phase = "Early" if fill_ratio < 0.15 else ("Mid" if fill_ratio < 0.6 else "Late")
            print(f"\nTurn {turn_count} | P{current_player} | {phase} game ({fill_ratio:.0%} full)")
            print(f"  Budget: {budget:.1f}s" if use_time_budget else f"  Budget: {budget} sims", end="")
        
        if use_time_budget:
            best_move = mcts.search(max_time=budget, adaptive=True)
        else:
            best_move = mcts.search(simulations=budget, adaptive=True)
        
        turn_time = time.time() - turn_start
        move_times.append(turn_time)
        
        if verbose:
            print(f" → {turn_time:.2f}s actual | {mcts.total_simulations} sims")
            print(f"  Move: {best_move}")
            
            # Show top 3 considered moves
            stats = mcts.get_move_stats()
            if stats:
                sorted_moves = sorted(stats.items(), key=lambda x: x[1]['visits'], reverse=True)[:3]
                print(f"  Top choices: ", end="")
                for action, s in sorted_moves:
                    print(f"{action}({s['visits']}, {s['win_rate']:.0%}) ", end="")
                print()
        
        # Apply move
        board.make_move(best_move[0], best_move[1], current_player)
        
        # Advance MCTS tree
        if not mcts.advance_root(best_move):
            if verbose:
                print("  [Tree reset - move not in tree]")
            mcts = MCTS(board, prev_player=current_player)
        
        # Switch player
        current_player = 3 - current_player
        turn_count += 1
    
    # Final stats
    if verbose:
        board.print_board()
        print(f"\nGame Statistics:")
        print(f"  Total turns: {turn_count}")
        print(f"  Total time: {sum(move_times):.1f}s")
        print(f"  Avg time/move: {sum(move_times)/len(move_times):.2f}s")
        print(f"  Max time: {max(move_times):.2f}s")
        print(f"  Min time: {min(move_times):.2f}s")
    
    return winner, turn_count, move_times


def benchmark(num_games: int = 3, base_time: float = 5.0):
    """Run multiple games and collect statistics."""
    print(f"\n{'=' * 50}")
    print(f"  BENCHMARK: {num_games} games @ {base_time}s base time")
    print(f"{'=' * 50}")
    
    results = {1: 0, 2: 0, 0: 0}
    all_times = []
    all_turns = []
    
    for i in range(num_games):
        print(f"\n--- Game {i+1}/{num_games} ---")
        winner, turns, times = play_game(base_time=base_time, verbose=False)
        results[winner] += 1
        all_times.extend(times)
        all_turns.append(turns)
        print(f"Winner: P{winner if winner else 'Draw'} in {turns} turns, {sum(times):.1f}s total")
    
    print(f"\n{'=' * 50}")
    print(f"  BENCHMARK RESULTS")
    print(f"{'=' * 50}")
    print(f"P1 wins: {results[1]}, P2 wins: {results[2]}, Draws: {results[0]}")
    print(f"Avg game length: {sum(all_turns)/len(all_turns):.1f} turns")
    print(f"Avg time/move: {sum(all_times)/len(all_times):.2f}s")
    print(f"Max time/move: {max(all_times):.2f}s")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "benchmark":
        benchmark(num_games=3, base_time=5.0)
    else:
        # Single verbose game with 10s base time (should stay well under 30s/move)
        play_game(base_time=10.0, use_time_budget=True, verbose=True)
