"""
Diagnostic: Test if the trained NN actually learned anything,
or if wins are just from MCTS tree search strength.

Tests:
1. Trained NN+MCTS vs Random (baseline)
2. Untrained NN+MCTS vs Random (to see MCTS-only strength)
3. Trained NN+MCTS vs Untrained NN+MCTS (does training help?)
4. NN policy quality check (is it focused or uniform?)
"""
import sys
import os
import time
import random
import numpy as np
import torch

from Axial_BitBoard_Fast import FastBitBoard
from Axial_Network import NetworkWrapper
from Axial_MCTS_NN import NeuralMCTS


def play_game(p1_network, p2_network, p1_sims=200, p2_sims=200, 
              p1_is_random=False, p2_is_random=False, verbose=False):
    """Play a single game. Returns winner (1, 2, or 0 for draw)."""
    board = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    
    if not p1_is_random:
        p1_mcts = NeuralMCTS(board, p1_network, prev_player=2, c_puct=1.5)
    if not p2_is_random:
        p2_mcts = NeuralMCTS(board, p2_network, prev_player=2, c_puct=1.5)
    
    current_player = 1
    move_count = 0
    
    while True:
        winner = board.check_win()
        if winner != 0:
            break
        
        valid_moves = board.get_valid_moves()
        if not valid_moves:
            return 0, move_count  # Draw
        
        if current_player == 1:
            if p1_is_random:
                move = random.choice(valid_moves)
            else:
                move = p1_mcts.search(num_simulations=p1_sims, temperature=0.1)
        else:
            if p2_is_random:
                move = random.choice(valid_moves)
            else:
                move = p2_mcts.search(num_simulations=p2_sims, temperature=0.1)
        
        if verbose:
            print(f"  P{current_player}: {move}")
        
        board.make_move(move[0], move[1], current_player)
        
        # Update MCTS trees
        if not p1_is_random:
            if not p1_mcts.advance_root(move):
                p1_mcts = NeuralMCTS(board, p1_network, prev_player=current_player, c_puct=1.5)
        if not p2_is_random:
            if not p2_mcts.advance_root(move):
                p2_mcts = NeuralMCTS(board, p2_network, prev_player=current_player, c_puct=1.5)
        
        current_player = 3 - current_player
        move_count += 1
    
    return winner, move_count


def run_match(p1_net, p2_net, num_games=20, p1_sims=200, p2_sims=200,
              p1_random=False, p2_random=False, p1_name="P1", p2_name="P2"):
    """Run a match, alternating who goes first."""
    p1_wins = 0
    p2_wins = 0
    draws = 0
    total_moves = 0
    
    for i in range(num_games):
        # Alternate who goes first
        if i % 2 == 0:
            winner, moves = play_game(p1_net, p2_net, p1_sims, p2_sims, p1_random, p2_random)
            if winner == 1:
                p1_wins += 1
            elif winner == 2:
                p2_wins += 1
            else:
                draws += 1
        else:
            # Swap sides
            winner, moves = play_game(p2_net, p1_net, p2_sims, p1_sims, p2_random, p1_random)
            if winner == 1:
                p2_wins += 1
            elif winner == 2:
                p1_wins += 1
            else:
                draws += 1
        
        total_moves += moves
        
        if (i + 1) % 5 == 0:
            print(f"  Game {i+1}/{num_games}: {p1_name} {p1_wins} - {p2_wins} {p2_name} (draws: {draws})")
    
    avg_moves = total_moves / num_games
    p1_rate = p1_wins / num_games
    
    return p1_wins, p2_wins, draws, p1_rate, avg_moves


def analyze_policy(network, name="Network"):
    """Analyze if network policy is focused or uniform."""
    board = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    
    # Empty board
    policy, value = network.predict(board.board, current_player=1)
    
    uniform = 1.0 / 42  # ~0.024
    max_prob = policy.max()
    entropy = -np.sum(policy * np.log(policy + 1e-10))
    max_entropy = np.log(42)  # ~3.74 for uniform
    
    print(f"\n{name} Policy Analysis (empty board):")
    print(f"  Max probability: {max_prob:.4f} (uniform would be {uniform:.4f})")
    print(f"  Entropy: {entropy:.2f} / {max_entropy:.2f} (lower = more focused)")
    print(f"  Top 5 moves: {np.argsort(policy)[-5:][::-1]}")
    print(f"  Value estimate: {value:.4f}")
    
    # Is it focused?
    if max_prob > uniform * 3:
        print(f"  → Policy is FOCUSED (learned preferences)")
    else:
        print(f"  → Policy is UNIFORM (not learned)")
    
    return max_prob, entropy, value


def find_model(path=None):
    """Find a trained model."""
    if path and os.path.exists(path):
        return path
    
    candidates = [
        "checkpoints_hard/network_best.pt",
        "checkpoints_hard/network_final.pt",
        "checkpoints_medium/network_best.pt",
        "checkpoints_easy/network_best.pt",
        "checkpoints_validation/network_best.pt",
        "checkpoints_validation/network_final.pt",
    ]
    
    for c in candidates:
        if os.path.exists(c):
            return c
    
    return None


