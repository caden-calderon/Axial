"""
Diagnostic script to test if trained models work correctly.
Tests: random vs random, trained vs random, trained vs trained
"""
import sys
import os
import time
import numpy as np
import torch

from Axial_BitBoard_Fast import FastBitBoard
from Axial_Network import NetworkWrapper
from Axial_MCTS_NN import NeuralMCTS


def play_one_game(p1_network, p2_network, p1_sims=200, p2_sims=200, verbose=False):
    """Play a single game between two networks."""
    board = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    
    p1_mcts = NeuralMCTS(board, p1_network, prev_player=2, c_puct=1.5)
    p2_mcts = NeuralMCTS(board, p2_network, prev_player=2, c_puct=1.5)
    
    current_player = 1
    move_count = 0
    
    while True:
        winner = board.check_win()
        if winner != 0:
            break
        if not board.get_valid_moves():
            return 0, move_count  # Draw
        
        if current_player == 1:
            mcts = p1_mcts
            sims = p1_sims
        else:
            mcts = p2_mcts
            sims = p2_sims
        
        move = mcts.search(num_simulations=sims, temperature=0.1)
        
        if verbose:
            print("P{} plays: {}".format(current_player, move))
        
        board.make_move(move[0], move[1], current_player)
        
        # Update both MCTS trees
        if not p1_mcts.advance_root(move):
            p1_mcts = NeuralMCTS(board, p1_network, prev_player=current_player, c_puct=1.5)
        if not p2_mcts.advance_root(move):
            p2_mcts = NeuralMCTS(board, p2_network, prev_player=current_player, c_puct=1.5)
        
        current_player = 3 - current_player
        move_count += 1
    
    return winner, move_count


def run_match(p1_network, p2_network, num_games=20, p1_sims=200, p2_sims=200, 
              p1_name="P1", p2_name="P2"):
    """Run a match between two networks."""
    p1_wins = 0
    p2_wins = 0
    draws = 0
    
    print("\n{} vs {} ({} games, {} vs {} sims)".format(p1_name, p2_name, num_games, p1_sims, p2_sims))
    print("-" * 50)
    
    start = time.time()
    
    for i in range(num_games):
        # Alternate who goes first
        if i % 2 == 0:
            winner, moves = play_one_game(p1_network, p2_network, p1_sims, p2_sims)
            if winner == 1:
                p1_wins += 1
            elif winner == 2:
                p2_wins += 1
            else:
                draws += 1
        else:
            # Swap sides
            winner, moves = play_one_game(p2_network, p1_network, p2_sims, p1_sims)
            if winner == 1:
                p2_wins += 1  # P2 was playing as P1
            elif winner == 2:
                p1_wins += 1  # P1 was playing as P2
            else:
                draws += 1
        
        if (i + 1) % 5 == 0:
            print("  Game {}/{}: {} {} - {} {} (draws: {})".format(
                i+1, num_games, p1_name, p1_wins, p2_wins, p2_name, draws))
    
    elapsed = time.time() - start
    
    print("-" * 50)
    print("RESULT: {} {} - {} {} (draws: {})".format(p1_name, p1_wins, p2_wins, p2_name, draws))
    print("Win rate for {}: {:.1%}".format(p1_name, p1_wins / num_games))
    print("Time: {:.1f}s ({:.1f} games/min)".format(elapsed, num_games / elapsed * 60))
    
    return p1_wins, p2_wins, draws


