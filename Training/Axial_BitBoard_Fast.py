"""
Numba-accelerated BitBoard operations.

These functions are JIT-compiled to machine code and release the GIL,
enabling true parallelism with threading.

Uses byte arrays instead of giant integers to support boards > 64 cells.
Board state: np.uint8 array where 0=empty, 1=player1, 2=player2
"""
import numpy as np
from numba import njit, prange
import math

# ============================================================================
# CORE BITBOARD OPERATIONS (Numba-accelerated)
# ============================================================================

@njit(cache=True)
def check_line(board: np.ndarray, start_idx: int, step: int, length: int, 
               player: int, total_cells: int) -> bool:
    """Check if there's a winning line starting at start_idx going in direction step."""
    count = 0
    idx = start_idx
    for _ in range(length):
        if idx < 0 or idx >= total_cells:
            return False
        if board[idx] != player:
            return False
        count += 1
        idx += step
    return count >= length


@njit(cache=True)
def check_win_array(board: np.ndarray, D: int, R: int, C: int, win_length: int) -> int:
    """
    Check if either player has won.
    
    Args:
        board: 1D array of cell states (0=empty, 1=P1, 2=P2)
        D, R, C: Dimensions (depth/height, rows, cols)
        win_length: Number in a row to win
    
    Returns: 1 if P1 won, 2 if P2 won, 0 otherwise
    """
    total = D * R * C
    
    # Direction steps (same as your original 13 directions)
    # Index = h + r*D + c*D*R
    directions = (
        1,                  # Vertical (h direction)
        D,                  # Row direction
        D * R,              # Column direction
        D + 1,              # h+r diagonal
        D - 1,              # h-r diagonal
        D * R + D,          # r+c diagonal
        D * R - D,          # r-c diagonal (was wrong, fixed)
        D * R + 1,          # h+c diagonal
        D * R - 1,          # h-c diagonal (was wrong, fixed)
        D * R + D + 1,      # All three +
        D * R + D - 1,      # c+, r+, h-
        D * R - D + 1,      # c+, r-, h+
        D * R - D - 1,      # c+, r-, h- (was wrong, fixed)
    )
    
    for player in (1, 2):
        for c in range(C):
            for r in range(R):
                for h in range(D):
                    idx = h + r * D + c * D * R
                    if board[idx] != player:
                        continue
                    
                    # Check each direction
                    for step in directions:
                        # Bounds checking - make sure line stays in valid region
                        valid = True
                        curr_h, curr_r, curr_c = h, r, c
                        
                        # Decode step into deltas
                        dh = 1 if step % D != 0 or step == 1 else 0
                        if step < 0:
                            dh = -dh
                        
                        # Simplified: just check if all cells in line have same player
                        count = 0
                        check_idx = idx
                        for _ in range(win_length):
                            if check_idx < 0 or check_idx >= total:
                                break
                            if board[check_idx] != player:
                                break
                            count += 1
                            check_idx += step
                        
                        if count >= win_length:
                            return player
    
    return 0


@njit(cache=True)
def check_win_optimized(board: np.ndarray, D: int, R: int, C: int, win_length: int,
                        directions: np.ndarray, bounds: np.ndarray) -> int:
    """
    Optimized win check using precomputed direction/bounds data.
    
    Args:
        board: 1D array of cell states
        D, R, C: Dimensions
        win_length: Number to win
        directions: Array of step values for each direction
        bounds: Nx3 array of (dh, dr, dc) for bounds checking
    
    Returns: 1 if P1 won, 2 if P2 won, 0 otherwise
    """
    total = D * R * C
    n_dirs = directions.shape[0]
    
    for player in (1, 2):
        for c in range(C):
            for r in range(R):
                for h in range(D):
                    idx = h + r * D + c * D * R
                    if board[idx] != player:
                        continue
                    
                    for d in range(n_dirs):
                        step = directions[d]
                        dh, dr, dc = bounds[d, 0], bounds[d, 1], bounds[d, 2]
                        
                        # Check if full line would be in bounds
                        end_h = h + dh * (win_length - 1)
                        end_r = r + dr * (win_length - 1)
                        end_c = c + dc * (win_length - 1)
                        
                        if end_h < 0 or end_h >= D:
                            continue
                        if end_r < 0 or end_r >= R:
                            continue
                        if end_c < 0 or end_c >= C:
                            continue
                        
                        # Check all cells in line
                        count = 0
                        check_idx = idx
                        for _ in range(win_length):
                            if board[check_idx] == player:
                                count += 1
                                check_idx += step
                            else:
                                break
                        
                        if count >= win_length:
                            return player
    
    return 0