def load_network(path):
    """Load network with architecture detection."""
    checkpoint = torch.load(path, map_location='cpu', weights_only=False)
    state_dict = checkpoint['state_dict'] if 'state_dict' in checkpoint else checkpoint
    
    # Detect architecture
    num_channels = 128
    num_blocks = 0
    
    for key in state_dict:
        if 'conv_input' in key and 'weight' in key:
            num_channels = state_dict[key].shape[0]
            break
    
    for key in state_dict:
        if 'res_blocks' in key:
            parts = key.split('.')
            for i, p in enumerate(parts):
                if p == 'res_blocks' and i + 1 < len(parts):
                    try:
                        num_blocks = max(num_blocks, int(parts[i + 1]) + 1)
                    except ValueError:
                        pass
    
    if num_blocks == 0:
        num_blocks = 4
    
    network = NetworkWrapper(D=6, R=6, C=7, num_channels=num_channels, num_res_blocks=num_blocks)
    network.load(path)
    network.eval_mode()
    
    return network, num_channels, num_blocks


def main():
    print("=" * 60)
    print("AXIAL NN DIAGNOSTIC")
    print("=" * 60)
    print("Testing if the neural network actually learned anything,")
    print("or if wins are purely from MCTS tree search.")
    print("=" * 60)
    
    # Find model
    model_path = sys.argv[1] if len(sys.argv) > 1 else None
    model_path = find_model(model_path)
    
    if not model_path:
        print("\nNo trained model found!")
        print("Usage: python test_nn_vs_mcts.py [model_path]")
        return
    
    print(f"\nLoading trained model: {model_path}")
    trained_net, channels, blocks = load_network(model_path)
    print(f"Architecture: {channels} channels, {blocks} res blocks")
    print(f"Parameters: {trained_net.num_parameters:,}")
    
    # Create untrained network with SAME architecture
    print(f"\nCreating untrained network (same architecture)...")
    untrained_net = NetworkWrapper(D=6, R=6, C=7, num_channels=channels, num_res_blocks=blocks)
    untrained_net.eval_mode()
    
    # === TEST 1: Policy Analysis ===
    print("\n" + "=" * 60)
    print("TEST 1: POLICY ANALYSIS")
    print("=" * 60)
    
    trained_max, trained_ent, trained_val = analyze_policy(trained_net, "Trained")
    untrained_max, untrained_ent, untrained_val = analyze_policy(untrained_net, "Untrained")
    
    if trained_max > untrained_max * 1.5:
        print("\n✓ Trained network has more focused policy")
    else:
        print("\n✗ Trained network policy is similar to untrained")
    
    # === TEST 2: Trained vs Random ===
    print("\n" + "=" * 60)
    print("TEST 2: TRAINED NN+MCTS vs RANDOM")
    print("=" * 60)
    print("This tests overall strength (NN + MCTS combined)")
    
    w, l, d, rate, avg = run_match(
        trained_net, None, num_games=20, p1_sims=200, p2_sims=0,
        p1_random=False, p2_random=True,
        p1_name="Trained", p2_name="Random"
    )
    print(f"\nResult: Trained {w} - {l} Random (draws: {d})")
    print(f"Win rate: {rate:.0%}")
    trained_vs_random = rate
    
    # === TEST 3: Untrained vs Random ===
    print("\n" + "=" * 60)
    print("TEST 3: UNTRAINED NN+MCTS vs RANDOM")
    print("=" * 60)
    print("This tests MCTS-only strength (random NN guidance)")
    
    w, l, d, rate, avg = run_match(
        untrained_net, None, num_games=20, p1_sims=200, p2_sims=0,
        p1_random=False, p2_random=True,
        p1_name="Untrained", p2_name="Random"
    )
    print(f"\nResult: Untrained {w} - {l} Random (draws: {d})")
    print(f"Win rate: {rate:.0%}")
    untrained_vs_random = rate
    
    # === TEST 4: Trained vs Untrained (THE KEY TEST) ===
    print("\n" + "=" * 60)
    print("TEST 4: TRAINED vs UNTRAINED (same MCTS sims)")
    print("=" * 60)
    print("This is the KEY test - does training actually help?")
    print("If trained doesn't beat untrained, the NN learned nothing useful.")
    
    w, l, d, rate, avg = run_match(
        trained_net, untrained_net, num_games=20, p1_sims=200, p2_sims=200,
        p1_name="Trained", p2_name="Untrained"
    )
    print(f"\nResult: Trained {w} - {l} Untrained (draws: {d})")
    print(f"Trained win rate: {rate:.0%}")
    trained_vs_untrained = rate
    
    # === SUMMARY ===
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Trained vs Random:    {trained_vs_random:.0%}")
    print(f"Untrained vs Random:  {untrained_vs_random:.0%}")
    print(f"Trained vs Untrained: {trained_vs_untrained:.0%}")
    
    print("\n" + "-" * 60)
    
    if trained_vs_untrained > 0.6:
        print("✓ GOOD: Training improved the network!")
        print("  The NN learned useful patterns beyond raw MCTS.")
    elif trained_vs_untrained > 0.45:
        print("~ NEUTRAL: Training had minimal effect")
        print("  The NN didn't learn much - wins are mostly from MCTS.")
    else:
        print("✗ BAD: Trained network is WORSE than untrained!")
        print("  Training corrupted the network. Something is wrong.")
    
    print()
    if untrained_vs_random > 0.7:
        print("NOTE: Untrained MCTS already beats random {:.0%} of the time.".format(untrained_vs_random))
        print("      MCTS alone is strong enough that NN improvements are hard to measure.")
        print("      Consider testing with fewer MCTS simulations (e.g., 50) to isolate NN effect.")


if __name__ == "__main__":
    main()
