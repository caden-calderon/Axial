#!/usr/bin/env python3
"""
Simple test script to verify all components work.
"""
import time
import numpy as np


def test_bitboard():
    """Test the FastBitBoard."""
    print("=" * 50)
    print("TEST: FastBitBoard")
    print("=" * 50)
    
    from Axial_BitBoard_Fast import FastBitBoard
    
    # Warm up JIT
    print("Warming up JIT...")
    fb = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    fb.check_win()
    fb.get_valid_moves()
    fb.simulate_rollout(2, seed=12345)
    print("JIT ready.")
    
    # Test basic operations
    fb = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    print("Board: {}x{}x{}".format(fb.D, fb.R, fb.C))
    print("Valid moves: {}".format(len(fb.get_valid_moves())))
    
    # Speed test
    start = time.perf_counter()
    for i in range(1000):
        fb2 = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
        fb2.simulate_rollout(2, seed=i)
    elapsed = time.perf_counter() - start
    print("1000 rollouts: {:.2f}s ({:.0f}/sec)".format(elapsed, 1000/elapsed))
    
    print("PASS\n")
    return True


def test_mcts():
    """Test the Fast MCTS."""
    print("=" * 50)
    print("TEST: FastMCTS")
    print("=" * 50)
    
    from Axial_BitBoard_Fast import FastBitBoard
    from Axial_MCTS_Fast import FastMCTS
    
    board = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    mcts = FastMCTS(board, prev_player=2)
    
    start = time.perf_counter()
    move = mcts.search(simulations=500)
    elapsed = time.perf_counter() - start
    
    print("Best move: {}".format(move))
    print("500 sims in {:.2f}s ({:.0f}/sec)".format(elapsed, 500/elapsed))
    
    print("PASS\n")
    return True


def test_single_game():
    """Test playing a single game."""
    print("=" * 50)
    print("TEST: Single Game")
    print("=" * 50)
    
    from Axial_SelfPlay_Parallel import play_single_game, _warmup_jit
    
    _warmup_jit()
    
    start = time.perf_counter()
    result = play_single_game(
        game_id=0,
        dimensions=(6, 6, 7),
        win_length=4,
        simulations_per_move=200
    )
    elapsed = time.perf_counter() - start
    
    print("Outcome: P{} wins in {} moves".format(result.outcome, result.num_moves))
    print("Game time: {:.2f}s".format(elapsed))
    print("States recorded: {}".format(len(result.states)))
    print("Policies recorded: {}".format(len(result.policies)))
    
    print("PASS\n")
    return True


def test_sequential_games():
    """Test sequential self-play."""
    print("=" * 50)
    print("TEST: Sequential Self-Play (4 games)")
    print("=" * 50)
    
    from Axial_SelfPlay_Parallel import sequential_self_play
    
    start = time.perf_counter()
    results = sequential_self_play(
        num_games=4,
        simulations_per_move=200,
        verbose=True
    )
    elapsed = time.perf_counter() - start
    
    p1 = sum(1 for r in results if r.outcome == 1)
    p2 = sum(1 for r in results if r.outcome == 2)
    d = sum(1 for r in results if r.outcome == 0)
    
    print("Results: P1={}, P2={}, Draw={}".format(p1, p2, d))
    print("Total time: {:.2f}s".format(elapsed))
    
    print("PASS\n")
    return True


def main():
    print()
    print("=" * 50)
    print("AXIAL AI - COMPONENT TESTS")
    print("=" * 50)
    print()
    
    tests = [
        ("FastBitBoard", test_bitboard),
        ("FastMCTS", test_mcts),
        ("Single Game", test_single_game),
        ("Sequential Games", test_sequential_games),
    ]
    
    results = []
    for name, test_fn in tests:
        try:
            success = test_fn()
            results.append((name, success))
        except Exception as e:
            print("FAIL: {}".format(e))
            import traceback
            traceback.print_exc()
            results.append((name, False))
    
    print("=" * 50)
    print("SUMMARY")
    print("=" * 50)
    for name, success in results:
        status = "PASS" if success else "FAIL"
        print("  {}: {}".format(status, name))
    
    all_passed = all(s for _, s in results)
    print()
    if all_passed:
        print("All tests passed!")
    else:
        print("Some tests failed!")
    
    return all_passed


if __name__ == "__main__":
    main()