def test_network_output(network, name="Network"):
    """Test that network produces sensible outputs."""
    print("\nTesting {} outputs...".format(name))
    
    board = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    
    # Get network prediction for empty board
    # predict() expects the raw board array, not the FastBitBoard object
    policy, value = network.predict(board.board, current_player=1)
    
    print("  Policy shape: {}".format(policy.shape))
    print("  Policy sum: {:.4f} (should be ~1.0)".format(policy.sum()))
    print("  Policy max: {:.4f} at move {}".format(policy.max(), policy.argmax()))
    print("  Policy min: {:.4f}".format(policy.min()))
    print("  Policy std: {:.4f} (higher = more decisive)".format(policy.std()))
    print("  Value: {:.4f} (should be between -1 and 1)".format(value))
    
    # Check if policy is uniform (random network) or focused (trained)
    uniform_prob = 1.0 / 42  # 42 possible moves
    max_prob = policy.max()
    
    if max_prob > uniform_prob * 3:
        print("  Policy looks TRAINED (focused on specific moves)")
    else:
        print("  Policy looks RANDOM (roughly uniform)")
    
    return policy, value


def main():
    print("=" * 60)
    print("AXIAL MODEL DIAGNOSTICS")
    print("=" * 60)
    
    # Find available models
    model_paths = []
    candidates = [
        ("Hard Best", "checkpoints_hard/network_best.pt"),
        ("Hard Final", "checkpoints_hard/network_final.pt"),
        ("Easy Best", "checkpoints_easy/network_best.pt"),
        ("Easy Final", "checkpoints_easy/network_final.pt"),
    ]
    
    for name, path in candidates:
        if os.path.exists(path):
            model_paths.append((name, path))
            print("Found: {} -> {}".format(name, path))
    
    if not model_paths:
        print("No trained models found!")
        return
    
    # Create random network for comparison
    print("\nCreating random (untrained) network...")
    random_net = NetworkWrapper(D=6, R=6, C=7, num_channels=64, num_res_blocks=2)
    
    # Test random network outputs
    test_network_output(random_net, "Random")
    
    # Load and test trained networks
    trained_nets = []
    for name, path in model_paths:
        print("\n" + "=" * 60)
        print("Loading: {}".format(path))
        
        # Try to load with same architecture detection as adversarial training
        checkpoint = torch.load(path, map_location='cpu')
        state_dict = checkpoint['state_dict'] if 'state_dict' in checkpoint else checkpoint
        
        # Detect architecture
        num_channels = 128
        num_blocks = 0  # Start at 0, detect actual count
        
        for key in state_dict:
            if 'conv' in key and 'weight' in key and 'res_blocks' not in key:
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
            num_blocks = 4  # Fallback only if detection failed completely
        
        print("Detected: {} channels, {} res blocks".format(num_channels, num_blocks))
        
        net = NetworkWrapper(D=6, R=6, C=7, num_channels=num_channels, num_res_blocks=num_blocks)
        net.load(path)
        net.eval_mode()
        
        test_network_output(net, name)
        trained_nets.append((name, net))
    
    # Run comparison matches
    print("\n" + "=" * 60)
    print("RUNNING COMPARISON MATCHES")
    print("=" * 60)
    
    # Test 1: Random vs Random (should be ~50/50)
    print("\n[Test 1] Random vs Random (expect ~50/50)")
    random_net2 = NetworkWrapper(D=6, R=6, C=7, num_channels=64, num_res_blocks=2)
    run_match(random_net, random_net2, num_games=10, p1_sims=100, p2_sims=100,
              p1_name="Random1", p2_name="Random2")
    
    # Test 2: Trained vs Random (trained should win most)
    if trained_nets:
        name, trained = trained_nets[0]
        print("\n[Test 2] {} vs Random (expect trained to dominate)".format(name))
        run_match(trained, random_net, num_games=10, p1_sims=200, p2_sims=200,
                  p1_name=name, p2_name="Random")
    
    # Test 3: Trained vs itself (should be ~50/50)
    if trained_nets:
        name, trained = trained_nets[0]
        print("\n[Test 3] {} vs itself (expect ~50/50)".format(name))
        run_match(trained, trained, num_games=10, p1_sims=200, p2_sims=200,
                  p1_name=name+"_1", p2_name=name+"_2")
    
    print("\n" + "=" * 60)
    print("DIAGNOSTICS COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()