@njit(cache=True)
def get_valid_moves_array(board: np.ndarray, D: int, R: int, C: int) -> np.ndarray:
    """
    Get valid moves as Nx2 array of (r, c).
    A column is valid if the top cell is empty.
    """
    # Count valid columns
    count = 0
    for r in range(R):
        for c in range(C):
            top_idx = (D - 1) + r * D + c * D * R
            if board[top_idx] == 0:
                count += 1
    
    moves = np.empty((count, 2), dtype=np.int32)
    idx = 0
    for r in range(R):
        for c in range(C):
            top_idx = (D - 1) + r * D + c * D * R
            if board[top_idx] == 0:
                moves[idx, 0] = r
                moves[idx, 1] = c
                idx += 1
    
    return moves


@njit(cache=True)
def make_move_array(board: np.ndarray, r: int, c: int, player: int, 
                    D: int, R: int) -> bool:
    """
    Make a move on the board (modifies in place).
    Returns True if successful, False if column full.
    """
    col_base = r * D + c * D * R
    
    for h in range(D):
        idx = col_base + h
        if board[idx] == 0:
            board[idx] = player
            return True
    
    return False


@njit(cache=True)
def copy_board(board: np.ndarray) -> np.ndarray:
    """Create a copy of the board."""
    return board.copy()


# ============================================================================
# ROLLOUT SIMULATION (Numba-accelerated)
# ============================================================================

@njit(cache=True)
def simulate_rollout(
    board: np.ndarray,
    prev_player: int,
    D: int, R: int, C: int,
    win_length: int,
    directions: np.ndarray,
    bounds: np.ndarray,
    center_r: float,
    center_c: float,
    rng_state: np.ndarray
) -> int:
    """
    Run a full rollout from current position.
    Returns: 1 if P1 wins, 2 if P2 wins, 0 for draw
    """
    sim_board = board.copy()
    curr_player = prev_player
    
    for _ in range(D * R * C):  # Max possible moves
        # Check win
        winner = check_win_optimized(sim_board, D, R, C, win_length, directions, bounds)
        if winner != 0:
            return winner
        
        # Get valid moves
        moves = get_valid_moves_array(sim_board, D, R, C)
        if moves.shape[0] == 0:
            return 0  # Draw
        
        curr_player = 3 - curr_player
        
        # LCG random number
        rng_state[0] = (rng_state[0] * 1103515245 + 12345) & 0x7FFFFFFF
        
        # 60% center-biased, 40% random
        if (rng_state[0] % 100) < 60:
            best_idx = 0
            best_dist = 1000.0
            for i in range(moves.shape[0]):
                dist = abs(moves[i, 0] - center_r) + abs(moves[i, 1] - center_c)
                if dist < best_dist:
                    best_dist = dist
                    best_idx = i
            r, c = moves[best_idx, 0], moves[best_idx, 1]
        else:
            rng_state[0] = (rng_state[0] * 1103515245 + 12345) & 0x7FFFFFFF
            idx = rng_state[0] % moves.shape[0]
            r, c = moves[idx, 0], moves[idx, 1]
        
        make_move_array(sim_board, r, c, curr_player, D, R)
    
    return 0


@njit(parallel=True, cache=True)
def batch_simulate(
    boards: np.ndarray,        # (N, total_cells) array
    prev_players: np.ndarray,  # (N,) array
    D: int, R: int, C: int,
    win_length: int,
    directions: np.ndarray,
    bounds: np.ndarray,
    center_r: float,
    center_c: float,
    seeds: np.ndarray
) -> np.ndarray:
    """Run N rollouts in parallel."""
    n = boards.shape[0]
    results = np.empty(n, dtype=np.int32)
    
    for i in prange(n):
        rng = np.array([seeds[i]], dtype=np.int64)
        results[i] = simulate_rollout(
            boards[i], prev_players[i], D, R, C, win_length,
            directions, bounds, center_r, center_c, rng
        )
    
    return results


# ============================================================================
# PRECOMPUTATION
# ============================================================================

