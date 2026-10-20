#!/usr/bin/env python3
"""
Test script to verify MCTS components work correctly.

Tests:
1. BitBoard - Board representation, win detection, threat detection
2. MCTS - Monte Carlo Tree Search with tactical awareness
3. Threat Detection - Finding winning moves and blocks
4. AI vs AI - Self-play game to verify complete system
5. AI vs Random - Verify AI beats random player consistently
"""
import time
import random


def test_bitboard():
    """Test the BitBoard with threat detection."""
    print("=" * 50)
    print("TEST: BitBoard")
    print("=" * 50)

    from bitboard import BitBoard

    print("Warming up Numba JIT...")
    fb = BitBoard(dimensions=(6, 6, 7), win_length=4)
    fb.check_win()
    fb.get_valid_moves()
    fb.find_threats(1)
    fb.simulate_rollout(2, seed=12345)
    print("JIT compilation complete.")

    fb = BitBoard(dimensions=(6, 6, 7), win_length=4)
    print("\nBoard dimensions: {}D x {}R x {}C = {} cells".format(
        fb.D, fb.R, fb.C, fb.D * fb.R * fb.C))
    print("Valid moves at start: {}".format(len(fb.get_valid_moves())))

    fb.make_move(2, 3, 1)
    fb.make_move(2, 3, 2)
    print("After 2 moves, valid moves: {}".format(len(fb.get_valid_moves())))

    assert fb.check_win() == 0, "Should not be a win yet"

    print("\nTesting threat detection...")
    fb3 = BitBoard(dimensions=(6, 6, 7), win_length=4)
    fb3.make_move(3, 3, 1)
    fb3.make_move(3, 4, 1)
    fb3.make_move(3, 5, 1)

    threats = fb3.find_threats(1)
    print("P1 threats found: {}".format(threats.shape[0]))

    winning = fb3.find_winning_moves(1)
    print("P1 winning moves: {}".format(winning))
    assert len(winning) > 0, "Should find winning move"

    print("\nSpeed test: 1000 smart rollouts...")
    start = time.perf_counter()
    for i in range(1000):
        fb2 = BitBoard(dimensions=(6, 6, 7), win_length=4)
        fb2.simulate_rollout(2, seed=i)
    elapsed = time.perf_counter() - start
    print("  {:.2f}s total ({:.0f} rollouts/sec)".format(elapsed, 1000/elapsed))

    print("\n[PASS] BitBoard")
    return True


def test_mcts():
    """Test the MCTS with threat detection."""
    print("\n" + "=" * 50)
    print("TEST: MCTS")
    print("=" * 50)

    from bitboard import BitBoard
    from mcts import MCTS

    board = BitBoard(dimensions=(6, 6, 7), win_length=4)
    mcts = MCTS(board, prev_player=2)

    print("\nRunning MCTS with 500 simulations...")
    start = time.perf_counter()
    move = mcts.search(simulations=500)
    elapsed = time.perf_counter() - start

    print("  Best move: row={}, col={}".format(move[0], move[1]))
    print("  Time: {:.2f}s ({:.0f} sims/sec)".format(elapsed, 500/elapsed))

    stats = mcts.get_move_stats()
    print("  Top 3 moves by visits:")
    sorted_moves = sorted(stats.items(), key=lambda x: x[1]['visits'], reverse=True)[:3]
    for action, s in sorted_moves:
        print("    ({}, {}): {} visits, {:.1%} win rate".format(
            action[0], action[1], s['visits'], s['win_rate']))

    print("\nRunning MCTS with 2-second time budget...")
    board2 = BitBoard(dimensions=(6, 6, 7), win_length=4)
    mcts2 = MCTS(board2, prev_player=2)

    start = time.perf_counter()
    move2 = mcts2.search(max_time=2.0)
    elapsed2 = time.perf_counter() - start

    print("  Best move: row={}, col={}".format(move2[0], move2[1]))
    print("  Time: {:.2f}s, {} simulations ({:.0f} sims/sec)".format(
        elapsed2, mcts2.total_simulations, mcts2.total_simulations/elapsed2))

    print("\n[PASS] MCTS")
    return True


def test_ai_vs_ai():
    """Test a complete AI vs AI game."""
    print("\n" + "=" * 50)
    print("TEST: AI vs AI Game")
    print("=" * 50)

    from bitboard import BitBoard
    from mcts import MCTS

    board = BitBoard(dimensions=(6, 6, 7), win_length=4)
    mcts = MCTS(board, prev_player=2)

    current_player = 1
    move_count = 0
    sims_per_move = 300

    print("\nPlaying game with {} sims/move...".format(sims_per_move))
    start = time.perf_counter()

    while True:
        winner = board.check_win()
        if winner != 0:
            break

        valid_moves = board.get_valid_moves()
        if not valid_moves:
            winner = 0
            break

        move = mcts.search(simulations=sims_per_move)
        board.make_move(move[0], move[1], current_player)

        if not mcts.advance_root(move):
            mcts = MCTS(board, prev_player=current_player)

        move_count += 1
        current_player = 3 - current_player

        if move_count % 10 == 0:
            print("  Move {}...".format(move_count))

    elapsed = time.perf_counter() - start

    if winner == 0:
        print("\nResult: DRAW after {} moves".format(move_count))
    else:
        print("\nResult: Player {} WINS in {} moves".format(winner, move_count))

    print("Game time: {:.1f}s ({:.1f}s/move avg)".format(elapsed, elapsed/move_count))

    print("\n[PASS] AI vs AI")
    return True


