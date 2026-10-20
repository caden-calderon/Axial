import math

class BitBoard:
    def __init__(self, dimensions=(6, 6, 6), win_length=4, copy_from=None):
        """
        Initialize the BitBoard.
        If copy_from is provided, creates a fast clone sharing static data.
        """
        if copy_from:
            self.D, self.R, self.C = copy_from.D, copy_from.R, copy_from.C
            self.win_length = copy_from.win_length
            self.player1 = copy_from.player1
            self.player2 = copy_from.player2
            # Share references to large static structures
            self.win_checks = copy_from.win_checks
            self.top_mask = copy_from.top_mask
            self.full_board_mask = copy_from.full_board_mask
            self.directions = copy_from.directions
        else:
            self.D, self.R, self.C = dimensions
            self.win_length = win_length
            
            # State
            self.player1 = 0
            self.player2 = 0
            
            # Precompute
            self.directions = self._get_directions()
            self.win_checks = [] 
            self._precompute_constants()
            
            # Masks
            self.top_mask = 0
            for r in range(self.R):
                for c in range(self.C):
                    idx = (self.D - 1) + r * self.D + c * self.D * self.R
                    self.top_mask |= (1 << idx)
            self.full_board_mask = (1 << (self.D * self.R * self.C)) - 1

    def copy(self) -> 'BitBoard':
        """Returns a fast clone of the board."""
        return BitBoard(copy_from=self)

    def _get_directions(self) -> list[tuple[int, int, int]]:
        """Returns the 13 unique 3D directions."""
        return [
            (1, 0, 0),  # Vertical
            (0, 1, 0),  # Horizontal Row
            (0, 0, 1),  # Horizontal Col
            (1, 1, 0), (1, -1, 0),
            (0, 1, 1), (0, 1, -1),
            (1, 0, 1), (1, 0, -1),
            (1, 1, 1), (1, 1, -1), (1, -1, 1), (1, -1, -1)
        ]

    def _precompute_constants(self) -> None:
        """Calculates shift amounts and boundary masks for all directions."""
        self.win_checks = [] # List of (shift, mask) tuples
        
        for dh, dr, dc in self.directions:
            # 1. Calculate Raw Shift
            # Index = h + r*D + c*D*R
            raw_shift = dh + dr * self.D + dc * self.D * self.R
            
            # 2. Normalize to Positive Shift
            # If shift is negative, we are checking the same line but "backwards".
            # We flip the direction and the shift to make it positive.
            if raw_shift < 0:
                shift = -raw_shift
                check_dh, check_dr, check_dc = -dh, -dr, -dc
            else:
                shift = raw_shift
                check_dh, check_dr, check_dc = dh, dr, dc
            
            # 3. Calculate Valid Mask for the CHOSEN direction
            # The mask should have a 1 at (h, r, c) ONLY IF (h+dh, r+dr, c+dc) is valid.
            mask = 0
            for c in range(self.C):
                for r in range(self.R):
                    for h in range(self.D):
                        # Check if next step is in bounds
                        nh, nr, nc = h + check_dh, r + check_dr, c + check_dc
                        if 0 <= nh < self.D and 0 <= nr < self.R and 0 <= nc < self.C:
                            idx = h + r * self.D + c * self.D * self.R
                            mask |= (1 << idx)
            
            self.win_checks.append((shift, mask))

    def make_move(self, r: int, c: int, player: int) -> bool:
        """
        Drops a piece in column (r, c) for the given player.
        Returns True if successful, False if column is full.
        """
        # 1. Check if column is full (Top bit check)
        top_idx = (self.D - 1) + r * self.D + c * self.D * self.R
        occupied = self.player1 | self.player2
        if (occupied >> top_idx) & 1:
            return False # Column full

        # 2. Find the first empty bit in this column
        col_base = r * self.D + c * self.D * self.R
        for h in range(self.D):
            idx = col_base + h
            if not ((occupied >> idx) & 1):
                # Found empty spot
                if player == 1:
                    self.player1 |= (1 << idx)
                else:
                    self.player2 |= (1 << idx)
                return True
        return False

    def check_win(self):
        """
        Checks if ANY player has won.
        Returns: 1 if Player 1 won, 2 if Player 2 won, 0 otherwise.
        """
        for player in [1, 2]:
            board = self.player1 if player == 1 else self.player2
            
            for shift, mask in self.win_checks:
                # Check for N in a row
                # We need (N-1) AND operations.
                # temp = board & (board >> shift) & mask
                
                temp = board
                for _ in range(self.win_length - 1):
                    # Shift, Mask to prevent wrapping, AND with previous
                    temp = temp & (temp >> shift) & mask
                
                if temp != 0:
                    return player
        return 0

    def get_valid_moves(self) -> list[tuple[int, int]]:
        """Returns list of (r, c) tuples for valid columns."""
        moves = []
        occupied = self.player1 | self.player2
        for r in range(self.R):
            for c in range(self.C):
                top_idx = (self.D - 1) + r * self.D + c * self.D * self.R
                if not ((occupied >> top_idx) & 1):
                    moves.append((r, c))
        return moves

    def print_board(self) -> None:
        """Debug print of the board."""
        print(f"Board ({self.D}x{self.R}x{self.C})")
        for h in range(self.D - 1, -1, -1):
            print(f"Layer {h}:")
            for r in range(self.R):
                row_str = ""
                for c in range(self.C):
                    idx = h + r * self.D + c * self.D * self.R
                    p1 = (self.player1 >> idx) & 1
                    p2 = (self.player2 >> idx) & 1
                    if p1: row_str += "1 "
                    elif p2: row_str += "2 "
                    else: row_str += ". "
                print(row_str)
            print()

if __name__ == "__main__":
    print("--- Testing Axial BitBoard ---")
    
    # Test 1: 6x6x6 Board
    print("\n[Test 1] Initializing 6x6x6 Board...")
    bb = BitBoard(dimensions=(6, 6, 6), win_length=4)
    print("Success.")
    
    # Test 2: Vertical Win
    print("\n[Test 2] Vertical Win (Player 1)...")
    for _ in range(4):
        bb.make_move(0, 0, 1)
    bb.print_board()
    print(f"Win Detected: {bb.check_win()}")
    assert bb.check_win() == 1
    
    # Test 3: Horizontal Win
    print("\n[Test 3] Horizontal Row Win (Player 2)...")
    bb2 = BitBoard(dimensions=(6, 6, 6), win_length=4)
    for c in range(4):
        bb2.make_move(0, c, 2)
    for c in range(3):
        bb2.make_move(1, c, 1)
    bb2.print_board()
    print(f"Win Detected: {bb2.check_win()}")
    assert bb2.check_win() == 2

    # Test 4: Diagonal Win (Cross-Dimension)
    print("\n[Test 4] 3D Diagonal Win (Player 1)...")
    bb3 = BitBoard(dimensions=(4, 4, 4), win_length=4)
    # Manually set bits for a perfect diagonal (0,0,0) -> (3,3,3)
    # Indices:
    # (0,0,0) -> 0
    # (1,1,1) -> 1 + 1*4 + 1*16 = 21
    # (2,2,2) -> 2 + 2*4 + 2*16 = 42
    # (3,3,3) -> 3 + 3*4 + 3*16 = 63
    bb3.player1 |= (1 << 0)
    bb3.player1 |= (1 << 21)
    bb3.player1 |= (1 << 42)
    bb3.player1 |= (1 << 63)
    
    print(f"Win Detected: {bb3.check_win()}")
    assert bb3.check_win() == 1
    
    print("\nAll BitBoard tests passed!")
