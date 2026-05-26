"""
Adversarial Training for Axial.

Train a new network by playing against an existing trained model.
This can help the new network learn faster by:
1. Playing against a consistent, reasonable opponent
2. Learning from the teacher's responses
3. Focusing on exploiting weaknesses

Usage:
    python Axial_Train_Adversarial.py checkpoints_hard/network_best.pt
    python Axial_Train_Adversarial.py checkpoints_hard/network_best.pt --iterations 30
"""
import os
import sys
import time
import random
import pickle
import argparse
from dataclasses import dataclass
from typing import List, Optional, Tuple

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
    state: np.ndarray
    policy: np.ndarray
    value: float
    current_player: int
    iteration: int


class ReplayBuffer:
    """Replay buffer with staleness management."""
    
    def __init__(self, max_size: int = 100000, max_age: int = 10):
        self.buffer = []
        self.max_size = max_size
        self.max_age = max_age
    
    def add_game(self, states: List[np.ndarray], policies: List[np.ndarray], 
                 outcome: int, iteration: int, student_player: int):
        """
        Add a game's worth of examples to buffer.
        Only adds examples from the student's perspective.
        """
        current_player = 1
        
        for state, policy in zip(states, policies):
            # Only learn from positions where student was to move
            if current_player == student_player:
                if outcome == 0:
                    value = 0.0
                elif outcome == student_player:
                    value = 1.0
                else:
                    value = -1.0
                
                example = TrainingExample(
                    state=state.copy(),
                    policy=policy.copy(),
                    value=value,
                    current_player=current_player,
                    iteration=iteration
                )
                self.buffer.append(example)
            
            current_player = 3 - current_player
        
        if len(self.buffer) > self.max_size:
            self.buffer = self.buffer[-self.max_size:]
    
    def remove_old_examples(self, current_iteration: int):
        """Remove examples older than max_age iterations."""
        min_iter = current_iteration - self.max_age
        old_size = len(self.buffer)
        self.buffer = [ex for ex in self.buffer if ex.iteration >= min_iter]
        removed = old_size - len(self.buffer)
        if removed > 0:
            print("    Removed {} stale examples".format(removed))
    
    def sample(self, batch_size: int) -> List[TrainingExample]:
        return random.sample(self.buffer, min(batch_size, len(self.buffer)))
    
    def __len__(self):
        return len(self.buffer)


class AxialDataset(Dataset):
    """PyTorch Dataset wrapper."""
    
    def __init__(self, examples: List[TrainingExample], D=6, R=6, C=7):
        self.examples = examples
        self.D, self.R, self.C = D, R, C
    
    def __len__(self):
        return len(self.examples)
    
    def __getitem__(self, idx):
        ex = self.examples[idx]
        us, them = ex.current_player, 3 - ex.current_player
        
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
    """Training handler with LR scheduling."""
    
    def __init__(self, network: NetworkWrapper, learning_rate: float = 0.001,
                 weight_decay: float = 1e-4, lr_decay_patience: int = 3,
                 lr_decay_factor: float = 0.5, min_lr: float = 1e-5):
        self.network = network
        self.device = network.device
        self.min_lr = min_lr
        self.lr_decay_factor = lr_decay_factor
        self.lr_decay_patience = lr_decay_patience
        
        self.optimizer = torch.optim.Adam(
            network.network.parameters(), lr=learning_rate, weight_decay=weight_decay
        )
        
        self.best_loss = float('inf')
        self.patience_counter = 0
        self.current_lr = learning_rate
    
    def maybe_decay_lr(self, current_loss: float) -> bool:
        if current_loss < self.best_loss:
            self.best_loss = current_loss
            self.patience_counter = 0
            return False
        
        self.patience_counter += 1
        if self.patience_counter >= self.lr_decay_patience:
            new_lr = max(self.current_lr * self.lr_decay_factor, self.min_lr)
            if new_lr < self.current_lr:
                for pg in self.optimizer.param_groups:
                    pg['lr'] = new_lr
                self.current_lr = new_lr
                self.patience_counter = 0
                return True
        return False
    
    def train_epoch(self, examples: List[TrainingExample], batch_size: int = 64) -> dict:
        self.network.train_mode()
        dataset = AxialDataset(examples, self.network.D, self.network.R, self.network.C)
        loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
        
        total_policy_loss, total_value_loss, num_batches = 0.0, 0.0, 0
        
        for states, target_policies, target_values in loader:
            states = states.to(self.device)
            target_policies = target_policies.to(self.device)
            target_values = target_values.to(self.device)
            
            policy_logits, values = self.network.network(states)
            
            log_probs = F.log_softmax(policy_logits, dim=1)
            policy_loss = -torch.mean(torch.sum(target_policies * log_probs, dim=1))
            value_loss = F.mse_loss(values, target_values)
            
            loss = policy_loss + value_loss
            
            self.optimizer.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(self.network.network.parameters(), 1.0)
            self.optimizer.step()
            
            total_policy_loss += policy_loss.item()
            total_value_loss += value_loss.item()
            num_batches += 1
        
        return {
            'policy_loss': total_policy_loss / num_batches,
            'value_loss': total_value_loss / num_batches,
            'lr': self.current_lr
        }


