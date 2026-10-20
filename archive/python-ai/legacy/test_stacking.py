from Axial_BitBoard import BitBoard

def test_stacking():
    print("--- Testing Stacking Logic ---")
    bb = BitBoard(dimensions=(6, 6, 6), win_length=4)
    
    # Drop 3 pieces in the same column (0, 0)
    print("Dropping 3 pieces in column (0, 0)...")
    bb.make_move(0, 0, 1) # Player 1
    bb.make_move(0, 0, 2) # Player 2
    bb.make_move(0, 0, 1) # Player 1
    
    bb.print_board()
    
    # Verify bits
    # Index = h + r*D + c*D*R
    # (0,0,0) -> 0
    # (1,0,0) -> 1
    # (2,0,0) -> 2
    
    p1_0 = (bb.player1 >> 0) & 1
    p2_1 = (bb.player2 >> 1) & 1
    p1_2 = (bb.player1 >> 2) & 1
    
    print(f"Layer 0 (P1): {p1_0}")
    print(f"Layer 1 (P2): {p2_1}")
    print(f"Layer 2 (P1): {p1_2}")
    
    if p1_0 and p2_1 and p1_2:
        print("SUCCESS: Pieces stacked correctly.")
    else:
        print("FAILURE: Pieces did not stack.")

    # Check valid moves
    moves = bb.get_valid_moves()
    if (0, 0) in moves:
        print("SUCCESS: Column (0, 0) is still valid.")
    else:
        print("FAILURE: Column (0, 0) marked invalid prematurely.")

if __name__ == "__main__":
    test_stacking()
