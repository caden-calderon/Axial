"""
Play Axial against your trained AI in the terminal.

Usage:
    python play_axial.py                           # Uses best available model
    python play_axial.py checkpoints_easy/network_best.pt
    python play_axial.py checkpoints_hard/network_best.pt
"""
import sys
import os
import numpy as np

# Check for required modules
try:
    import torch
    from Axial_BitBoard_Fast import FastBitBoard
    from Axial_Network import NetworkWrapper
    from Axial_MCTS_NN import NeuralMCTS
except ImportError as e:
    print("Error importing: {}".format(e))
    print("Make sure all Axial files are in the current directory.")
    sys.exit(1)


def print_board(board: FastBitBoard, last_move=None):
    """
    Print the 3D board in a readable format.
    Shows each layer (height) of the 6x6x7 board.
    """
    D, R, C = board.D, board.R, board.C
    
    print()
    print("=" * 50)
    
    # Print column labels
    col_labels = "    " + "  ".join("{:2d}".format(c) for c in range(C))
    
    # Print each layer from top to bottom
    for h in range(D - 1, -1, -1):
        print()
        print("  Layer {} (height {})".format(h, h))
        print(col_labels)
        print("    " + "-" * (C * 4 - 1))
        
        for r in range(R):
            row_str = "{:2d} |".format(r)
            for c in range(C):
                cell_idx = h + r * D + c * D * R
                cell = board.board[cell_idx]
                
                # Check if this is the last move
                is_last = last_move and last_move == (c, r) and h == get_piece_height(board, c, r)
                
                if cell == 0:
                    char = " . "
                elif cell == 1:
                    char = "[X]" if is_last else " X "
                else:
                    char = "[O]" if is_last else " O "
                
                row_str += char + "|"
            print(row_str)
        print("    " + "-" * (C * 4 - 1))
    
    print()
    print("You are X (Player 1), AI is O (Player 2)")
    print("=" * 50)


def get_piece_height(board: FastBitBoard, col: int, row: int) -> int:
    """Get the height of the top piece at (col, row), or -1 if empty."""
    D, R = board.D, board.R
    for h in range(D - 1, -1, -1):
        cell_idx = h + row * D + col * D * R
        if board.board[cell_idx] != 0:
            return h
    return -1


def get_valid_columns(board: FastBitBoard) -> list:
    """Get list of valid (col, row) moves."""
    return board.get_valid_moves()


def parse_move(input_str: str, valid_moves: list) -> tuple:
    """
    Parse user input into a move.
    Accepts: "col,row" or "col row" or just index from list
    """
    input_str = input_str.strip().lower()
    
    # Check for quit
    if input_str in ['q', 'quit', 'exit']:
        return None
    
    # Check for hint
    if input_str in ['h', 'hint']:
        return 'hint'
    
    # Try parsing as "col,row" or "col row"
    try:
        if ',' in input_str:
            parts = input_str.split(',')
        else:
            parts = input_str.split()
        
        if len(parts) == 2:
            col = int(parts[0])
            row = int(parts[1])
            
            if (col, row) in valid_moves:
                return (col, row)
            else:
                print("Invalid move: column {} is full at row {}".format(col, row))
                return 'invalid'
    except ValueError:
        pass
    
    # Try parsing as index into valid moves
    try:
        idx = int(input_str)
        if 0 <= idx < len(valid_moves):
            return valid_moves[idx]
    except ValueError:
        pass
    
    print("Could not parse move. Use 'col,row' format (e.g., '3,2')")
    return 'invalid'


def find_best_model():
    """Find the best available model."""
    candidates = [
        "checkpoints_hard/network_best.pt",
        "checkpoints_medium/network_best.pt", 
        "checkpoints_easy/network_best.pt",
        "checkpoints_hard/network_final.pt",
        "checkpoints_medium/network_final.pt",
        "checkpoints_easy/network_final.pt",
        "checkpoints/network_best.pt",
        "checkpoints/network_final.pt",
        "checkpoints_test/network_best.pt",
    ]
    
    for path in candidates:
        if os.path.exists(path):
            return path
    
    return None