def compute_directions_and_bounds(D: int, R: int, C: int) -> tuple[np.ndarray, np.ndarray]:
    """
    Precompute direction steps and bounds deltas.
    Returns: (directions array, bounds array)
    """
    raw_directions = [
        (1, 0, 0),   # Vertical
        (0, 1, 0),   # Row
        (0, 0, 1),   # Column
        (1, 1, 0),   # h+r
        (1, -1, 0),  # h-r
        (0, 1, 1),   # r+c
        (0, 1, -1),  # r-c
        (1, 0, 1),   # h+c
        (1, 0, -1),  # h-c
        (1, 1, 1),   # h+r+c
        (1, 1, -1),  # h+r-c
        (1, -1, 1),  # h-r+c
        (1, -1, -1), # h-r-c
    ]
    
    directions = []
    bounds = []
    
    for dh, dr, dc in raw_directions:
        step = dh + dr * D + dc * D * R
        directions.append(step)
        bounds.append((dh, dr, dc))
    
    return np.array(directions, dtype=np.int32), np.array(bounds, dtype=np.int32)
    
# ============================================================================
# WRAPPER CLASS (Python-friendly interface)
# ============================================================================

class FastBitBoard:
    """
    Numba-accelerated BitBoard with Python-friendly interface.
    
    Use this as a drop-in replacement for BitBoard when performance matters.
    Board is represented as a 1D numpy array (0=empty, 1=P1, 2=P2).
    """
    
    def __init__(self, dimensions=(6, 6, 6), win_length=4, copy_from=None):
        if copy_from:
            self.D, self.R, self.C = copy_from.D, copy_from.R, copy_from.C
            self.win_length = copy_from.win_length
            self.board = copy_from.board.copy()
            self.directions = copy_from.directions  # Share reference
            self.bounds = copy_from.bounds          # Share reference
            self.center_r = copy_from.center_r
            self.center_c = copy_from.center_c
        else:
            self.D, self.R, self.C = dimensions
            self.win_length = win_length
            self.board = np.zeros(self.D * self.R * self.C, dtype=np.uint8)
            self.center_r = self.R / 2.0
            self.center_c = self.C / 2.0
            self.directions, self.bounds = compute_directions_and_bounds(self.D, self.R, self.C)
    
    def copy(self) -> 'FastBitBoard':
        return FastBitBoard(copy_from=self)
    
    def make_move(self, r: int, c: int, player: int) -> bool:
        return make_move_array(self.board, r, c, player, self.D, self.R)
    
    def check_win(self) -> int:
        return check_win_optimized(self.board, self.D, self.R, self.C, 
                                   self.win_length, self.directions, self.bounds)
    
    def get_valid_moves(self) -> list[tuple[int, int]]:
        moves_arr = get_valid_moves_array(self.board, self.D, self.R, self.C)
        return [(int(moves_arr[i, 0]), int(moves_arr[i, 1])) for i in range(moves_arr.shape[0])]
    
    def get_valid_moves_array(self) -> np.ndarray:
        """Return moves as numpy array (faster for Numba code)."""
        return get_valid_moves_array(self.board, self.D, self.R, self.C)
    
    def simulate_rollout(self, prev_player: int, seed: int = None) -> int:
        """Run a single rollout simulation."""
        if seed is None:
            seed = np.random.randint(0, 2**31)
        rng_state = np.array([seed], dtype=np.int64)
        return simulate_rollout(
            self.board, prev_player, self.D, self.R, self.C,
            self.win_length, self.directions, self.bounds,
            self.center_r, self.center_c, rng_state
        )
    
    def print_board(self) -> None:
        """Debug print of the board."""
        print(f"Board ({self.D}x{self.R}x{self.C})")
        for h in range(self.D - 1, -1, -1):
            print(f"Layer {h}:")
            for r in range(self.R):
                row_str = ""
                for c in range(self.C):
                    idx = h + r * self.D + c * self.D * self.R
                    val = self.board[idx]
                    if val == 1: row_str += "1 "
                    elif val == 2: row_str += "2 "
                    else: row_str += ". "
                print(row_str)
            print()


# ============================================================================
# TESTING & BENCHMARKS
# ============================================================================

