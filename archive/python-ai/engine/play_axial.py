"""
Play Axial against the MCTS AI in the terminal.

Axial is a 3D Connect-4 variant played on a 6x6x7 board.
The AI uses Monte Carlo Tree Search with:
- Threat detection (2-in-a-row, 3-in-a-row patterns)
- Forced win search (double threats)
- Smart move ordering based on tactical value
- Improved rollout policy

Game Modes:
- Single round (default): First to get 4-in-a-row wins
- Multi-round: First to win N rounds wins the match (board resets each round)
- Continuous: Score N 4-in-a-rows on the SAME board to win (pieces stay)

Usage:
    python play_axial.py                  # Default (hard, single round)
    python play_axial.py easy             # Easy difficulty
    python play_axial.py hard 3           # Hard, first to 3 rounds
    python play_axial.py hard 3 continuous # Hard, score 3 lines on same board
    python play_axial.py medium 5 c       # Medium, 5 lines continuous mode
"""
import sys
import time
import numpy as np

from bitboard import BitBoard
from mcts import MCTS


DIFFICULTIES = {
    'easy': 200,
    'medium': 500,
    'hard': 1000,
    'nightmare': 2000
}


def print_board(board: BitBoard, last_move=None, scores=None, scored_cells=None):
    """
    Print the 3D board in a readable format.
    Shows each layer (height) of the 6x6x7 board.

    Args:
        board: The game board
        last_move: (row, col) of the last move made
        scores: (human_score, ai_score) tuple for multi-round games
        scored_cells: set of cell indices used in scored lines (continuous mode)
    """
    D, R, C = board.D, board.R, board.C

    print()

    if scores:
        print("=" * 50)
        print("  SCORE: You (X) {} - {} AI (O)".format(scores[0], scores[1]))
        print("=" * 50)
    else:
        print("=" * 50)

    col_labels = "    " + "  ".join("{:2d}".format(c) for c in range(C))

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

                is_last = (last_move is not None and
                          last_move == (r, c) and
                          h == get_top_height(board, r, c))

                is_scored = scored_cells and cell_idx in scored_cells

                if cell == 0:
                    char = " . "
                elif cell == 1:
                    if is_last:
                        char = "[X]"
                    elif is_scored:
                        char = " x "
                    else:
                        char = " X "
                else:
                    if is_last:
                        char = "[O]"
                    elif is_scored:
                        char = " o "
                    else:
                        char = " O "

                row_str += char + "|"
            print(row_str)
        print("    " + "-" * (C * 4 - 1))

    print()
    print("You are X (Player 1), AI is O (Player 2)")
    if scored_cells:
        print("Lowercase (x/o) = cells already used in scored lines")
    print("=" * 50)


def get_top_height(board: BitBoard, row: int, col: int) -> int:
    """Get the height of the top piece at (row, col), or -1 if empty."""
    D, R = board.D, board.R
    for h in range(D - 1, -1, -1):
        cell_idx = h + row * D + col * D * R
        if board.board[cell_idx] != 0:
            return h
    return -1


def find_new_lines(board: BitBoard, player: int, scored_cells: set) -> list:
    """
    Find all 4-in-a-row lines for player that contain at least one new cell.

    Returns list of line_cells where line_cells is a list of cell indices.
    Only returns lines where at least one cell is not in scored_cells.
    """
    D, R, C = board.D, board.R, board.C
    win_length = board.win_length
    directions = board.directions
    bounds = board.bounds

    new_lines = []

    for c_idx in range(C):
        for r in range(R):
            for h in range(D):
                idx = h + r * D + c_idx * D * R
                if board.board[idx] != player:
                    continue

                for d in range(len(directions)):
                    step = directions[d]
                    dh, dr, dc = bounds[d, 0], bounds[d, 1], bounds[d, 2]

                    end_h = h + dh * (win_length - 1)
                    end_r = r + dr * (win_length - 1)
                    end_c = c_idx + dc * (win_length - 1)

                    if not (0 <= end_h < D and 0 <= end_r < R and 0 <= end_c < C):
                        continue

                    line_cells = []
                    check_idx = idx
                    valid = True

                    for _ in range(win_length):
                        if board.board[check_idx] != player:
                            valid = False
                            break
                        line_cells.append(check_idx)
                        check_idx += step

                    if valid and len(line_cells) == win_length:
                        has_new = any(cell not in scored_cells for cell in line_cells)
                        if has_new:
                            new_lines.append(line_cells)

    return new_lines