def test_ai_vs_random():
    """Test AI against random player to verify it's actually smart."""
    print("\n" + "=" * 50)
    print("TEST: AI vs Random (10 games)")
    print("=" * 50)

    from bitboard import BitBoard
    from mcts import MCTS

    ai_wins = 0
    random_wins = 0
    draws = 0

    for game in range(10):
        ai_is_p1 = (game % 2 == 0)
        ai_player = 1 if ai_is_p1 else 2

        board = BitBoard(dimensions=(6, 6, 7), win_length=4)
        mcts = MCTS(board, prev_player=2)

        current_player = 1

        while True:
            winner = board.check_win()
            if winner != 0:
                break

            valid_moves = board.get_valid_moves()
            if not valid_moves:
                winner = 0
                break

            if current_player == ai_player:
                move = mcts.search(simulations=200)
            else:
                move = random.choice(valid_moves)

            board.make_move(move[0], move[1], current_player)

            if not mcts.advance_root(move):
                mcts = MCTS(board, prev_player=current_player)

            current_player = 3 - current_player

        if winner == 0:
            draws += 1
        elif winner == ai_player:
            ai_wins += 1
        else:
            random_wins += 1

        print("  Game {}: {} wins".format(game + 1,
            "AI" if winner == ai_player else ("Random" if winner != 0 else "Draw")))

    win_rate = ai_wins / 10
    print("\nResults: AI {} - {} Random (draws: {})".format(ai_wins, random_wins, draws))
    print("AI win rate: {:.0%}".format(win_rate))

    if win_rate >= 0.8:
        print("\n[PASS] AI vs Random (AI is strong)")
    else:
        print("\n[WARN] AI win rate lower than expected")

    return win_rate >= 0.7


def test_threat_detection():
    """Test threat detection and forced win finding."""
    print("\n" + "=" * 50)
    print("TEST: Threat Detection")
    print("=" * 50)

    from bitboard import BitBoard
    from mcts import MCTS

    board = BitBoard(dimensions=(6, 6, 7), win_length=4)
    board.make_move(3, 2, 1)
    board.make_move(3, 3, 1)
    board.make_move(3, 4, 1)

    print("\nP1 has pieces at (3,2), (3,3), (3,4)")

    winning = board.find_winning_moves(1)
    print("P1 winning moves: {}".format(winning))
    assert len(winning) > 0, "Should find winning moves!"

    mcts = MCTS(board, prev_player=2)
    move = mcts.search(simulations=100)
    print("MCTS chose: {}".format(move))

    board.make_move(move[0], move[1], 1)
    winner = board.check_win()
    assert winner == 1, "MCTS should find winning move!"
    print("[OK] MCTS found winning move!")

    print("\nTesting blocking...")
    board2 = BitBoard(dimensions=(6, 6, 7), win_length=4)
    board2.make_move(3, 2, 1)
    board2.make_move(3, 3, 1)
    board2.make_move(3, 4, 1)

    mcts2 = MCTS(board2, prev_player=1)
    move = mcts2.search(simulations=100)
    print("P2 chose to block at: {}".format(move))

    assert move[0] == 3 and (move[1] == 1 or move[1] == 5), "Should block!"
    print("[OK] MCTS correctly blocked!")

    print("\nTesting threat analysis...")
    board3 = BitBoard(dimensions=(6, 6, 7), win_length=4)
    board3.make_move(3, 3, 1)
    board3.make_move(3, 4, 1)

    threats = board3.find_threats(1)
    print("P1 threats found: {}".format(threats.shape[0]))

    print("\n[PASS] Threat Detection")
    return True


def main():
    print()
    print("=" * 50)
    print("AXIAL MCTS - COMPONENT TESTS")
    print("=" * 50)
    print()

    tests = [
        ("BitBoard", test_bitboard),
        ("MCTS", test_mcts),
        ("Threat Detection", test_threat_detection),
        ("AI vs AI", test_ai_vs_ai),
        ("AI vs Random", test_ai_vs_random),
    ]

    results = []
    for name, test_fn in tests:
        try:
            success = test_fn()
            results.append((name, success))
        except Exception as e:
            print("\nFAIL: {}".format(e))
            import traceback
            traceback.print_exc()
            results.append((name, False))

    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    for name, success in results:
        status = "[PASS]" if success else "[FAIL]"
        print("  {}: {}".format(status, name))

    all_passed = all(s for _, s in results)
    print()
    if all_passed:
        print("All tests passed! MCTS is working correctly.")
    else:
        print("Some tests failed - check output above.")

    return all_passed


if __name__ == "__main__":
    main()
