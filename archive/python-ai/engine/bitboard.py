"""
Numba-accelerated BitBoard for 3D Connect 4.

This module provides:
- Board representation using 1D numpy arrays
- Numba JIT-compiled operations for performance
- Threat detection (2-in-a-row, 3-in-a-row with open ends)
- Position evaluation heuristics
- Smart rollout simulation

Board state: np.uint8 array where 0=empty, 1=player1, 2=player2
Cell index: idx = h + r*D + c*D*R (height + row*Depth + col*Depth*Rows)
"""
import numpy as np
from numba import njit


# ============================================================================
# CORE BOARD OPERATIONS
# ============================================================================

@njit(cache=True)
def check_win_optimized(board: np.ndarray, D: int, R: int, C: int, win_length: int,
                        directions: np.ndarray, bounds: np.ndarray) -> int:
    """
    Check if either player has won.

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

                        end_h = h + dh * (win_length - 1)
                        end_r = r + dr * (win_length - 1)
                        end_c = c + dc * (win_length - 1)

                        if end_h < 0 or end_h >= D:
                            continue
                        if end_r < 0 or end_r >= R:
                            continue
                        if end_c < 0 or end_c >= C:
                            continue

                        count = 0
                        check_idx = idx
                        for _ in range(win_length):
                            if board[check_idx] != player:
                                break
                            count += 1
                            check_idx += step

                        if count >= win_length:
                            return player

    return 0


@njit(cache=True)
def get_valid_moves_array(board: np.ndarray, D: int, R: int, C: int) -> np.ndarray:
    """
    Get all valid moves as (row, col) pairs.
    A move is valid if there's at least one empty cell in that column.
    """
    moves = np.zeros((R * C, 2), dtype=np.int32)
    idx = 0

    for c in range(C):
        for r in range(R):
            col_base = r * D + c * D * R
            if board[col_base + D - 1] == 0:
                moves[idx, 0] = r
                moves[idx, 1] = c
                idx += 1

    return moves[:idx]


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
def get_drop_height(board: np.ndarray, r: int, c: int, D: int, R: int) -> int:
    """Get the height where a piece would land at (r, c). Returns -1 if full."""
    col_base = r * D + c * D * R
    for h in range(D):
        if board[col_base + h] == 0:
            return h
    return -1


# ============================================================================
# THREAT DETECTION
# ============================================================================

@njit(cache=True)
def count_line_with_gaps(board: np.ndarray, start_idx: int, step: int,
                          player: int, length: int, total: int) -> tuple:
    """
    Count player pieces and empty spaces in a line segment.

    Returns: (player_count, empty_count, first_empty_idx)
    """
    player_count = 0
    empty_count = 0
    first_empty = -1

    idx = start_idx
    for i in range(length):
        if idx < 0 or idx >= total:
            return (0, 0, -1)

        cell = board[idx]
        if cell == player:
            player_count += 1
        elif cell == 0:
            empty_count += 1
            if first_empty == -1:
                first_empty = idx
        else:
            return (0, 0, -1)

        idx += step

    return (player_count, empty_count, first_empty)


@njit(cache=True)
def check_open_ends(board: np.ndarray, start_h: int, start_r: int, start_c: int,
                    dh: int, dr: int, dc: int, length: int,
                    D: int, R: int, C: int) -> tuple:
    """
    Check if a line segment has open ends (empty cells beyond the segment).

    Returns: (open_before, open_after)
    """
    total = D * R * C

    before_h = start_h - dh
    before_r = start_r - dr
    before_c = start_c - dc
    open_before = False
    if 0 <= before_h < D and 0 <= before_r < R and 0 <= before_c < C:
        before_idx = before_h + before_r * D + before_c * D * R
        if board[before_idx] == 0:
            open_before = True

    end_h = start_h + dh * length
    end_r = start_r + dr * length
    end_c = start_c + dc * length
    open_after = False
    if 0 <= end_h < D and 0 <= end_r < R and 0 <= end_c < C:
        after_idx = end_h + end_r * D + end_c * D * R
        if board[after_idx] == 0:
            open_after = True

    return (open_before, open_after)


@njit(cache=True)
def find_threats(board: np.ndarray, player: int, D: int, R: int, C: int,
                 win_length: int, directions: np.ndarray, bounds: np.ndarray) -> np.ndarray:
    """
    Find all threats for a player.

    A threat is a line where the player can complete a win.

    Returns: Array of threats, each row is:
        [threat_type, row, col, direction_idx, open_ends]

        threat_type: 3 = three-in-a-row (1 to win), 2 = two-in-a-row (2 to win)
        open_ends: 1 = one open end, 2 = both ends open
    """
    total = D * R * C
    n_dirs = directions.shape[0]

    threats = np.zeros((R * C * n_dirs * 4, 5), dtype=np.int32)
    threat_idx = 0

    for c in range(C):
        for r in range(R):
            for h in range(D):
                idx = h + r * D + c * D * R

                if board[idx] != player:
                    continue

                for d in range(n_dirs):
                    step = directions[d]
                    dh, dr, dc = bounds[d, 0], bounds[d, 1], bounds[d, 2]

                    end_h = h + dh * (win_length - 1)
                    end_r = r + dr * (win_length - 1)
                    end_c = c + dc * (win_length - 1)

                    if end_h < 0 or end_h >= D:
                        continue
                    if end_r < 0 or end_r >= R:
                        continue
                    if end_c < 0 or end_c >= C:
                        continue

                    player_count, empty_count, first_empty = count_line_with_gaps(
                        board, idx, step, player, win_length, total
                    )

                    if player_count == 0:
                        continue

                    open_before, open_after = check_open_ends(
                        board, h, r, c, dh, dr, dc, win_length, D, R, C
                    )
                    open_ends = (1 if open_before else 0) + (1 if open_after else 0)

                    if player_count == win_length - 1 and empty_count == 1:
                        empty_h = first_empty % D
                        temp = first_empty // D
                        empty_r = temp % R
                        empty_c = temp // R

                        if empty_h == 0 or board[first_empty - 1] != 0:
                            threats[threat_idx, 0] = 3
                            threats[threat_idx, 1] = empty_r
                            threats[threat_idx, 2] = empty_c
                            threats[threat_idx, 3] = d
                            threats[threat_idx, 4] = open_ends
                            threat_idx += 1

                    elif player_count == win_length - 2 and empty_count == 2 and open_ends >= 1:
                        threats[threat_idx, 0] = 2
                        threats[threat_idx, 1] = r
                        threats[threat_idx, 2] = c
                        threats[threat_idx, 3] = d
                        threats[threat_idx, 4] = open_ends
                        threat_idx += 1

    return threats[:threat_idx]


@njit(cache=True)
def count_threats_by_type(threats: np.ndarray) -> tuple:
    """Count threats by type. Returns (threes, open_threes, twos, open_twos)."""
    threes = 0
    open_threes = 0
    twos = 0
    open_twos = 0

    for i in range(threats.shape[0]):
        threat_type = threats[i, 0]
        open_ends = threats[i, 4]

        if threat_type == 3:
            threes += 1
            if open_ends == 2:
                open_threes += 1
        elif threat_type == 2:
            twos += 1
            if open_ends == 2:
                open_twos += 1

    return (threes, open_threes, twos, open_twos)


@njit(cache=True)
def find_winning_moves(board: np.ndarray, player: int, D: int, R: int, C: int,
                       win_length: int, directions: np.ndarray, bounds: np.ndarray) -> np.ndarray:
    """
    Find all moves that would immediately win for the player.
    Returns array of (row, col) pairs.
    """
    moves = get_valid_moves_array(board, D, R, C)
    winning = np.zeros((moves.shape[0], 2), dtype=np.int32)
    win_idx = 0

    for i in range(moves.shape[0]):
        r, c = moves[i, 0], moves[i, 1]

        test_board = board.copy()
        make_move_array(test_board, r, c, player, D, R)

        if check_win_optimized(test_board, D, R, C, win_length, directions, bounds) == player:
            winning[win_idx, 0] = r
            winning[win_idx, 1] = c
            win_idx += 1

    return winning[:win_idx]


@njit(cache=True)
def find_forcing_moves(board: np.ndarray, player: int, D: int, R: int, C: int,
                       win_length: int, directions: np.ndarray, bounds: np.ndarray) -> np.ndarray:
    """
    Find moves that create multiple threats (forcing/winning positions).
    These are moves that create 2+ three-in-a-rows, making the position unblockable.

    Returns array of (row, col, num_threats) tuples.
    """
    moves = get_valid_moves_array(board, D, R, C)
    forcing = np.zeros((moves.shape[0], 3), dtype=np.int32)
    force_idx = 0

    for i in range(moves.shape[0]):
        r, c = moves[i, 0], moves[i, 1]

        test_board = board.copy()
        make_move_array(test_board, r, c, player, D, R)

        threats = find_threats(test_board, player, D, R, C, win_length, directions, bounds)
        threes, open_threes, twos, open_twos = count_threats_by_type(threats)

        if threes >= 2:
            forcing[force_idx, 0] = r
            forcing[force_idx, 1] = c
            forcing[force_idx, 2] = threes
            force_idx += 1

    return forcing[:force_idx]


# ============================================================================
# POSITION EVALUATION
# ============================================================================

@njit(cache=True)
def evaluate_position(board: np.ndarray, player: int, D: int, R: int, C: int,
                      win_length: int, directions: np.ndarray, bounds: np.ndarray,
                      center_r: float, center_c: float) -> float:
    """
    Evaluate board position for a player.

    Higher score = better for player.
    Uses threat counts, center control, and piece connectivity.
    """
    opponent = 3 - player

    winner = check_win_optimized(board, D, R, C, win_length, directions, bounds)
    if winner == player:
        return 10000.0
    elif winner == opponent:
        return -10000.0

    my_threats = find_threats(board, player, D, R, C, win_length, directions, bounds)
    opp_threats = find_threats(board, opponent, D, R, C, win_length, directions, bounds)

    my_threes, my_open_threes, my_twos, my_open_twos = count_threats_by_type(my_threats)
    opp_threes, opp_open_threes, opp_twos, opp_open_twos = count_threats_by_type(opp_threats)

    score = 0.0

    score += my_threes * 100.0
    score += my_open_threes * 500.0
    score += my_twos * 10.0
    score += my_open_twos * 30.0

    score -= opp_threes * 100.0
    score -= opp_open_threes * 500.0
    score -= opp_twos * 10.0
    score -= opp_open_twos * 30.0

    if my_threes >= 2:
        score += 5000.0
    if opp_threes >= 2:
        score -= 5000.0

    total = D * R * C
    for c in range(C):
        for r in range(R):
            for h in range(D):
                idx = h + r * D + c * D * R
                cell = board[idx]
                if cell == 0:
                    continue

                dist = abs(r - center_r) + abs(c - center_c)
                center_bonus = (3.0 - dist) * 2.0

                if cell == player:
                    score += center_bonus
                else:
                    score -= center_bonus

    return score


@njit(cache=True)
def score_move(board: np.ndarray, r: int, c: int, player: int,
               D: int, R: int, C: int, win_length: int,
               directions: np.ndarray, bounds: np.ndarray,
               center_r: float, center_c: float) -> float:
    """Score a potential move. Higher = better."""
    test_board = board.copy()
    make_move_array(test_board, r, c, player, D, R)

    if check_win_optimized(test_board, D, R, C, win_length, directions, bounds) == player:
        return 100000.0

    opp_test = board.copy()
    opponent = 3 - player
    make_move_array(opp_test, r, c, opponent, D, R)
    if check_win_optimized(opp_test, D, R, C, win_length, directions, bounds) == opponent:
        return 50000.0

    score = 0.0

    my_threats = find_threats(test_board, player, D, R, C, win_length, directions, bounds)
    my_threes, my_open_threes, my_twos, my_open_twos = count_threats_by_type(my_threats)

    if my_threes >= 2:
        score += 10000.0

    score += my_threes * 100.0
    score += my_open_threes * 300.0
    score += my_twos * 10.0
    score += my_open_twos * 25.0

    opp_threats = find_threats(test_board, opponent, D, R, C, win_length, directions, bounds)
    opp_threes, opp_open_threes, opp_twos, opp_open_twos = count_threats_by_type(opp_threats)

    if opp_threes >= 2:
        score -= 8000.0
    score -= opp_threes * 80.0
    score -= opp_open_threes * 200.0

    dist = abs(r - center_r) + abs(c - center_c)
    score += (3.0 - dist) * 5.0

    return score


# ============================================================================
# SMART ROLLOUT SIMULATION
# ============================================================================

@njit(cache=True)
def simulate_rollout_smart(
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
    Smart rollout that plays and blocks threats.

    Strategy:
    1. If can win, win
    2. If opponent can win, block
    3. If can create double threat, do it
    4. Otherwise, 70% prefer center, 30% random

    Returns: 1 if P1 wins, 2 if P2 wins, 0 for draw
    """
    sim_board = board.copy()
    curr_player = prev_player
    max_moves = D * R * C

    for _ in range(max_moves):
        winner = check_win_optimized(sim_board, D, R, C, win_length, directions, bounds)
        if winner != 0:
            return winner

        moves = get_valid_moves_array(sim_board, D, R, C)
        if moves.shape[0] == 0:
            return 0

        curr_player = 3 - curr_player
        opponent = 3 - curr_player

        selected_r = -1
        selected_c = -1

        # Check for winning move
        for i in range(moves.shape[0]):
            r, c = moves[i, 0], moves[i, 1]
            test = sim_board.copy()
            make_move_array(test, r, c, curr_player, D, R)
            if check_win_optimized(test, D, R, C, win_length, directions, bounds) == curr_player:
                selected_r, selected_c = r, c
                break

        # Check for blocking move
        if selected_r == -1:
            for i in range(moves.shape[0]):
                r, c = moves[i, 0], moves[i, 1]
                test = sim_board.copy()
                make_move_array(test, r, c, opponent, D, R)
                if check_win_optimized(test, D, R, C, win_length, directions, bounds) == opponent:
                    selected_r, selected_c = r, c
                    break

        # Try to create double threat
        rng_state[0] = (rng_state[0] * 1103515245 + 12345) & 0x7FFFFFFF
        if selected_r == -1 and (rng_state[0] % 100) < 70:
            best_score = -1.0
            for i in range(moves.shape[0]):
                r, c = moves[i, 0], moves[i, 1]
                test = sim_board.copy()
                make_move_array(test, r, c, curr_player, D, R)

                threats = find_threats(test, curr_player, D, R, C, win_length, directions, bounds)
                threes, open_threes, _, _ = count_threats_by_type(threats)

                score = threes * 10.0 + open_threes * 20.0

                opp_threats = find_threats(test, opponent, D, R, C, win_length, directions, bounds)
                opp_threes, opp_open_threes, _, _ = count_threats_by_type(opp_threats)
                score -= opp_open_threes * 15.0

                if score > best_score:
                    best_score = score
                    if score > 15.0:
                        selected_r, selected_c = r, c

        # Default: center-biased random
        if selected_r == -1:
            rng_state[0] = (rng_state[0] * 1103515245 + 12345) & 0x7FFFFFFF

            if (rng_state[0] % 100) < 65:
                best_dist = 1000.0
                best_idx = 0
                for i in range(moves.shape[0]):
                    dist = abs(moves[i, 0] - center_r) + abs(moves[i, 1] - center_c)
                    if dist < best_dist:
                        best_dist = dist
                        best_idx = i
                selected_r, selected_c = moves[best_idx, 0], moves[best_idx, 1]
            else:
                rng_state[0] = (rng_state[0] * 1103515245 + 12345) & 0x7FFFFFFF
                idx = rng_state[0] % moves.shape[0]
                selected_r, selected_c = moves[idx, 0], moves[idx, 1]

        make_move_array(sim_board, selected_r, selected_c, curr_player, D, R)

    return 0


