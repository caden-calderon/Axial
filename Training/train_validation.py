"""
Quick validation training to verify AlphaZero is learning correctly.
Should achieve 80%+ win rate vs random in ~10-15 minutes.

FIXED VERSION - corrected import/function mismatches
"""
import os
import sys
import time
import random
import numpy as np
import torch

from Axial_BitBoard_Fast import FastBitBoard
from Axial_Network import NetworkWrapper
from Axial_MCTS_NN import NeuralMCTS
from Axial_Train import ReplayBuffer, Trainer, self_play_nn


def play_vs_random(network, num_games=20, network_sims=200, verbose=False):
    """Test network against random player."""
    network.eval_mode()
    
    wins = 0
    losses = 0
    draws = 0
    
    for i in range(num_games):
        # Alternate who goes first
        network_is_p1 = (i % 2 == 0)
        network_player = 1 if network_is_p1 else 2
        
        board = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
        mcts = NeuralMCTS(board, network, prev_player=2, c_puct=1.5)
        
        current_player = 1
        move_count = 0
        
        if verbose:
            print(f"\n--- Game {i+1}: Network is P{network_player} ---")
        
        while True:
            winner = board.check_win()
            if winner != 0:
                break
            
            valid_moves = board.get_valid_moves()
            if not valid_moves:
                winner = 0
                break
            
            is_network_turn = (current_player == network_player)
            
            if is_network_turn:
                # Network's turn
                move = mcts.search(num_simulations=network_sims, temperature=0.1)
                if verbose:
                    print(f"  Move {move_count}: P{current_player}(NET) -> {move}")
            else:
                # Random's turn
                move = random.choice(valid_moves)
                if verbose:
                    print(f"  Move {move_count}: P{current_player}(RND) -> {move}")
            
            board.make_move(move[0], move[1], current_player)
            
            # Update MCTS tree
            if not mcts.advance_root(move):
                mcts = NeuralMCTS(board, network, prev_player=current_player, c_puct=1.5)
            
            current_player = 3 - current_player
            move_count += 1
        
        # Score result
        if verbose:
            print(f"  Winner: P{winner} | Network was P{network_player}")
        
        if winner == 0:
            draws += 1
        elif winner == network_player:
            wins += 1
        else:
            losses += 1
    
    win_rate = wins / num_games
    return win_rate, wins, losses, draws