def play_game(model_path: str, ai_simulations: int = 400, human_first: bool = True):
    """
    Play a game against the AI.
    
    Args:
        model_path: Path to the trained model
        ai_simulations: Number of MCTS simulations for AI (higher = stronger)
        human_first: If True, human plays first (X), else AI plays first
    """
    # Load network
    print("Loading model: {}".format(model_path))
    
    # Detect network config from file
    checkpoint = torch.load(model_path, map_location='cpu')
    state_dict = checkpoint['state_dict'] if 'state_dict' in checkpoint else checkpoint
    
    # Try to infer network size from weights
    # Look for first conv layer to determine num_channels
    for key in state_dict:
        if 'conv' in key and 'weight' in key and 'res_blocks' not in key:
            num_channels = state_dict[key].shape[0]
            break
    else:
        num_channels = 128  # default
    
    # Count res blocks by looking for unique block indices
    res_blocks = 0  # Start at 0, detect actual count
    for key in state_dict:
        if 'res_blocks' in key:
            parts = key.split('.')
            for i, p in enumerate(parts):
                if p == 'res_blocks' and i + 1 < len(parts):
                    try:
                        block_idx = int(parts[i + 1])
                        res_blocks = max(res_blocks, block_idx + 1)
                    except ValueError:
                        pass
    if res_blocks == 0:
        res_blocks = 4  # Fallback only if detection failed
    
    print("Detected network: {} channels, {} res blocks".format(num_channels, res_blocks))
    
    network = NetworkWrapper(
        D=6, R=6, C=7,
        num_channels=num_channels,
        num_res_blocks=res_blocks
    )
    network.load(model_path)
    network.eval_mode()
    print("Model loaded! AI will use {} MCTS simulations per move.".format(ai_simulations))
    
    # Create board
    board = FastBitBoard(dimensions=(6, 6, 7), win_length=4)
    
    human_player = 1 if human_first else 2
    ai_player = 2 if human_first else 1
    current_player = 1
    last_move = None
    move_count = 0
    
    # Create MCTS for AI
    mcts = NeuralMCTS(board, network, prev_player=2, c_puct=1.5)
    
    print()
    print("=" * 50)
    print("AXIAL - 3D Connect 4")
    print("=" * 50)
    print("Board: 6x6 grid, 7 columns, 6 layers high")
    print("Goal: Connect 4 in any direction (including 3D diagonals)")
    print()
    print("Commands:")
    print("  col,row  - Drop piece at column, row (e.g., '3,2')")
    print("  h        - Get a hint from the AI")
    print("  q        - Quit")
    print("=" * 50)
    
    while True:
        print_board(board, last_move)
        
        # Check for win
        winner = board.check_win()
        if winner != 0:
            if winner == human_player:
                print("🎉 YOU WIN! Congratulations!")
            else:
                print("💀 AI WINS! Better luck next time.")
            break
        
        # Check for draw
        valid_moves = get_valid_columns(board)
        if not valid_moves:
            print("🤝 DRAW! The board is full.")
            break
        
        move_count += 1
        
        if current_player == human_player:
            # Human's turn
            print("Your turn (X). Move {}".format(move_count))
            print("Valid moves: {}".format(valid_moves[:10]))
            if len(valid_moves) > 10:
                print("             ... and {} more".format(len(valid_moves) - 10))
            
            while True:
                try:
                    user_input = input("Enter move (col,row): ")
                except EOFError:
                    print("\nGoodbye!")
                    return
                
                move = parse_move(user_input, valid_moves)
                
                if move is None:
                    print("Goodbye!")
                    return
                elif move == 'hint':
                    print("Thinking...")
                    hint_mcts = NeuralMCTS(board, network, prev_player=ai_player, c_puct=1.5)
                    hint = hint_mcts.search(num_simulations=ai_simulations, temperature=0.1)
                    print("AI suggests: {},{}".format(hint[0], hint[1]))
                    continue
                elif move == 'invalid':
                    continue
                else:
                    break
            
            board.make_move(move[0], move[1], human_player)
            last_move = move
            
            # Update AI's MCTS tree
            if not mcts.advance_root(move):
                mcts = NeuralMCTS(board, network, prev_player=human_player, c_puct=1.5)
            
        else:
            # AI's turn
            print("AI is thinking (O)... Move {}".format(move_count))
            
            ai_move = mcts.search(num_simulations=ai_simulations, temperature=0.1)
            
            print("AI plays: {},{}".format(ai_move[0], ai_move[1]))
            
            board.make_move(ai_move[0], ai_move[1], ai_player)
            last_move = ai_move
            
            # Update MCTS tree
            if not mcts.advance_root(ai_move):
                mcts = NeuralMCTS(board, network, prev_player=ai_player, c_puct=1.5)
        
        current_player = 3 - current_player
    
    # Game over - ask to play again
    print()
    try:
        again = input("Play again? (y/n): ").strip().lower()
        if again in ['y', 'yes']:
            play_game(model_path, ai_simulations, not human_first)  # Swap who goes first
    except EOFError:
        pass


def main():
    # Parse arguments
    if len(sys.argv) > 1:
        model_path = sys.argv[1]
        if not os.path.exists(model_path):
            print("Model not found: {}".format(model_path))
            sys.exit(1)
    else:
        model_path = find_best_model()
        if model_path is None:
            print("No trained model found!")
            print("Train one first with: python Axial_Train.py easy")
            sys.exit(1)
    
    # Optional: AI strength (simulations)
    ai_sims = 400
    if len(sys.argv) > 2:
        try:
            ai_sims = int(sys.argv[2])
        except ValueError:
            pass
    
    play_game(model_path, ai_simulations=ai_sims)


if __name__ == "__main__":
    main()