"""
Neural Network for Axial game.

Architecture:
- Input: Board state as multi-channel 2D image (depth layers as channels)
- Shared convolutional trunk
- Two heads: Policy (move probabilities) and Value (position evaluation)

The network learns to:
1. Predict which moves MCTS would explore (policy)
2. Predict who will win from this position (value)
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np


class ResidualBlock(nn.Module):
    """Residual block with two convolutions and skip connection."""
    
    def __init__(self, channels: int):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, kernel_size=3, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(channels)
    
    def forward(self, x):
        residual = x
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out = out + residual  # Skip connection
        out = F.relu(out)
        return out


class AxialNetwork(nn.Module):
    """
    Policy-Value Network for Axial.
    
    Input representation:
        - Board is 6 (depth) × 6 (rows) × 7 (cols)
        - We treat depth as channels: 6 layers × 2 players = 12 input channels
        - Spatial dimensions: 6 × 7 (rows × cols)
        - Always from current player's perspective (their pieces first)
    
    Output:
        - Policy: 42 logits (one per column, 6 rows × 7 cols)
        - Value: scalar in [-1, 1] (who's winning)
    """
    
    def __init__(self, 
                 D: int = 6, 
                 R: int = 6, 
                 C: int = 7,
                 num_channels: int = 128,
                 num_res_blocks: int = 4):
        super().__init__()
        
        self.D = D  # Depth (height of columns)
        self.R = R  # Rows
        self.C = C  # Columns
        self.num_columns = R * C  # 42 possible drop locations
        
        # Input: 2*D channels (each depth layer for each player)
        input_channels = 2 * D  # 12 for default
        
        # Initial convolution
        self.conv_input = nn.Conv2d(input_channels, num_channels, kernel_size=3, padding=1, bias=False)
        self.bn_input = nn.BatchNorm2d(num_channels)
        
        # Residual tower
        self.res_blocks = nn.ModuleList([
            ResidualBlock(num_channels) for _ in range(num_res_blocks)
        ])
        
        # Policy head
        self.policy_conv = nn.Conv2d(num_channels, 32, kernel_size=1, bias=False)
        self.policy_bn = nn.BatchNorm2d(32)
        self.policy_fc = nn.Linear(32 * R * C, self.num_columns)
        
        # Value head
        self.value_conv = nn.Conv2d(num_channels, 16, kernel_size=1, bias=False)
        self.value_bn = nn.BatchNorm2d(16)
        self.value_fc1 = nn.Linear(16 * R * C, 128)
        self.value_fc2 = nn.Linear(128, 1)
    
    def forward(self, x):
        """
        Forward pass.
        
        Args:
            x: Tensor of shape (batch, 2*D, R, C)
        
        Returns:
            policy: (batch, R*C) - log probabilities over moves
            value: (batch, 1) - position evaluation in [-1, 1]
        """
        # Shared trunk
        x = F.relu(self.bn_input(self.conv_input(x)))
        
        for block in self.res_blocks:
            x = block(x)
        
        # Policy head
        p = F.relu(self.policy_bn(self.policy_conv(x)))
        p = p.view(p.size(0), -1)  # Flatten
        p = self.policy_fc(p)
        # Note: We return logits, apply softmax/log_softmax outside
        
        # Value head
        v = F.relu(self.value_bn(self.value_conv(x)))
        v = v.view(v.size(0), -1)  # Flatten
        v = F.relu(self.value_fc1(v))
        v = torch.tanh(self.value_fc2(v))  # Output in [-1, 1]
        
        return p, v
    
    def predict(self, x):
        """
        Convenience method for inference.
        Returns policy as probabilities (not logits) and value as scalar.
        """
        self.eval()
        with torch.no_grad():
            policy_logits, value = self.forward(x)
            policy = F.softmax(policy_logits, dim=1)
        return policy, value


def board_to_tensor(board: np.ndarray, current_player: int, 
                    D: int = 6, R: int = 6, C: int = 7) -> torch.Tensor:
    """
    Convert board array to network input tensor.
    
    Args:
        board: 1D numpy array of shape (D*R*C,) with values 0, 1, 2
        current_player: Which player is to move (1 or 2)
        D, R, C: Board dimensions
    
    Returns:
        Tensor of shape (1, 2*D, R, C) ready for network
    
    The board is converted to canonical form where current player's
    pieces are in channels 0:D and opponent's in channels D:2D.
    """
    # Determine which player is "us" and "them"
    if current_player == 1:
        us, them = 1, 2
    else:
        us, them = 2, 1
    
    # Create tensor with shape (2*D, R, C)
    tensor = np.zeros((2 * D, R, C), dtype=np.float32)
    
    for c in range(C):
        for r in range(R):
            for h in range(D):
                idx = h + r * D + c * D * R
                cell = board[idx]
                
                if cell == us:
                    tensor[h, r, c] = 1.0  # Our piece at depth h
                elif cell == them:
                    tensor[D + h, r, c] = 1.0  # Their piece at depth h
    
    # Add batch dimension
    return torch.from_numpy(tensor).unsqueeze(0)


def boards_to_tensor_batch(boards: list[np.ndarray], 
                           current_players: list[int],
                           D: int = 6, R: int = 6, C: int = 7) -> torch.Tensor:
    """
    Convert multiple boards to a batched tensor.
    
    Args:
        boards: List of 1D numpy arrays
        current_players: List of current player for each board
        D, R, C: Board dimensions
    
    Returns:
        Tensor of shape (batch, 2*D, R, C)
    """
    batch = []
    for board, player in zip(boards, current_players):
        tensor = np.zeros((2 * D, R, C), dtype=np.float32)
        
        if player == 1:
            us, them = 1, 2
        else:
            us, them = 2, 1
        
        for c in range(C):
            for r in range(R):
                for h in range(D):
                    idx = h + r * D + c * D * R
                    cell = board[idx]
                    
                    if cell == us:
                        tensor[h, r, c] = 1.0
                    elif cell == them:
                        tensor[D + h, r, c] = 1.0
        
        batch.append(tensor)
    
    return torch.from_numpy(np.stack(batch))


class NetworkWrapper:
    """
    Wrapper for easy inference and training.
    Handles device placement and provides simple predict() interface.
    """
    
    def __init__(self, D: int = 6, R: int = 6, C: int = 7,
                 num_channels: int = 128, num_res_blocks: int = 4,
                 device: str = None):
        
        if device is None:
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
        self.device = torch.device(device)
        
        self.D = D
        self.R = R
        self.C = C
        
        self.network = AxialNetwork(
            D=D, R=R, C=C,
            num_channels=num_channels,
            num_res_blocks=num_res_blocks
        ).to(self.device)
        
        self.num_parameters = sum(p.numel() for p in self.network.parameters())
    
    def predict(self, board: np.ndarray, current_player: int) -> tuple[np.ndarray, float]:
        """
        Get policy and value for a single board position.
        
        Args:
            board: 1D numpy array of board state
            current_player: Player to move (1 or 2)
        
        Returns:
            policy: numpy array of shape (R*C,) with move probabilities
            value: float in [-1, 1] from current player's perspective
        """
        self.network.eval()
        
        tensor = board_to_tensor(board, current_player, self.D, self.R, self.C)
        tensor = tensor.to(self.device)
        
        with torch.no_grad():
            policy_logits, value = self.network(tensor)
            policy = F.softmax(policy_logits, dim=1)
        
        return policy.cpu().numpy()[0], value.cpu().item()
    
    def predict_batch(self, boards: list[np.ndarray], 
                      current_players: list[int]) -> tuple[np.ndarray, np.ndarray]:
        """
        Get policy and value for multiple positions (batched).
        
        Returns:
            policies: numpy array of shape (batch, R*C)
            values: numpy array of shape (batch,)
        """
        self.network.eval()
        
        tensor = boards_to_tensor_batch(boards, current_players, self.D, self.R, self.C)
        tensor = tensor.to(self.device)
        
        with torch.no_grad():
            policy_logits, values = self.network(tensor)
            policies = F.softmax(policy_logits, dim=1)
        
        return policies.cpu().numpy(), values.cpu().numpy().flatten()
    
    def save(self, filepath: str):
        """Save network weights."""
        torch.save({
            'state_dict': self.network.state_dict(),
            'config': {
                'D': self.D, 'R': self.R, 'C': self.C,
                'num_channels': self.network.conv_input.out_channels,
                'num_res_blocks': len(self.network.res_blocks)
            }
        }, filepath)
        print(f"Saved network to {filepath}")
    
    def load(self, filepath: str):
        """Load network weights."""
        checkpoint = torch.load(filepath, map_location=self.device, weights_only=False)
        self.network.load_state_dict(checkpoint['state_dict'])
        print(f"Loaded network from {filepath}")
    
    def train_mode(self):
        """Set network to training mode."""
        self.network.train()
    
    def eval_mode(self):
        """Set network to evaluation mode."""
        self.network.eval()


# ============================================================================
# TESTING
# ============================================================================

def test_network():
    """Test network forward pass and shapes."""
    print("=" * 60)
    print("NETWORK ARCHITECTURE TEST")
    print("=" * 60)
    
    # Create network
    net = AxialNetwork(D=6, R=6, C=7, num_channels=128, num_res_blocks=4)
    
    # Count parameters
    num_params = sum(p.numel() for p in net.parameters())
    print(f"\nNetwork parameters: {num_params:,}")
    
    # Test forward pass
    batch_size = 8
    x = torch.randn(batch_size, 12, 6, 7)  # 12 channels = 6 depths × 2 players
    
    print(f"\nInput shape: {x.shape}")
    
    policy, value = net(x)
    
    print(f"Policy shape: {policy.shape} (expected: [{batch_size}, 42])")
    print(f"Value shape: {value.shape} (expected: [{batch_size}, 1])")
    
    # Check value range
    print(f"\nValue range: [{value.min().item():.3f}, {value.max().item():.3f}]")
    
    # Test softmax
    policy_probs = F.softmax(policy, dim=1)
    print(f"Policy sum (should be 1.0): {policy_probs[0].sum().item():.6f}")
    
    # Test wrapper
    print("\n" + "-" * 40)
    print("Testing NetworkWrapper...")
    
    wrapper = NetworkWrapper(D=6, R=6, C=7, num_channels=64, num_res_blocks=2)
    print(f"Wrapper parameters: {wrapper.num_parameters:,}")
    print(f"Device: {wrapper.device}")
    
    # Test single prediction
    board = np.zeros(6 * 6 * 7, dtype=np.uint8)
    board[0] = 1  # One piece for player 1
    board[6] = 2  # One piece for player 2
    
    policy, value = wrapper.predict(board, current_player=1)
    print(f"\nSingle prediction:")
    print(f"  Policy shape: {policy.shape}")
    print(f"  Policy sum: {policy.sum():.6f}")
    print(f"  Value: {value:.4f}")
    print(f"  Top 3 moves: {np.argsort(policy)[-3:][::-1]}")
    
    # Test batch prediction
    boards = [board.copy() for _ in range(16)]
    players = [1] * 16
    
    import time
    start = time.perf_counter()
    for _ in range(100):
        policies, values = wrapper.predict_batch(boards, players)
    elapsed = time.perf_counter() - start
    
    print(f"\nBatch prediction (100 × 16 = 1600 evals):")
    print(f"  Time: {elapsed:.3f}s")
    print(f"  Evals/sec: {1600/elapsed:.0f}")
    
    print("\n✓ All tests passed!")


if __name__ == "__main__":
    test_network()