def parse_move(input_str: str, valid_moves: list) -> tuple:
    """
    Parse user input into a move.

    Accepts:
    - "row,col" or "row col" (e.g., "2,3" or "2 3")
    - Index from the valid moves list (e.g., "0" for first valid move)

    Returns:
    - (row, col) tuple if valid
    - None if user wants to quit
    - 'hint' if user wants a hint
    - 'invalid' if input couldn't be parsed
    """
    input_str = input_str.strip().lower()

    if input_str in ['q', 'quit', 'exit']:
        return None

    if input_str in ['h', 'hint']:
        return 'hint'

    try:
        if ',' in input_str:
            parts = input_str.split(',')
        else:
            parts = input_str.split()

        if len(parts) == 2:
            row = int(parts[0].strip())
            col = int(parts[1].strip())

            if (row, col) in valid_moves:
                return (row, col)
            else:
                print("Invalid move: position ({}, {}) is not available".format(row, col))
                return 'invalid'
    except ValueError:
        pass

    try:
        idx = int(input_str)
        if 0 <= idx < len(valid_moves):
            return valid_moves[idx]
        else:
            print("Index {} out of range (0-{})".format(idx, len(valid_moves)-1))
            return 'invalid'
    except ValueError:
        pass

    print("Could not parse move. Use 'row,col' format (e.g., '2,3')")
    return 'invalid'


def play_round(ai_simulations: int, human_player: int, ai_player: int,
               round_num: int = 1, scores: tuple = None) -> int:
    """
    Play a single round.

    Args:
        ai_simulations: MCTS simulations per move
        human_player: 1 or 2
        ai_player: 1 or 2
        round_num: Current round number (for display)
        scores: Current (human_score, ai_score) or None for single-round

    Returns:
        Winner of this round (1 or 2), or 0 for draw, or -1 if quit
    """
    board = BitBoard(dimensions=(6, 6, 7), win_length=4)

    current_player = 1
    last_move = None
    move_count = 0

    mcts = MCTS(board, prev_player=2)

    if scores:
        print()
        print("=" * 50)
        print("ROUND {} | Score: You {} - {} AI".format(round_num, scores[0], scores[1]))
        print("=" * 50)
        print("{} goes first this round.".format("You" if human_player == 1 else "AI"))

    while True:
        print_board(board, last_move, scores)

        winner = board.check_win()
        if winner != 0:
            if winner == human_player:
                print("You win this round!")
            else:
                print("AI wins this round!")
            return winner

        valid_moves = board.get_valid_moves()
        if not valid_moves:
            print("This round is a draw!")
            return 0

        move_count += 1

        if current_player == human_player:
            print("Your turn (X). Move {}".format(move_count))
            print("Valid moves (row,col): {}".format(valid_moves[:10]))
            if len(valid_moves) > 10:
                print("                       ... and {} more".format(len(valid_moves) - 10))

            while True:
                try:
                    user_input = input("Enter move (row,col): ")
                except (EOFError, KeyboardInterrupt):
                    print("\nGoodbye!")
                    return -1

                move = parse_move(user_input, valid_moves)

                if move is None:
                    return -1
                elif move == 'hint':
                    print("Thinking...")
                    hint_mcts = MCTS(board, prev_player=ai_player)
                    hint = hint_mcts.search(simulations=ai_simulations)
                    print("AI suggests: row={}, col={}".format(hint[0], hint[1]))
                    continue
                elif move == 'invalid':
                    continue
                else:
                    break

            board.make_move(move[0], move[1], human_player)
            last_move = move

            if not mcts.advance_root(move):
                mcts = MCTS(board, prev_player=human_player)

        else:
            print("AI is thinking (O)... Move {}".format(move_count))

            start = time.time()
            ai_move = mcts.search(simulations=ai_simulations)
            elapsed = time.time() - start

            print("AI plays: row={}, col={} ({:.1f}s, {} sims)".format(
                ai_move[0], ai_move[1], elapsed, mcts.total_simulations))

            board.make_move(ai_move[0], ai_move[1], ai_player)
            last_move = ai_move

            if not mcts.advance_root(ai_move):
                mcts = MCTS(board, prev_player=ai_player)

        current_player = 3 - current_player

    return 0