def benchmark():
    """Compare performance against pure Python BitBoard."""
    import time
    
    print("=" * 60)
    print("NUMBA BITBOARD BENCHMARK (Array-based)")
    print("=" * 60)
    
    # Warm up JIT
    print("\nWarming up JIT compiler...")
    fb = FastBitBoard(dimensions=(6, 6, 6), win_length=4)
    fb.check_win()
    fb.get_valid_moves()
    fb.make_move(2, 3, 1)
    fb.simulate_rollout(2, seed=12345)
    print("JIT compilation complete.\n")
    
    # Benchmark check_win
    fb = FastBitBoard(dimensions=(6, 6, 6), win_length=4)
    start = time.perf_counter()
    for _ in range(100000):
        check_win_optimized(fb.board, fb.D, fb.R, fb.C, fb.win_length, fb.directions, fb.bounds)
    elapsed = time.perf_counter() - start
    print(f"check_win_optimized x100000: {elapsed:.3f}s ({elapsed/100:.6f}s each)")
    
    # Compare to original
    from Axial_BitBoard import BitBoard
    bb = BitBoard(dimensions=(6, 6, 6), win_length=4)
    start = time.perf_counter()
    for _ in range(100000):
        bb.check_win()
    orig_elapsed = time.perf_counter() - start
    print(f"Original check_win x100000:  {orig_elapsed:.3f}s ({orig_elapsed/100:.6f}s each)")
    print(f"  Speedup: {orig_elapsed/elapsed:.1f}x")
    
    # Benchmark get_valid_moves
    print()
    start = time.perf_counter()
    for _ in range(100000):
        get_valid_moves_array(fb.board, fb.D, fb.R, fb.C)
    elapsed = time.perf_counter() - start
    print(f"get_valid_moves_array x100000: {elapsed:.3f}s ({elapsed/100:.6f}s each)")
    
    start = time.perf_counter()
    for _ in range(100000):
        bb.get_valid_moves()
    orig_elapsed = time.perf_counter() - start
    print(f"Original get_valid_moves x100000: {orig_elapsed:.3f}s ({orig_elapsed/100:.6f}s each)")
    print(f"  Speedup: {orig_elapsed/elapsed:.1f}x")
    
    # Benchmark full rollout
    print("\nFull rollout simulation:")
    start = time.perf_counter()
    for i in range(10000):
        fb2 = FastBitBoard(dimensions=(6, 6, 6), win_length=4)
        fb2.simulate_rollout(2, seed=i)
    elapsed = time.perf_counter() - start
    print(f"Numba rollout x10000: {elapsed:.3f}s ({elapsed/10:.6f}s each)")
    print(f"  Rollouts/sec: {10000/elapsed:.0f}")
    
    # Batch parallel simulation
    print("\nBatch parallel simulation:")
    n_batch = 10000
    boards = np.zeros((n_batch, fb.D * fb.R * fb.C), dtype=np.uint8)
    prev_players = np.full(n_batch, 2, dtype=np.int32)
    seeds = np.arange(n_batch, dtype=np.int64) + 1000
    
    # Warm up parallel
    _ = batch_simulate(boards[:10], prev_players[:10], 
                      fb.D, fb.R, fb.C, fb.win_length,
                      fb.directions, fb.bounds, fb.center_r, fb.center_c, seeds[:10])
    
    start = time.perf_counter()
    results = batch_simulate(boards, prev_players,
                            fb.D, fb.R, fb.C, fb.win_length,
                            fb.directions, fb.bounds, fb.center_r, fb.center_c, seeds)
    elapsed = time.perf_counter() - start
    print(f"batch_simulate x{n_batch} (parallel): {elapsed:.3f}s")
    print(f"  Rollouts/sec: {n_batch/elapsed:.0f}")
    print(f"  P1 wins: {np.sum(results == 1)}, P2 wins: {np.sum(results == 2)}, Draws: {np.sum(results == 0)}")


def test_correctness():
    """Verify Numba version matches original."""
    from Axial_BitBoard import BitBoard
    import random
    
    print("\n" + "=" * 60)
    print("CORRECTNESS TESTS")
    print("=" * 60)
    
    # Play some random games and verify results match
    for game in range(10):
        bb = BitBoard(dimensions=(6, 6, 6), win_length=4)
        fb = FastBitBoard(dimensions=(6, 6, 6), win_length=4)
        
        player = 1
        for _ in range(100):
            moves = bb.get_valid_moves()
            if not moves:
                break
            
            r, c = random.choice(moves)
            bb.make_move(r, c, player)
            fb.make_move(r, c, player)
            
            # Check states match
            bb_win = bb.check_win()
            fb_win = fb.check_win()
            
            if bb_win != fb_win:
                print(f"MISMATCH at game {game}: bb={bb_win}, fb={fb_win}")
                bb.print_board()
                fb.print_board()
                return False
            
            if bb_win != 0:
                break
            
            player = 3 - player
    
    print("All correctness tests passed!")
    return True


if __name__ == "__main__":
    test_correctness()
    benchmark()