# ============================================================================
# PRECOMPUTATION
# ============================================================================

def compute_directions_and_bounds(D: int, R: int, C: int) -> tuple:
    """
    Precompute direction steps and bounds deltas for all 13 directions.
    Returns: (directions array, bounds array)
    """
    raw_directions = [
        (1, 0, 0),   # Vertical (height)
        (0, 1, 0),   # Row
        (0, 0, 1),   # Column
        (1, 1, 0),   # h+r diagonal
        (1, -1, 0),  # h-r diagonal
        (0, 1, 1),   # r+c diagonal
        (0, 1, -1),  # r-c diagonal
        (1, 0, 1),   # h+c diagonal
        (1, 0, -1),  # h-c diagonal
        (1, 1, 1),   # h+r+c (3D diagonal)
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
# WRAPPER CLASS
# ============================================================================

class BitBoard:
    """
    Numba-accelerated board with threat detection.

    Board is represented as a 1D numpy array (0=empty, 1=P1, 2=P2).
    Indexing: cell_idx = h + r*D + c*D*R
    """

    def __init__(self, dimensions=(6, 6, 7), win_length=4, copy_from=None):
        if copy_from:
            self.D, self.R, self.C = copy_from.D, copy_from.R, copy_from.C
            self.win_length = copy_from.win_length
            self.board = copy_from.board.copy()
            self.directions = copy_from.directions
            self.bounds = copy_from.bounds
            self.center_r = copy_from.center_r
            self.center_c = copy_from.center_c
        else:
            self.D, self.R, self.C = dimensions
            self.win_length = win_length
            self.board = np.zeros(self.D * self.R * self.C, dtype=np.uint8)
            self.center_r = self.R / 2.0
            self.center_c = self.C / 2.0
            self.directions, self.bounds = compute_directions_and_bounds(self.D, self.R, self.C)

    def copy(self) -> 'BitBoard':
        return BitBoard(copy_from=self)

    def make_move(self, r: int, c: int, player: int) -> bool:
        return make_move_array(self.board, r, c, player, self.D, self.R)

    def check_win(self) -> int:
        return check_win_optimized(self.board, self.D, self.R, self.C,
                                   self.win_length, self.directions, self.bounds)

    def get_valid_moves(self) -> list:
        moves_arr = get_valid_moves_array(self.board, self.D, self.R, self.C)
        return [(int(moves_arr[i, 0]), int(moves_arr[i, 1])) for i in range(moves_arr.shape[0])]

    def get_valid_moves_array(self) -> np.ndarray:
        return get_valid_moves_array(self.board, self.D, self.R, self.C)

    def find_threats(self, player: int) -> np.ndarray:
        """Find all threats for a player."""
        return find_threats(self.board, player, self.D, self.R, self.C,
                           self.win_length, self.directions, self.bounds)

    def find_winning_moves(self, player: int) -> list:
        """Find all immediately winning moves."""
        moves = find_winning_moves(self.board, player, self.D, self.R, self.C,
                                   self.win_length, self.directions, self.bounds)
        return [(int(moves[i, 0]), int(moves[i, 1])) for i in range(moves.shape[0])]

    def find_forcing_moves(self, player: int) -> list:
        """Find moves that create double threats."""
        moves = find_forcing_moves(self.board, player, self.D, self.R, self.C,
                                   self.win_length, self.directions, self.bounds)
        return [(int(moves[i, 0]), int(moves[i, 1]), int(moves[i, 2]))
                for i in range(moves.shape[0])]

    def evaluate(self, player: int) -> float:
        """Evaluate position for player."""
        return evaluate_position(self.board, player, self.D, self.R, self.C,
                                self.win_length, self.directions, self.bounds,
                                self.center_r, self.center_c)

    def score_move(self, r: int, c: int, player: int) -> float:
        """Score a potential move."""
        return score_move(self.board, r, c, player, self.D, self.R, self.C,
                         self.win_length, self.directions, self.bounds,
                         self.center_r, self.center_c)

    def simulate_rollout(self, prev_player: int, seed: int = None) -> int:
        """Run a smart rollout simulation."""
        if seed is None:
            seed = np.random.randint(0, 2**31)
        rng_state = np.array([seed], dtype=np.int64)
        return simulate_rollout_smart(
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
                    if val == 1: row_str += "X "
                    elif val == 2: row_str += "O "
                    else: row_str += ". "
                print(row_str)
            print()


# Backwards compatibility alias
FastBitBoard = BitBoard


# ============================================================================
# TESTING
# ============================================================================

if __name__ == "__main__":
    import time

    print("=" * 60)
    print("BITBOARD TEST")
    print("=" * 60)

    print("\nWarming up Numba JIT...")
    fb = BitBoard(dimensions=(6, 6, 7), win_length=4)
    fb.check_win()
    fb.get_valid_moves()
    fb.find_threats(1)
    fb.simulate_rollout(2, seed=12345)
    print("JIT ready.\n")

    print("Testing threat detection...")
    fb = BitBoard(dimensions=(6, 6, 7), win_length=4)

    fb.make_move(3, 3, 1)
    fb.make_move(3, 4, 1)
    fb.make_move(3, 5, 1)

    threats = fb.find_threats(1)
    print(f"Player 1 threats: {threats.shape[0]}")

    forcing = fb.find_forcing_moves(1)
    print(f"Forcing moves: {forcing}")

    winning = fb.find_winning_moves(1)
    print(f"Winning moves: {winning}")

    score = fb.evaluate(1)
    print(f"Position score for P1: {score:.1f}")

    print("\nBenchmarking smart rollouts...")
    fb2 = BitBoard(dimensions=(6, 6, 7), win_length=4)

    start = time.perf_counter()
    for i in range(1000):
        fb2.simulate_rollout(2, seed=i)
    elapsed = time.perf_counter() - start

    print(f"1000 smart rollouts: {elapsed:.2f}s ({1000/elapsed:.0f}/sec)")

    print("\nAll tests passed!")