def play_continuous(ai_simulations: int = 800, lines_needed: int = 3, human_first: bool = True):
    """
    Play a continuous game where you need to score N lines on the same board.

    Pieces stay on the board. Once a 4-in-a-row is scored, those cells are marked
    and can't be used in future lines. Game ends when someone scores N lines or
    board fills up.

    Args:
        ai_simulations: MCTS simulations per move
        lines_needed: Number of 4-in-a-rows needed to win
        human_first: If True, human plays as Player 1
    """
    board = BitBoard(dimensions=(6, 6, 7), win_length=4)

    human_player = 1 if human_first else 2
    ai_player = 2 if human_first else 1
    current_player = 1

    human_lines = 0
    ai_lines = 0
    scored_cells = set()

    last_move = None
    move_count = 0

    mcts = MCTS(board, prev_player=2)

    print()
    print("=" * 50)
    print("AXIAL - 3D Connect 4 (CONTINUOUS MODE)")
    print("=" * 50)
    print("Board: 6 rows x 7 columns x 6 layers high")
    print("Goal: Score {} 4-in-a-rows to win!".format(lines_needed))
    print("      Pieces stay - scored cells shown as lowercase")
    print("AI Strength: {} MCTS simulations/move".format(ai_simulations))
    print()
    print("Commands:")
    print("  row,col  - Drop piece at row, column (e.g., '2,3')")
    print("  h        - Get a hint from the AI")
    print("  q        - Quit")
    print("=" * 50)

    while human_lines < lines_needed and ai_lines < lines_needed:
        scores = (human_lines, ai_lines)
        print_board(board, last_move, scores, scored_cells)

        valid_moves = board.get_valid_moves()
        if not valid_moves:
            print("Board is full! Game over.")
            break

        move_count += 1

        if current_player == human_player:
            print("Your turn (X). Move {} | Lines: You {} - {} AI".format(
                move_count, human_lines, ai_lines))
            print("Valid moves (row,col): {}".format(valid_moves[:10]))
            if len(valid_moves) > 10:
                print("                       ... and {} more".format(len(valid_moves) - 10))

            while True:
                try:
                    user_input = input("Enter move (row,col): ")
                except (EOFError, KeyboardInterrupt):
                    print("\nGoodbye!")
                    return

                move = parse_move(user_input, valid_moves)

                if move is None:
                    print("Goodbye!")
                    return
                elif move == 'hint':
                    print("Thinking...")
                    hint_mcts = MCTS(board, prev_player=ai_player)
                    hint = hint_mcts.search(simulations=ai_simulations)
                    print("AI suggests: row={}, col={}".format(hint[0], hint[1]))
                    continue
                elif move == 'invalid':
                    continue
                else:
                    break

            board.make_move(move[0], move[1], human_player)
            last_move = move

            new_lines = find_new_lines(board, human_player, scored_cells)
            if new_lines:
                for line in new_lines:
                    human_lines += 1
                    for cell_idx in line:
                        scored_cells.add(cell_idx)
                    print("You scored a line! ({}/{})".format(human_lines, lines_needed))

            if not mcts.advance_root(move):
                mcts = MCTS(board, prev_player=human_player)

        else:
            print("AI is thinking (O)... Move {} | Lines: You {} - {} AI".format(
                move_count, human_lines, ai_lines))

            start = time.time()
            ai_move = mcts.search(simulations=ai_simulations)
            elapsed = time.time() - start

            print("AI plays: row={}, col={} ({:.1f}s, {} sims)".format(
                ai_move[0], ai_move[1], elapsed, mcts.total_simulations))

            board.make_move(ai_move[0], ai_move[1], ai_player)
            last_move = ai_move

            new_lines = find_new_lines(board, ai_player, scored_cells)
            if new_lines:
                for line in new_lines:
                    ai_lines += 1
                    for cell_idx in line:
                        scored_cells.add(cell_idx)
                    print("AI scored a line! ({}/{})".format(ai_lines, lines_needed))

            if not mcts.advance_root(ai_move):
                mcts = MCTS(board, prev_player=ai_player)

        current_player = 3 - current_player

    print_board(board, last_move, (human_lines, ai_lines), scored_cells)

    print()
    print("=" * 50)
    if human_lines >= lines_needed:
        print("YOU WIN!")
    elif ai_lines >= lines_needed:
        print("AI WINS!")
    else:
        if human_lines > ai_lines:
            print("YOU WIN! (More lines when board filled)")
        elif ai_lines > human_lines:
            print("AI WINS! (More lines when board filled)")
        else:
            print("IT'S A TIE!")
    print("Final Score: You {} - {} AI".format(human_lines, ai_lines))
    print("=" * 50)

    print()
    try:
        again = input("Play again? (y/n): ").strip().lower()
        if again in ['y', 'yes']:
            play_continuous(ai_simulations, lines_needed, not human_first)
    except (EOFError, KeyboardInterrupt):
        pass


