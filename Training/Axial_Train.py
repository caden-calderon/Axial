
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
from Axial_MCTS_NN import NeuralMCTS


@dataclass
class TrainingExample:
    """Single training example."""
    state: np.ndarray      # Board state
    policy: np.ndarray     # MCTS visit distribution (target)
    value: float           # Game outcome from current player's perspective
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
    
    def clear(self):
        """Clear the buffer."""
        self.buffer = []


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
            self.optimizer, step_size=50, gamma=0.9
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
            log_probs = F.log_softmax(policy_logits, dim=1)
            policy_loss = -torch.mean(torch.sum(target_policies * log_probs, dim=1))
            
            # Value loss: MSE
            value_loss = F.mse_loss(values, target_values)
            
            loss = policy_loss + value_loss
            
            self.optimizer.zero_grad()
            loss.backward()
            
            # Gradient clipping for stability
            torch.nn.utils.clip_grad_norm_(self.network.network.parameters(), 1.0)
            
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


def play_game_nn_mcts(
    network: NetworkWrapper,
    simulations_per_move: int = 400,
    temperature_moves: int = 15,
    c_puct: float = 1.5
) -> dict:
    """
    Play a single self-play game using Neural Network MCTS.
    
    The network guides which moves to explore, creating the feedback loop
    that makes AlphaZero work.
    
    Args:
        network: Neural network for position evaluation
        simulations_per_move: MCTS simulations per move
        temperature_moves: Use temperature=1 for first N moves (exploration)
        c_puct: Exploration constant
    
    Returns:
        dict with 'states', 'policies', 'outcome', 'num_moves'
    """
    D, R, C = network.D, network.R, network.C
    board = FastBitBoard(dimensions=(D, R, C), win_length=4)
    
    states = []
    policies = []
    current_player = 1
    move_count = 0
    
    # Create MCTS with network
    mcts = NeuralMCTS(board, network, prev_player=2, c_puct=c_puct)
    
    while True:
        # Check for game over
        winner = board.check_win()
        if winner != 0:
            break
        
        if not board.get_valid_moves():
            winner = 0
            break
        
        # Record state
        states.append(board.board.copy())
        
        # Choose temperature (more exploration early game)
        temp = 1.0 if move_count < temperature_moves else 0.1
        
        # Run MCTS with neural network guidance
        best_move = mcts.search(num_simulations=simulations_per_move, temperature=temp)
        
        # Record policy (visit distribution from MCTS)
        policy = mcts.get_policy()
        policies.append(policy)
        
        # Make move
        board.make_move(best_move[0], best_move[1], current_player)
        
        # Try to reuse tree, otherwise create new MCTS
        if not mcts.advance_root(best_move):
            mcts = NeuralMCTS(board, network, prev_player=current_player, c_puct=c_puct)
        
        current_player = 3 - current_player
        move_count += 1
    
    return {
        'states': states,
        'policies': policies,
        'outcome': winner,
        'num_moves': move_count
    }


