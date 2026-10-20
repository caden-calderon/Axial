"""
Training pipeline for Axial neural network.

This implements the AlphaZero-style training loop:
1. Self-play: Generate games using MCTS + current network
2. Training: Update network to predict MCTS policies and game outcomes
3. Repeat
"""
import os
import time
import random
import pickle
from dataclasses import dataclass
from typing import List, Optional, Tuple
import multiprocessing as mp

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

from Axial_BitBoard_Fast import FastBitBoard
from Axial_Network import NetworkWrapper, board_to_tensor
from Axial_MCTS_NN import NeuralMCTS, play_game_with_network
from Axial_SelfPlay_Parallel import parallel_self_play, sequential_self_play, GameRecord


@dataclass
class TrainingExample:
    """Single training example."""
    state: np.ndarray      # Board state
    policy: np.ndarray     # MCTS visit distribution (target for policy head)
    value: float           # Game outcome (target for value head)
    current_player: int    # Who was to move


class ReplayBuffer:
    """Buffer for storing training examples with sliding window."""
    
    def __init__(self, max_size: int = 100000):
        self.buffer = []
        self.max_size = max_size
    
    def add_game(self, states: List[np.ndarray], policies: List[np.ndarray], outcome: int):
        """Add a game's worth of examples to buffer."""
        current_player = 1
        
        for state, policy in zip(states, policies):
            if outcome == 0:
                value = 0.0
            elif outcome == current_player:
                value = 1.0
            else:
                value = -1.0
            
            example = TrainingExample(
                state=state.copy(),
                policy=policy.copy(),
                value=value,
                current_player=current_player
            )
            self.buffer.append(example)
            current_player = 3 - current_player
        
        if len(self.buffer) > self.max_size:
            self.buffer = self.buffer[-self.max_size:]
    
    def sample(self, batch_size: int) -> List[TrainingExample]:
        """Sample random batch of examples."""
        return random.sample(self.buffer, min(batch_size, len(self.buffer)))
    
    def __len__(self):
        return len(self.buffer)


class AxialDataset(Dataset):
    """PyTorch Dataset wrapper for training examples."""
    
    def __init__(self, examples: List[TrainingExample], D=6, R=6, C=7):
        self.examples = examples
        self.D = D
        self.R = R
        self.C = C
    
    def __len__(self):
        return len(self.examples)
    
    def __getitem__(self, idx):
        ex = self.examples[idx]
        
        us = ex.current_player
        them = 3 - us
        
        tensor = np.zeros((2 * self.D, self.R, self.C), dtype=np.float32)
        
        for c in range(self.C):
            for r in range(self.R):
                for h in range(self.D):
                    cell_idx = h + r * self.D + c * self.D * self.R
                    cell = ex.state[cell_idx]
                    
                    if cell == us:
                        tensor[h, r, c] = 1.0
                    elif cell == them:
                        tensor[self.D + h, r, c] = 1.0
        
        return (
            torch.from_numpy(tensor),
            torch.from_numpy(ex.policy.astype(np.float32)),
            torch.tensor([ex.value], dtype=torch.float32)
        )