def play_game_adversarial(
    student: NetworkWrapper,
    teacher: NetworkWrapper,
    student_player: int = 1,
    student_sims: int = 400,
    teacher_sims: int = 400,
    temperature_moves: int = 15
) -> dict:
    """
    Play a game between student and teacher networks.
    Returns training data from the student's perspective.
    """
    D, R, C = student.D, student.R, student.C
    board = FastBitBoard(dimensions=(D, R, C), win_length=4)
    
    states = []
    policies = []
    current_player = 1
    move_count = 0
    
    # Create MCTS for both players
    student_mcts = NeuralMCTS(board, student, prev_player=2, c_puct=1.5)
    teacher_mcts = NeuralMCTS(board, teacher, prev_player=2, c_puct=1.5)
    
    while True:
        winner = board.check_win()
        if winner != 0:
            break
        if not board.get_valid_moves():
            winner = 0
            break
        
        # Record state
        states.append(board.board.copy())
        
        # Temperature for exploration
        temp = 1.0 if move_count < temperature_moves else 0.1
        
        if current_player == student_player:
            # Student's turn
            best_move = student_mcts.search(num_simulations=student_sims, temperature=temp)
            policy = student_mcts.get_policy()
        else:
            # Teacher's turn
            best_move = teacher_mcts.search(num_simulations=teacher_sims, temperature=temp)
            policy = teacher_mcts.get_policy()
        
        policies.append(policy)
        board.make_move(best_move[0], best_move[1], current_player)
        
        # Update MCTS trees
        if not student_mcts.advance_root(best_move):
            student_mcts = NeuralMCTS(board, student, prev_player=current_player, c_puct=1.5)
        if not teacher_mcts.advance_root(best_move):
            teacher_mcts = NeuralMCTS(board, teacher, prev_player=current_player, c_puct=1.5)
        
        current_player = 3 - current_player
        move_count += 1
    
    return {
        'states': states,
        'policies': policies,
        'outcome': winner,
        'num_moves': move_count,
        'student_player': student_player
    }