def self_play_nn(
    network: NetworkWrapper,
    num_games: int,
    simulations_per_move: int = 400,
    temperature_moves: int = 15,
    verbose: bool = True
) -> List[dict]:
    """
    Run self-play games using neural network MCTS.
    
    This is the core of AlphaZero - the network plays against itself,
    generating training data that reflects its current (improving) policy.
    """
    network.eval_mode()
    results = []
    start_time = time.time()
    
    for i in range(num_games):
        game_start = time.time()
        
        game = play_game_nn_mcts(
            network,
            simulations_per_move=simulations_per_move,
            temperature_moves=temperature_moves
        )
        
        results.append(game)
        game_time = time.time() - game_start
        
        if verbose and (i + 1) % max(1, num_games // 10) == 0:
            elapsed = time.time() - start_time
            games_per_min = (i + 1) / elapsed * 60
            p1 = sum(1 for r in results if r['outcome'] == 1)
            p2 = sum(1 for r in results if r['outcome'] == 2)
            d = sum(1 for r in results if r['outcome'] == 0)
            avg_moves = sum(r['num_moves'] for r in results) / len(results)
            
            print("  Games: {}/{} | {:.1f} games/min | P1:{} P2:{} D:{} | Avg: {:.1f} moves | Last: {:.1f}s".format(
                i+1, num_games, games_per_min, p1, p2, d, avg_moves, game_time))
    
    return results


def train_alphazero(
    num_iterations: int = 20,
    games_per_iteration: int = 100,
    epochs_per_iteration: int = 10,
    simulations_per_move: int = 400,
    batch_size: int = 64,
    checkpoint_dir: str = "checkpoints",
    network_config: Optional[dict] = None,
    resume_from: Optional[str] = None
):
    """
    Main AlphaZero training loop.
    
    This is the REAL AlphaZero algorithm:
    1. Play games using current network to guide MCTS
    2. Train network on the games it just played
    3. Repeat - network gets stronger each iteration
    
    Args:
        num_iterations: Number of self-play + training cycles
        games_per_iteration: Games to generate per iteration
        epochs_per_iteration: Training epochs per iteration
        simulations_per_move: MCTS simulations per move
        batch_size: Training batch size
        checkpoint_dir: Directory to save checkpoints
        network_config: Network architecture config
        resume_from: Path to checkpoint to resume from
    """
    os.makedirs(checkpoint_dir, exist_ok=True)
    
    # Default network config
    if network_config is None:
        network_config = {
            'D': 6, 'R': 6, 'C': 7,
            'num_channels': 128,
            'num_res_blocks': 4
        }
    
    print("=" * 60)
    print("ALPHAZERO TRAINING FOR AXIAL")
    print("=" * 60)
    print("Network config: {}".format(network_config))
    print("Iterations: {}".format(num_iterations))
    print("Games/iteration: {}".format(games_per_iteration))
    print("Simulations/move: {}".format(simulations_per_move))
    print("Epochs/iteration: {}".format(epochs_per_iteration))
    print("=" * 60)
    
    # Create or load network
    network = NetworkWrapper(**network_config)
    start_iteration = 1
    
    if resume_from and os.path.exists(resume_from):
        print("Resuming from {}".format(resume_from))
        network.load(resume_from)
        # Try to extract iteration number from filename
        try:
            start_iteration = int(resume_from.split('_iter_')[1].split('.')[0]) + 1
        except:
            pass
    
    print("Network parameters: {:,}".format(network.num_parameters))
    print("Device: {}".format(network.device))
    
    trainer = Trainer(network, learning_rate=0.001)
    buffer = ReplayBuffer(max_size=100000)
    
    training_history = []
    best_policy_loss = float('inf')
    
    for iteration in range(start_iteration, num_iterations + 1):
        print()
        print("=" * 60)
        print("ITERATION {}/{}".format(iteration, num_iterations))
        print("=" * 60)
        
        # === SELF-PLAY PHASE ===
        print()
        print("[1] Self-play phase (Neural Network MCTS)...")
        print("    Network is playing against itself to generate training data")
        start_time = time.time()
        
        games = self_play_nn(
            network,
            num_games=games_per_iteration,
            simulations_per_move=simulations_per_move,
            verbose=True
        )
        
        self_play_time = time.time() - start_time
        
        # Add games to buffer
        for game in games:
            buffer.add_game(game['states'], game['policies'], game['outcome'])
        
        avg_moves = sum(g['num_moves'] for g in games) / len(games)
        p1_wins = sum(1 for g in games if g['outcome'] == 1)
        p2_wins = sum(1 for g in games if g['outcome'] == 2)
        
        print()
        print("  Self-play complete: {} games in {:.1f}s ({:.1f} games/min)".format(
            len(games), self_play_time, len(games) / self_play_time * 60))
        print("  Results: P1={}, P2={}, Draw={}".format(p1_wins, p2_wins, len(games)-p1_wins-p2_wins))
        print("  Buffer size: {} examples".format(len(buffer)))
        print("  Avg game length: {:.1f} moves".format(avg_moves))
        
        # === TRAINING PHASE ===
        print()
        print("[2] Training phase...")
        print("    Network learning from self-play games")
        start_time = time.time()
        
        epoch_losses = []
        for epoch in range(epochs_per_iteration):
            # Sample from entire buffer (not just this iteration)
            examples = buffer.sample(min(len(buffer), 8192))
            
            losses = trainer.train_epoch(examples, batch_size=batch_size)
            epoch_losses.append(losses)
            
            if (epoch + 1) % 2 == 0 or epoch == epochs_per_iteration - 1:
                print("  Epoch {}/{}: policy_loss={:.4f}, value_loss={:.4f}".format(
                    epoch+1, epochs_per_iteration, losses['policy_loss'], losses['value_loss']))
        
        training_time = time.time() - start_time
        final_losses = epoch_losses[-1]
        
        print("  Training complete in {:.1f}s".format(training_time))
        
        # Track improvement
        if final_losses['policy_loss'] < best_policy_loss:
            best_policy_loss = final_losses['policy_loss']
            best_path = os.path.join(checkpoint_dir, "network_best.pt")
            network.save(best_path)
            print("  * New best model! Policy loss: {:.4f}".format(best_policy_loss))
        
        # Save checkpoint
        checkpoint_path = os.path.join(checkpoint_dir, "network_iter_{}.pt".format(iteration))
        network.save(checkpoint_path)
        
        # Record history
        training_history.append({
            'iteration': iteration,
            'games': len(games),
            'buffer_size': len(buffer),
            'avg_game_length': avg_moves,
            'p1_wins': p1_wins,
            'p2_wins': p2_wins,
            'policy_loss': final_losses['policy_loss'],
            'value_loss': final_losses['value_loss'],
            'self_play_time': self_play_time,
            'training_time': training_time
        })
        
        # Print progress summary
        print()
        print("  Iteration {} summary:".format(iteration))
        print("    Policy loss: {:.4f} (best: {:.4f})".format(
            final_losses['policy_loss'], best_policy_loss))
        print("    Value loss:  {:.4f}".format(final_losses['value_loss']))
        print("    Total time:  {:.1f}s".format(self_play_time + training_time))
    
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
    print("Final model: {}".format(final_path))
    print("Best model:  {}".format(os.path.join(checkpoint_dir, "network_best.pt")))
    print("History:     {}".format(history_path))
    print()
    print("Policy loss progression:")
    for h in training_history:
        print("  Iter {}: {:.4f}".format(h['iteration'], h['policy_loss']))
    
    return network, training_history


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def train_easy():
    """Train easy AI (~10-15 minutes)"""
    return train_alphazero(
        num_iterations=10,
        games_per_iteration=50,
        epochs_per_iteration=5,
        simulations_per_move=200,
        checkpoint_dir="checkpoints_easy",
        network_config={
            'D': 6, 'R': 6, 'C': 7,
            'num_channels': 64,
            'num_res_blocks': 2
        }
    )


def train_medium():
    """Train medium AI (~30-45 minutes)"""
    return train_alphazero(
        num_iterations=20,
        games_per_iteration=75,
        epochs_per_iteration=8,
        simulations_per_move=300,
        checkpoint_dir="checkpoints_medium",
        network_config={
            'D': 6, 'R': 6, 'C': 7,
            'num_channels': 128,
            'num_res_blocks': 4
        }
    )


def train_hard():
    """Train hard AI (~2-3 hours)"""
    return train_alphazero(
        num_iterations=40,
        games_per_iteration=100,
        epochs_per_iteration=10,
        simulations_per_move=400,
        checkpoint_dir="checkpoints_hard",
        network_config={
            'D': 6, 'R': 6, 'C': 7,
            'num_channels': 128,
            'num_res_blocks': 4
        }
    )


def train_nightmare():
    """Train nightmare AI (~6-10 hours)"""
    return train_alphazero(
        num_iterations=100,
        games_per_iteration=150,
        epochs_per_iteration=10,
        simulations_per_move=600,
        checkpoint_dir="checkpoints_nightmare",
        network_config={
            'D': 6, 'R': 6, 'C': 7,
            'num_channels': 256,
            'num_res_blocks': 6
        }
    )


def quick_test():
    """Quick test to verify training works (~2-3 minutes)"""
    return train_alphazero(
        num_iterations=3,
        games_per_iteration=20,
        epochs_per_iteration=3,
        simulations_per_move=100,
        checkpoint_dir="checkpoints_test",
        network_config={
            'D': 6, 'R': 6, 'C': 7,
            'num_channels': 64,
            'num_res_blocks': 2
        }
    )


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        
        if cmd == "test":
            quick_test()
        elif cmd == "easy":
            train_easy()
        elif cmd == "medium":
            train_medium()
        elif cmd == "hard":
            train_hard()
        elif cmd == "nightmare":
            train_nightmare()
        elif cmd == "custom":
            # Custom training: python Axial_Train.py custom <iterations> <games> <sims>
            iters = int(sys.argv[2]) if len(sys.argv) > 2 else 10
            games = int(sys.argv[3]) if len(sys.argv) > 3 else 50
            sims = int(sys.argv[4]) if len(sys.argv) > 4 else 400
            train_alphazero(
                num_iterations=iters,
                games_per_iteration=games,
                simulations_per_move=sims
            )
        elif cmd == "resume":
            # Resume training: python Axial_Train.py resume <checkpoint_path> <total_iterations>
            checkpoint = sys.argv[2] if len(sys.argv) > 2 else "checkpoints/network_final.pt"
            total_iters = int(sys.argv[3]) if len(sys.argv) > 3 else 20
            train_alphazero(
                num_iterations=total_iters,
                resume_from=checkpoint
            )
        else:
            print("Unknown command: {}".format(cmd))
            print("Available: test, easy, medium, hard, nightmare, custom, resume")
    else:
        print("AlphaZero Training for Axial")
        print()
        print("Usage:")
        print("  python Axial_Train.py test       # Quick test (~2-3 min)")
        print("  python Axial_Train.py easy       # Easy AI (~10-15 min)")
        print("  python Axial_Train.py medium     # Medium AI (~30-45 min)")
        print("  python Axial_Train.py hard       # Hard AI (~2-3 hours)")
        print("  python Axial_Train.py nightmare  # Nightmare AI (~6-10 hours)")
        print()
        print("  python Axial_Train.py custom <iters> <games> <sims>")
        print("  python Axial_Train.py resume <checkpoint> <total_iters>")
        print()
        print("Running quick test...")
        quick_test()