class Trainer:
    """Handles training loop for the neural network."""
    
    def __init__(self, network: NetworkWrapper, 
                 learning_rate: float = 0.001,
                 weight_decay: float = 1e-4):
        
        self.network = network
        self.device = network.device
        
        self.optimizer = torch.optim.Adam(
            network.network.parameters(),
            lr=learning_rate,
            weight_decay=weight_decay
        )
        
        self.scheduler = torch.optim.lr_scheduler.StepLR(
            self.optimizer, step_size=100, gamma=0.95
        )
    
    def train_epoch(self, examples: List[TrainingExample], batch_size: int = 64) -> dict:
        """Train for one epoch on given examples."""
        self.network.train_mode()
        
        dataset = AxialDataset(examples, self.network.D, self.network.R, self.network.C)
        loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
        
        total_policy_loss = 0.0
        total_value_loss = 0.0
        num_batches = 0
        
        for states, target_policies, target_values in loader:
            states = states.to(self.device)
            target_policies = target_policies.to(self.device)
            target_values = target_values.to(self.device)
            
            policy_logits, values = self.network.network(states)
            
            # Policy loss: cross-entropy with soft targets
            policy_loss = -torch.mean(
                torch.sum(target_policies * F.log_softmax(policy_logits, dim=1), dim=1)
            )
            
            # Value loss: MSE
            value_loss = F.mse_loss(values, target_values)
            
            loss = policy_loss + value_loss
            
            self.optimizer.zero_grad()
            loss.backward()
            self.optimizer.step()
            
            total_policy_loss += policy_loss.item()
            total_value_loss += value_loss.item()
            num_batches += 1
        
        self.scheduler.step()
        
        return {
            'policy_loss': total_policy_loss / num_batches,
            'value_loss': total_value_loss / num_batches,
            'total_loss': (total_policy_loss + total_value_loss) / num_batches
        }