def adversarial_self_play(
    student: NetworkWrapper,
    teacher: NetworkWrapper,
    num_games: int,
    student_sims: int = 400,
    teacher_sims: int = 400,
    verbose: bool = True
) -> Tuple[List[dict], dict]:
    """
    Run adversarial games between student and teacher.
    Student plays as both P1 and P2 (alternating).
    """
    student.eval_mode()
    teacher.eval_mode()
    
    results = []
    student_wins = 0
    teacher_wins = 0
    draws = 0
    
    start_time = time.time()
    
    for i in range(num_games):
        # Alternate who goes first
        student_player = 1 if i % 2 == 0 else 2
        
        game = play_game_adversarial(
            student, teacher,
            student_player=student_player,
            student_sims=student_sims,
            teacher_sims=teacher_sims
        )
        
        results.append(game)
        
        # Track results
        if game['outcome'] == 0:
            draws += 1
        elif game['outcome'] == student_player:
            student_wins += 1
        else:
            teacher_wins += 1
        
        if verbose and (i + 1) % max(1, num_games // 10) == 0:
            elapsed = time.time() - start_time
            games_per_min = (i + 1) / elapsed * 60
            win_rate = student_wins / (i + 1) * 100
            print("  Games: {}/{} | {:.1f}/min | Student: {} Teacher: {} Draw: {} | Win rate: {:.1f}%".format(
                i+1, num_games, games_per_min, student_wins, teacher_wins, draws, win_rate))
    
    stats = {
        'student_wins': student_wins,
        'teacher_wins': teacher_wins,
        'draws': draws,
        'win_rate': student_wins / num_games
    }
    
    return results, stats


def train_adversarial(
    teacher_path: str,
    num_iterations: int = 30,
    games_per_iteration: int = 100,
    epochs_per_iteration: int = 10,
    student_sims: int = 400,
    teacher_sims: int = 600,  # Teacher gets more sims (stronger)
    checkpoint_dir: str = "checkpoints_adversarial",
    student_config: Optional[dict] = None,
    early_stop_patience: int = 10,
    min_iterations: int = 10,
    target_win_rate: float = 0.55,  # Stop if student consistently beats teacher
):
    """
    Train a new network by playing against an existing teacher.
    
    Args:
        teacher_path: Path to the teacher model
        num_iterations: Max training iterations
        games_per_iteration: Games per iteration
        epochs_per_iteration: Training epochs per iteration
        student_sims: MCTS sims for student during training
        teacher_sims: MCTS sims for teacher (higher = harder opponent)
        checkpoint_dir: Where to save checkpoints
        student_config: Network config for student (default: same as teacher)
        early_stop_patience: Stop if no improvement for N iterations
        min_iterations: Minimum iterations before early stopping
        target_win_rate: If student achieves this win rate, training succeeds
    """
    os.makedirs(checkpoint_dir, exist_ok=True)
    
    # Load teacher
    print("=" * 60)
    print("ADVERSARIAL TRAINING")
    print("=" * 60)
    print("Loading teacher: {}".format(teacher_path))
    
    # Detect teacher config
    checkpoint = torch.load(teacher_path, map_location='cpu')
    state_dict = checkpoint['state_dict'] if 'state_dict' in checkpoint else checkpoint
    
    teacher_channels = 128
    teacher_blocks = 0  # Start at 0, detect actual count
    
    for key in state_dict:
        if 'conv' in key and 'weight' in key and 'res_blocks' not in key:
            teacher_channels = state_dict[key].shape[0]
            break
    
    for key in state_dict:
        if 'res_blocks' in key:
            parts = key.split('.')
            for i, p in enumerate(parts):
                if p == 'res_blocks' and i + 1 < len(parts):
                    try:
                        teacher_blocks = max(teacher_blocks, int(parts[i + 1]) + 1)
                    except ValueError:
                        pass
    
    if teacher_blocks == 0:
        teacher_blocks = 4  # Fallback only if detection failed
    
    teacher = NetworkWrapper(D=6, R=6, C=7, num_channels=teacher_channels, num_res_blocks=teacher_blocks)
    teacher.load(teacher_path)
    teacher.eval_mode()
    print("Teacher: {} channels, {} blocks".format(teacher_channels, teacher_blocks))
    
    # Create student (larger network to have more capacity)
    if student_config is None:
        student_config = {
            'D': 6, 'R': 6, 'C': 7,
            'num_channels': 192,  # Larger than teacher
            'num_res_blocks': 6
        }
    
    print()
    print("Student config: {}".format(student_config))
    print("Teacher sims: {} | Student sims: {}".format(teacher_sims, student_sims))
    print("Target win rate: {:.0%}".format(target_win_rate))
    print("=" * 60)
    
    student = NetworkWrapper(**student_config)
    print("Student parameters: {:,}".format(student.num_parameters))
    print("Device: {}".format(student.device))
    
    trainer = Trainer(student, learning_rate=0.001)
    buffer = ReplayBuffer(max_size=80000, max_age=8)
    
    training_history = []
    best_win_rate = 0.0
    best_iteration = 0
    no_improvement_count = 0
    
    for iteration in range(1, num_iterations + 1):
        print()
        print("=" * 60)
        print("ITERATION {}/{} (best win rate: {:.1%} @ iter {})".format(
            iteration, num_iterations, best_win_rate, best_iteration))
        print("=" * 60)
        
        # === ADVERSARIAL PLAY ===
        print()
        print("[1] Playing against teacher...")
        start_time = time.time()
        
        games, stats = adversarial_self_play(
            student, teacher,
            num_games=games_per_iteration,
            student_sims=student_sims,
            teacher_sims=teacher_sims,
            verbose=True
        )
        
        play_time = time.time() - start_time
        
        # Add games to buffer
        for game in games:
            buffer.add_game(
                game['states'], game['policies'], game['outcome'],
                iteration, game['student_player']
            )
        
        buffer.remove_old_examples(iteration)
        
        print()
        print("  Games: {} in {:.1f}s".format(len(games), play_time))
        print("  Results: Student {} - Teacher {} - Draw {}".format(
            stats['student_wins'], stats['teacher_wins'], stats['draws']))
        print("  Win rate: {:.1%}".format(stats['win_rate']))
        print("  Buffer: {} examples".format(len(buffer)))
        
        # === TRAINING ===
        print()
        print("[2] Training (LR: {:.6f})...".format(trainer.current_lr))
        start_time = time.time()
        
        epoch_losses = []
        for epoch in range(epochs_per_iteration):
            examples = buffer.sample(min(len(buffer), 8192))
            losses = trainer.train_epoch(examples, batch_size=64)
            epoch_losses.append(losses)
            
            if (epoch + 1) % 2 == 0 or epoch == epochs_per_iteration - 1:
                print("  Epoch {}/{}: policy={:.4f}, value={:.4f}".format(
                    epoch+1, epochs_per_iteration, losses['policy_loss'], losses['value_loss']))
        
        training_time = time.time() - start_time
        final_losses = epoch_losses[-1]
        print("  Training: {:.1f}s".format(training_time))
        
        # Track improvement by win rate
        current_win_rate = stats['win_rate']
        improved = current_win_rate > best_win_rate
        
        if improved:
            best_win_rate = current_win_rate
            best_iteration = iteration
            no_improvement_count = 0
            
            best_path = os.path.join(checkpoint_dir, "student_best.pt")
            student.save(best_path)
            print("  ★ New best! Win rate: {:.1%}".format(best_win_rate))
        else:
            no_improvement_count += 1
            print("  No improvement ({}/{})".format(no_improvement_count, early_stop_patience))
        
        trainer.maybe_decay_lr(final_losses['policy_loss'])
        
        # Save checkpoint
        checkpoint_path = os.path.join(checkpoint_dir, "student_iter_{}.pt".format(iteration))
        student.save(checkpoint_path)
        
        training_history.append({
            'iteration': iteration,
            'win_rate': current_win_rate,
            'student_wins': stats['student_wins'],
            'teacher_wins': stats['teacher_wins'],
            'policy_loss': final_losses['policy_loss'],
            'value_loss': final_losses['value_loss'],
            'is_best': improved
        })
        
        # Check for success (student beats teacher consistently)
        if iteration >= min_iterations and best_win_rate >= target_win_rate:
            # Verify with more games
            print()
            print("Verifying win rate with 50 additional games...")
            _, verify_stats = adversarial_self_play(
                student, teacher, num_games=50,
                student_sims=student_sims, teacher_sims=teacher_sims,
                verbose=False
            )
            
            if verify_stats['win_rate'] >= target_win_rate:
                print()
                print("!" * 60)
                print("SUCCESS! Student beats teacher with {:.1%} win rate".format(verify_stats['win_rate']))
                print("!" * 60)
                break
        
        # Early stopping
        if iteration >= min_iterations and no_improvement_count >= early_stop_patience:
            print()
            print("!" * 60)
            print("EARLY STOPPING: No improvement for {} iterations".format(early_stop_patience))
            print("!" * 60)
            break
    
    # Save final
    final_path = os.path.join(checkpoint_dir, "student_final.pt")
    student.save(final_path)
    
    history_path = os.path.join(checkpoint_dir, "training_history.pkl")
    with open(history_path, 'wb') as f:
        pickle.dump(training_history, f)
    
    print()
    print("=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)
    print("Best model: {} (iter {}, {:.1%} win rate)".format(
        os.path.join(checkpoint_dir, "student_best.pt"), best_iteration, best_win_rate))
    print()
    print("Win rate progression:")
    for h in training_history:
        marker = " ★" if h.get('is_best', False) else ""
        print("  Iter {}: {:.1%} ({}-{}){}".format(
            h['iteration'], h['win_rate'], h['student_wins'], h['teacher_wins'], marker))
    
    # Load best model
    best_path = os.path.join(checkpoint_dir, "student_best.pt")
    if os.path.exists(best_path):
        student.load(best_path)
    
    return student, training_history


def main():
    parser = argparse.ArgumentParser(description='Train Axial AI by playing against existing model')
    parser.add_argument('teacher', help='Path to teacher model')
    parser.add_argument('--iterations', type=int, default=30, help='Max iterations')
    parser.add_argument('--games', type=int, default=100, help='Games per iteration')
    parser.add_argument('--student-sims', type=int, default=400, help='MCTS sims for student')
    parser.add_argument('--teacher-sims', type=int, default=600, help='MCTS sims for teacher')
    parser.add_argument('--output', default='checkpoints_adversarial', help='Output directory')
    parser.add_argument('--target-win-rate', type=float, default=0.55, help='Target win rate to stop')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.teacher):
        print("Teacher model not found: {}".format(args.teacher))
        sys.exit(1)
    
    train_adversarial(
        teacher_path=args.teacher,
        num_iterations=args.iterations,
        games_per_iteration=args.games,
        student_sims=args.student_sims,
        teacher_sims=args.teacher_sims,
        checkpoint_dir=args.output,
        target_win_rate=args.target_win_rate
    )


if __name__ == "__main__":
    main()