def play_match(ai_simulations: int = 800, wins_needed: int = 1, human_first: bool = True):
    """
    Play a match (one or more rounds).

    Args:
        ai_simulations: MCTS simulations per move
        wins_needed: Number of round wins needed to win the match
        human_first: If True, human plays as Player 1 in first round
    """
    human_score = 0
    ai_score = 0
    round_num = 0

    human_player = 1 if human_first else 2
    ai_player = 2 if human_first else 1

    print()
    print("=" * 50)
    print("AXIAL - 3D Connect 4")
    print("=" * 50)
    print("Board: 6 rows x 7 columns x 6 layers high")
    print("Goal: Connect 4 in any direction (including 3D diagonals)")
    print("AI Strength: {} MCTS simulations/move".format(ai_simulations))
    if wins_needed > 1:
        print("Match: First to {} wins!".format(wins_needed))
    print()
    print("Commands:")
    print("  row,col  - Drop piece at row, column (e.g., '2,3')")
    print("  h        - Get a hint from the AI")
    print("  q        - Quit")
    print("=" * 50)

    while human_score < wins_needed and ai_score < wins_needed:
        round_num += 1

        scores = (human_score, ai_score) if wins_needed > 1 else None

        winner = play_round(
            ai_simulations=ai_simulations,
            human_player=human_player,
            ai_player=ai_player,
            round_num=round_num,
            scores=scores
        )

        if winner == -1:
            print("Goodbye!")
            return

        if winner == human_player:
            human_score += 1
            print()
            print("*** You scored! ({}/{}) ***".format(human_score, wins_needed))
        elif winner == ai_player:
            ai_score += 1
            print()
            print("*** AI scored! ({}/{}) ***".format(ai_score, wins_needed))
        else:
            print()
            print("*** Draw - no points awarded ***")

        if human_score >= wins_needed:
            print()
            print("=" * 50)
            print("YOU WIN THE MATCH!")
            print("Final Score: {} - {}".format(human_score, ai_score))
            print("=" * 50)
            break
        elif ai_score >= wins_needed:
            print()
            print("=" * 50)
            print("AI WINS THE MATCH!")
            print("Final Score: {} - {}".format(human_score, ai_score))
            print("=" * 50)
            break

        human_player = 3 - human_player
        ai_player = 3 - ai_player

        if wins_needed > 1:
            print()
            try:
                input("Press Enter to start round {}...".format(round_num + 1))
            except (EOFError, KeyboardInterrupt):
                print("\nGoodbye!")
                return

    print()
    try:
        again = input("Play again? (y/n): ").strip().lower()
        if again in ['y', 'yes']:
            play_match(ai_simulations, wins_needed, not human_first)
    except (EOFError, KeyboardInterrupt):
        pass


def main():
    difficulty = 'hard'
    wins_needed = 1
    ai_sims = None
    continuous_mode = False

    args = sys.argv[1:]

    if len(args) >= 1:
        arg1 = args[0].lower()

        if arg1 in ['-h', '--help']:
            print(__doc__)
            return
        elif arg1 in DIFFICULTIES:
            difficulty = arg1
            ai_sims = DIFFICULTIES[difficulty]
        else:
            try:
                ai_sims = int(arg1)
            except ValueError:
                print("Unknown difficulty: {}".format(arg1))
                print("Available: easy, medium, hard, nightmare")
                print("Or specify simulation count directly (e.g., 500)")
                return

    if len(args) >= 2:
        try:
            wins_needed = int(args[1])
            if wins_needed < 1:
                print("Wins needed must be at least 1")
                return
        except ValueError:
            print("Invalid wins_needed: {}".format(args[1]))
            return

    if len(args) >= 3:
        arg3 = args[2].lower()
        if arg3 in ['c', 'continuous', 'cont']:
            continuous_mode = True

    if ai_sims is None:
        ai_sims = DIFFICULTIES[difficulty]

    if continuous_mode:
        print("Starting CONTINUOUS game: Score {} lines on same board! ({} sims)".format(
            wins_needed, ai_sims))
        play_continuous(ai_simulations=ai_sims, lines_needed=wins_needed)
    elif wins_needed == 1:
        print("Starting single-round game with {} difficulty ({} sims)".format(
            difficulty, ai_sims))
        play_match(ai_simulations=ai_sims, wins_needed=wins_needed)
    else:
        print("Starting match: First to {} round wins! ({} difficulty, {} sims)".format(
            wins_needed, difficulty, ai_sims))
        play_match(ai_simulations=ai_sims, wins_needed=wins_needed)


if __name__ == "__main__":
    main()