def generate_training_games(
    num_games: int,
    simulations_per_move: int = 400,
    num_workers: int = None,
    verbose: bool = True
) -> List[dict]:
    """
    Generate training games using FAST parallel rollout-based MCTS.
    
    This is much faster than NN-based self-play because:
    1. Numba-accelerated rollouts (~10,000+ sims/sec)
    2. Runs in parallel across all CPU cores
    3. No neural network inference overhead
    
    Returns list of dicts with 'states', 'policies', 'outcome', 'num_moves'
    """
    # Use the fast parallel self-play
    game_records = parallel_self_play(
        num_games=num_games,
        num_workers=num_workers,
        simulations_per_move=simulations_per_move,
        progress_interval=max(1, num_games // 10)
    )
    
    # Convert GameRecord objects to dicts for compatibility
    results = []
    for record in game_records:
        results.append({
            'states': record.states,
            'policies': record.policies,
            'outcome': record.outcome,
            'num_moves': record.num_moves
        })
    
    return results


def train_network(
    num_iterations: int = 10,
    games_per_iteration: int = 100,
    epochs_per_iteration: int = 5,
    simulations_per_move: int = 400,
    batch_size: int = 64,
    checkpoint_dir: str = "checkpoints",
    network_config: Optional[dict] = None
):
    """
    Main training loop.
    """
    os.makedirs(checkpoint_dir, exist_ok=True)
    
    if network_config is None:
        network_config = {
            'D': 6, 'R': 6, 'C': 7,
            'num_channels': 128,
            'num_res_blocks': 4
        }
    
    print("=" * 60)
    print("AXIAL NEURAL NETWORK TRAINING")
    print("=" * 60)
    print("Network config: {}".format(network_config))
    print("Iterations: {}".format(num_iterations))
    print("Games/iteration: {}".format(games_per_iteration))
    print("Simulations/move: {}".format(simulations_per_move))
    print("=" * 60)
    
    network = NetworkWrapper(**network_config)
    print("Network parameters: {:,}".format(network.num_parameters))
    print("Device: {}".format(network.device))
    
    trainer = Trainer(network)
    buffer = ReplayBuffer(max_size=50000)
    
    training_history = []
    
    for iteration in range(1, num_iterations + 1):
        print()
        print("=" * 60)
        print("ITERATION {}/{}".format(iteration, num_iterations))
        print("=" * 60)
        
        # Self-play phase (uses FAST parallel rollout MCTS)
        print()
        print("[1] Self-play phase (parallel rollout MCTS)...")
        start_time = time.time()
        
        games = generate_training_games(
            num_games=games_per_iteration,
            simulations_per_move=simulations_per_move,
            verbose=True
        )
        
        self_play_time = time.time() - start_time
        
        # Add games to buffer
        for game in games:
            buffer.add_game(game['states'], game['policies'], game['outcome'])
        
        avg_moves = sum(g['num_moves'] for g in games) / len(games)
        print("  Self-play complete: {} games in {:.1f}s".format(len(games), self_play_time))
        print("  Buffer size: {} examples".format(len(buffer)))
        print("  Avg game length: {:.1f} moves".format(avg_moves))
        
        # Training phase
        print()
        print("[2] Training phase...")
        start_time = time.time()
        
        for epoch in range(epochs_per_iteration):
            examples = buffer.sample(min(len(buffer), 4096))
            losses = trainer.train_epoch(examples, batch_size=batch_size)
            
            if (epoch + 1) % 2 == 0 or epoch == epochs_per_iteration - 1:
                print("  Epoch {}/{}: policy_loss={:.4f}, value_loss={:.4f}".format(
                    epoch+1, epochs_per_iteration, losses['policy_loss'], losses['value_loss']))
        
        training_time = time.time() - start_time
        print("  Training complete in {:.1f}s".format(training_time))
        
        # Save checkpoint
        checkpoint_path = os.path.join(checkpoint_dir, "network_iter_{}.pt".format(iteration))
        network.save(checkpoint_path)
        
        training_history.append({
            'iteration': iteration,
            'games': len(games),
            'buffer_size': len(buffer),
            'avg_game_length': avg_moves,
            'policy_loss': losses['policy_loss'],
            'value_loss': losses['value_loss'],
            'self_play_time': self_play_time,
            'training_time': training_time
        })
    
    # Save final model
    final_path = os.path.join(checkpoint_dir, "network_final.pt")
    network.save(final_path)
    
    # Save training history
    history_path = os.path.join(checkpoint_dir, "training_history.pkl")
    with open(history_path, 'wb') as f:
        pickle.dump(training_history, f)
    
    print()
    print("=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)
    print("Final model saved to: {}".format(final_path))
    print("Training history saved to: {}".format(history_path))
    
    return network, training_history


def quick_train(num_games: int = 50, num_iterations: int = 3):
    """Quick training run for testing."""
    print("=" * 60)
    print("QUICK TRAINING TEST")
    print("=" * 60)
    
    network, history = train_network(
        num_iterations=num_iterations,
        games_per_iteration=num_games,
        epochs_per_iteration=3,
        simulations_per_move=200,
        batch_size=32,
        checkpoint_dir="checkpoints_test",
        network_config={
            'D': 6, 'R': 6, 'C': 7,
            'num_channels': 64,
            'num_res_blocks': 2
        }
    )
    
    return network, history


def evaluate_network(network_path: str, num_games: int = 10):
    """Evaluate a trained network by playing games."""
    print("Loading network from {}...".format(network_path))
    
    checkpoint = torch.load(network_path, map_location='cpu', weights_only=False)
    config = checkpoint['config']
    
    network = NetworkWrapper(**config)
    network.load(network_path)
    network.eval_mode()
    
    print("Network loaded. Playing {} evaluation games...".format(num_games))
    
    results = {'P1': 0, 'P2': 0, 'Draw': 0}
    total_moves = 0
    
    for i in range(num_games):
        game = play_game_with_network(
            network,
            simulations_per_move=400,
            temperature_moves=0,
            verbose=False
        )
        
        if game['outcome'] == 1:
            results['P1'] += 1
        elif game['outcome'] == 2:
            results['P2'] += 1
        else:
            results['Draw'] += 1
        
        total_moves += game['num_moves']
        print("  Game {}: P{} wins in {} moves".format(i+1, game['outcome'], game['num_moves']))
    
    print()
    print("Results: P1={}, P2={}, Draw={}".format(results['P1'], results['P2'], results['Draw']))
    print("Avg game length: {:.1f} moves".format(total_moves/num_games))


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "quick":
            quick_train()
        elif sys.argv[1] == "train":
            num_iter = int(sys.argv[2]) if len(sys.argv) > 2 else 10
            games = int(sys.argv[3]) if len(sys.argv) > 3 else 100
            train_network(num_iterations=num_iter, games_per_iteration=games)
        elif sys.argv[1] == "eval":
            path = sys.argv[2] if len(sys.argv) > 2 else "checkpoints/network_final.pt"
            evaluate_network(path)
    else:
        quick_train(num_games=20, num_iterations=2)