def train_validation():
    """
    Quick training to validate the system works.
    
    Target: 80%+ win rate vs random
    Expected time: 10-15 minutes
    """
    print("=" * 60)
    print("VALIDATION TRAINING")
    print("=" * 60)
    print("Goal: Prove network learns (80%+ win rate vs random)")
    print("=" * 60)
    
    # Small network for fast training
    network = NetworkWrapper(
        D=6, R=6, C=7,
        num_channels=64,
        num_res_blocks=2
    )
    print("\nNetwork: {} parameters".format(network.num_parameters))
    print("Device: {}".format(network.device))
    
    # Test baseline (untrained vs random) with verbose output to debug
    print("\n[Baseline] Testing untrained network vs random...")
    print("(Running with verbose=True for first 4 games to debug)")
    win_rate, w, l, d = play_vs_random(network, num_games=4, network_sims=100, verbose=True)
    print("\nBaseline sample: {:.0%} win rate ({}-{}-{})".format(win_rate, w, l, d))
    
    # Run full baseline test
    print("\nRunning full baseline (20 games, no verbose)...")
    win_rate, w, l, d = play_vs_random(network, num_games=20, network_sims=100, verbose=False)
    print("  Untrained: {:.0%} win rate ({}-{}-{})".format(win_rate, w, l, d))
    
    # If untrained network wins >80%, MCTS itself is too strong - need to reduce sims
    if win_rate > 0.8:
        print("\n*** WARNING: Untrained network already beats random!")
        print("*** This means MCTS alone (without learning) is very strong.")
        print("*** Reducing MCTS sims to make the test more meaningful...")
        test_sims = 50  # Reduce for testing
    else:
        test_sims = 200
    
    # FIXED: Use correct ReplayBuffer signature (no max_age)
    trainer = Trainer(network, learning_rate=0.002)
    buffer = ReplayBuffer(max_size=20000)
    
    checkpoint_dir = "checkpoints_validation"
    os.makedirs(checkpoint_dir, exist_ok=True)
    
    best_win_rate = win_rate
    
    # Training parameters - small but sufficient
    iterations = 8
    games_per_iter = 50
    sims_per_move = 200
    epochs_per_iter = 5
    
    print("\nTraining: {} iterations x {} games x {} sims".format(
        iterations, games_per_iter, sims_per_move))
    print("=" * 60)
    
    total_start = time.time()
    
    for iteration in range(1, iterations + 1):
        iter_start = time.time()
        
        print("\n--- Iteration {}/{} ---".format(iteration, iterations))
        
        # Self-play using neural network MCTS
        print("[1] Self-play ({} games)...".format(games_per_iter))
        play_start = time.time()
        
        # FIXED: Use self_play_nn from Axial_Train.py
        games = self_play_nn(
            network,
            num_games=games_per_iter,
            simulations_per_move=sims_per_move,
            verbose=True
        )
        
        play_time = time.time() - play_start
        
        # Add to buffer
        # FIXED: add_game takes only 3 arguments (states, policies, outcome)
        for game in games:
            buffer.add_game(game['states'], game['policies'], game['outcome'])
        
        # FIXED: remove_old_examples doesn't exist, removed call
        
        avg_moves = sum(g['num_moves'] for g in games) / len(games)
        print("  {} games in {:.1f}s | {:.1f} games/min | avg {:.0f} moves".format(
            len(games), play_time, len(games)/play_time*60, avg_moves))
        print("  Buffer: {} examples".format(len(buffer)))
        
        # Training
        print("[2] Training...")
        train_start = time.time()
        
        for epoch in range(epochs_per_iter):
            examples = buffer.sample(min(len(buffer), 4096))
            losses = trainer.train_epoch(examples, batch_size=64)
        
        train_time = time.time() - train_start
        print("  {} epochs in {:.1f}s | policy={:.4f}, value={:.4f}".format(
            epochs_per_iter, train_time, losses['policy_loss'], losses['value_loss']))
        
        # Test vs random every 2 iterations
        if iteration % 2 == 0 or iteration == iterations:
            print("[3] Testing vs random...")
            win_rate, w, l, d = play_vs_random(network, num_games=20, network_sims=test_sims)
            print("  Win rate: {:.0%} ({}-{}-{})".format(win_rate, w, l, d))
            
            if win_rate > best_win_rate:
                best_win_rate = win_rate
                network.save(os.path.join(checkpoint_dir, "network_best.pt"))
                print("  ★ New best!")
        
        iter_time = time.time() - iter_start
        print("  Iteration time: {:.1f}s".format(iter_time))
    
    total_time = time.time() - total_start
    
    # Final evaluation
    print("\n" + "=" * 60)
    print("FINAL EVALUATION")
    print("=" * 60)
    
    print("\nRunning 50-game evaluation...")
    win_rate, w, l, d = play_vs_random(network, num_games=50, network_sims=test_sims)
    
    print("\n" + "=" * 60)
    if win_rate >= 0.80:
        print("SUCCESS! Network achieves {:.0%} win rate vs random".format(win_rate))
        print("AlphaZero training is working correctly!")
    elif win_rate >= 0.60:
        print("PARTIAL SUCCESS: {:.0%} win rate".format(win_rate))
        print("Learning is happening but may need more training")
    else:
        print("FAILURE: Only {:.0%} win rate".format(win_rate))
        print("Something is still wrong with training")
    print("=" * 60)
    
    print("\nTotal time: {:.1f} minutes".format(total_time / 60))
    print("Final: {} wins, {} losses, {} draws".format(w, l, d))
    
    # Save final
    network.save(os.path.join(checkpoint_dir, "network_final.pt"))
    print("\nSaved to: {}/".format(checkpoint_dir))
    
    return network, win_rate


if __name__ == "__main__":
    train_validation()
