from typing import Tuple
import numpy as np 

class game: 


    def init_matrix(self, d: int, r: int, c: int) -> np.ndarray:
        return np.full((d, r, c), 0, dtype=np.uint8)
 

    def __init__(self, dimensions: Tuple[int, int, int], win_length: int = 4):
        self.dimensions = dimensions
        self.win_length = win_length
        self.board = self.init_matrix(*dimensions)


    def drop_piece(self, drop_r: int, drop_c: int, player_num: int) -> bool:
        H = self.board.shape[0]

        for h in range(H):
            if self.board[h, drop_r, drop_c] == 0:
                self.board[h, drop_r, drop_c] = player_num
                print(f"Placed piece at (height={h}, row={drop_r}, col={drop_c})")
                return True 
        else:
            print("Column is full AHHH")
            return False
    

    def check_goal(self, h: int, r: int, c: int, player_num: int) -> bool:
        """
        Checks if the piece placed at (h, r, c) creates a win (self.win_length in a row)
        in any of the 13 possible 3D directions.
        """
        # All 13 unique 3D directions (vector components: dh, dr, dc)
        directions = [
            # 1. Orthogonal (3)
            (1, 0, 0),  # Vertical
            (0, 1, 0),  # Horizontal (Row)
            (0, 0, 1),  # Horizontal (Col)
            
            # 2. Face Diagonals (6)
            (1, 1, 0), (1, -1, 0),  # Vertical-Row plane
            (0, 1, 1), (0, 1, -1),  # Horizontal plane
            (1, 0, 1), (1, 0, -1),  # Vertical-Col plane
            
            # 3. Space Diagonals (4)
            (1, 1, 1),   # Main diagonal
            (1, 1, -1),  
            (1, -1, 1),
            (1, -1, -1)
        ]

        D, R, C = self.dimensions

        for dh, dr, dc in directions:
            count = 1  # Start with the piece itself
            
            # Check Positive Direction
            for step in range(1, self.win_length):
                nh, nr, nc = h + step*dh, r + step*dr, c + step*dc
                if 0 <= nh < D and 0 <= nr < R and 0 <= nc < C and self.board[nh, nr, nc] == player_num:
                    count += 1
                else:
                    break
            
            # Check Negative Direction
            for step in range(1, self.win_length):
                nh, nr, nc = h - step*dh, r - step*dr, c - step*dc
                if 0 <= nh < D and 0 <= nr < R and 0 <= nc < C and self.board[nh, nr, nc] == player_num:
                    count += 1
                else:
                    break
            
            if count >= self.win_length:
                print(f"WIN DETECTED! Player {player_num} wins with direction ({dh}, {dr}, {dc})")
                return True

        return False 


    def get_valid_moves(self) -> list[Tuple[int, int]]:
        """
        Returns a list of (r, c) tuples where a piece can be dropped.
        A column is valid if the top-most cell is empty.
        """
        valid_moves = []
        D, R, C = self.dimensions
        for r in range(R):
            for c in range(C):
                if self.board[D-1, r, c] == 0:
                    valid_moves.append((r, c))
        return valid_moves


    def is_full(self) -> bool:
        """
        Returns True if the board is completely full (draw condition).
        """
        return len(self.get_valid_moves()) == 0 


    def get_board(self):
        return self.board

    

if __name__ == "__main__":
    print("--- Starting Axial Win Logic Tests ---")
    
    # Test 1: Vertical Win
    print("\n[Test 1] Checking Vertical Win...")
    game1 = game(dimensions=(4, 4, 4))
    # Stack 4 pieces in (0,0)
    for _ in range(4):
        game1.drop_piece(0, 0, 1)
    # Check the top piece (h=3, r=0, c=0)
    is_win = game1.check_goal(3, 0, 0, 1)
    print(f"Vertical Win Detected: {is_win}")

    # Test 2: Horizontal Win (Row)
    print("\n[Test 2] Checking Horizontal Row Win...")
    game2 = game(dimensions=(4, 4, 4))
    for c in range(4):
        game2.drop_piece(0, c, 1) # Fill bottom row
    # Check the last placed piece (h=0, r=0, c=3)
    is_win = game2.check_goal(0, 0, 3, 1)
    print(f"Horizontal Win Detected: {is_win}")

    # Test 3: 3D Space Diagonal Win (Corner to Corner)
    print("\n[Test 3] Checking 3D Space Diagonal Win...")
    game3 = game(dimensions=(4, 4, 4))
    # We need to build a "staircase" to place pieces at (0,0,0), (1,1,1), (2,2,2), (3,3,3)
    
    # (0,0,0)
    game3.drop_piece(0, 0, 1) 
    
    # (1,1,1) - needs support at (0,1,1)
    game3.drop_piece(1, 1, 2) # Support
    game3.drop_piece(1, 1, 1) # Target
    
    # (2,2,2) - needs support at (0,2,2) and (1,2,2)
    game3.drop_piece(2, 2, 2) # Support
    game3.drop_piece(2, 2, 2) # Support
    game3.drop_piece(2, 2, 1) # Target
    
    # (3,3,3) - needs 3 supports
    game3.drop_piece(3, 3, 2) # Support
    game3.drop_piece(3, 3, 2) # Support
    game3.drop_piece(3, 3, 2) # Support
    game3.drop_piece(3, 3, 1) # Target
    
    # Note: The above manual setup is tricky with gravity. 
    # Let's force-set the board for the diagonal test to be sure.
    game3.board = np.zeros((4,4,4), dtype=np.uint8)
    game3.board[0,0,0] = 1
    game3.board[1,1,1] = 1
    game3.board[2,2,2] = 1
    game3.board[3,3,3] = 1
    
    print("Manually set diagonal board state.")
    is_win = game3.check_goal(3, 3, 3, 1)
    print(f"3D Diagonal Win Detected: {is_win}")

    # Test 4: 5x5x5 Board with 5-in-a-row Win
    print("\n[Test 4] Checking 5-in-a-row on 5x5x5 Board...")
    game4 = game(dimensions=(5, 5, 5), win_length=5)
    for c in range(5):
        game4.drop_piece(0, c, 1) # Fill bottom row
    # Check the last placed piece (h=0, r=0, c=4)
    is_win = game4.check_goal(0, 0, 4, 1)
    print(f"5-in-a-row Win Detected: {is_win}")