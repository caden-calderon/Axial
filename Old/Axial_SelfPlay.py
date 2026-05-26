from Axial_BitBoard import BitBoard
from Axial_MCTS import MCTS

def play_game():
    """
    Runs a single game of MCTS vs MCTS.
    """
    board = BitBoard(dimensions=(6, 6, 6), win_length=4)
    mcts = MCTS(board)
    
    current_player = 1
    turn_count = 0
    
    print("--- Starting Self-Play Game ---")
    
    while True:
        # 1. Check for Game Over
        winner = board.check_win()
        if winner != 0:
            print(f"\nGAME OVER! Player {winner} Wins!")
            break
        
        if len(board.get_valid_moves()) == 0:
            print("\nGAME OVER! Draw!")
            break
            
        # 2. MCTS thinks
        print(f"Turn {turn_count}: Player {current_player} thinking...", end="", flush=True)
        
        # TREE REUSE OPTIMIZATION:
        # Instead of creating a new MCTS(board), we keep the old one.
        # But we must move the root down to match the move that was just made.
        
        # If this is the very first turn, we already have the root.
        # If it's not, we need to advance the tree based on the PREVIOUS move.
        # (Since we just applied a move at the end of the loop, the 'mcts' object 
        # is currently lagging behind by one move if we didn't update it).
        
        # Actually, the cleanest way is:
        # 1. Search
        # 2. Pick Move
        # 3. Apply Move to Real Board
        # 4. Move MCTS Root to the chosen child
        
        best_move = mcts.search(simulations=10000)
        print(f" Move: {best_move}")
        
        # 3. Apply Move
        board.make_move(best_move[0], best_move[1], current_player)
        
        # 4. Advance MCTS Tree
        # The move we just made corresponds to one of the children of the current root.
        # We make that child the new root.
        if best_move in mcts.root.children:
            mcts.root = mcts.root.children[best_move]
            mcts.root.parent = None # Detach from old tree to allow GC
        else:
            # This should technically never happen if we searched enough,
            # but if we picked a move that wasn't expanded (e.g. temperature),
            # we reset.
            print(" (Tree Reset)", end="")
            mcts = MCTS(board)
        
        # 5. Switch Turn
        current_player = 3 - current_player
        turn_count += 1
        
    board.print_board()

if __name__ == "__main__":
    play_game()
