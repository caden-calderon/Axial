"""
Axial AI Server - Socket-based communication bridge for Unity.

This server wraps the MCTS AI and provides a JSON-based protocol
for Unity to communicate with.

Protocol:
- All messages are JSON objects terminated by newline
- Server listens on localhost:5555 by default

Message Types:
1. INIT: Initialize game with difficulty
   Request:  {"type": "init", "difficulty": "easy|medium|hard|nightmare", "ai_plays_first": false}
   Response: {"type": "init_ok", "ai_player": 2, "human_player": 1}

2. MOVE: Human makes a move, get AI response
   Request:  {"type": "move", "row": 0, "col": 0}
   Response: {"type": "ai_move", "row": 0, "col": 0, "time": 0.5, "simulations": 1000}

3. AI_FIRST: Request AI to make the first move
   Request:  {"type": "ai_first"}
   Response: {"type": "ai_move", "row": 0, "col": 0, "time": 0.5, "simulations": 1000}

4. STATE: Sync full board state (for recovery/debugging)
   Request:  {"type": "state", "board": [...], "current_player": 1}
   Response: {"type": "state_ok"}

5. RESET: Reset the game
   Request:  {"type": "reset", "ai_plays_first": false}
   Response: {"type": "reset_ok", "ai_player": 2}

6. CHECK_WIN: Check if anyone has won
   Request:  {"type": "check_win"}
   Response: {"type": "win_result", "winner": 0}  # 0=none, 1=P1, 2=P2

7. QUIT: Disconnect
   Request:  {"type": "quit"}
   Response: {"type": "goodbye"}

Usage:
    python axial_ai_server.py                  # Default port 5555
    python axial_ai_server.py --port 5556      # Custom port
    python axial_ai_server.py --warmup         # Pre-warm Numba JIT
"""

import socket
import json
import time
import argparse
import sys
import traceback
import numpy as np

from bitboard import BitBoard
from mcts import MCTS


DIFFICULTIES = {
    'easy': 200,
    'medium': 500,
    'hard': 1000,
    'nightmare': 2000
}


class AxialAIServer:
    """Socket server for Axial AI communication with Unity."""

    def __init__(self, host='127.0.0.1', port=5555):
        self.host = host
        self.port = port
        self.socket = None
        self.conn = None

        self.board = None
        self.mcts = None
        self.difficulty = 'hard'
        self.simulations = DIFFICULTIES['hard']
        self.human_player = 1
        self.ai_player = 2
        self.current_player = 1
        self.game_active = False

        self.D = 6
        self.R = 6
        self.C = 7

    def start(self):
        """Start the server and listen for connections."""
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.bind((self.host, self.port))
        self.socket.listen(1)

        print(f"[Axial AI Server] Listening on {self.host}:{self.port}")
        print(f"[Axial AI Server] Board dimensions: {self.D}x{self.R}x{self.C}")
        print(f"[Axial AI Server] Waiting for Unity connection...")

        while True:
            try:
                self.conn, addr = self.socket.accept()
                print(f"[Axial AI Server] Connected by {addr}")
                self._handle_client()
            except KeyboardInterrupt:
                print("\n[Axial AI Server] Shutting down...")
                break
            except Exception as e:
                print(f"[Axial AI Server] Error: {e}")
                traceback.print_exc()
            finally:
                if self.conn:
                    self.conn.close()
                    self.conn = None

        self.socket.close()

    def _handle_client(self):
        """Handle messages from a connected client."""
        buffer = ""

        while True:
            try:
                data = self.conn.recv(4096).decode('utf-8')
                if not data:
                    print("[Axial AI Server] Client disconnected")
                    break

                buffer += data

                while '\n' in buffer:
                    line, buffer = buffer.split('\n', 1)
                    if line.strip():
                        response = self._process_message(line.strip())
                        if response:
                            self._send_response(response)

                            if response.get('type') == 'goodbye':
                                return

            except ConnectionResetError:
                print("[Axial AI Server] Client connection reset")
                break
            except Exception as e:
                print(f"[Axial AI Server] Error handling message: {e}")
                traceback.print_exc()
                self._send_response({'type': 'error', 'message': str(e)})

    def _send_response(self, response: dict):
        """Send a JSON response to the client."""
        try:
            message = json.dumps(response) + '\n'
            self.conn.sendall(message.encode('utf-8'))
        except Exception as e:
            print(f"[Axial AI Server] Error sending response: {e}")

    def _process_message(self, message: str) -> dict:
        """Process a JSON message and return a response."""
        try:
            msg = json.loads(message)
            msg_type = msg.get('type', '')

            print(f"[Axial AI Server] Received: {msg_type}")

            if msg_type == 'init':
                return self._handle_init(msg)
            elif msg_type == 'move':
                return self._handle_move(msg)
            elif msg_type == 'ai_first':
                return self._handle_ai_first(msg)
            elif msg_type == 'state':
                return self._handle_state(msg)
            elif msg_type == 'reset':
                return self._handle_reset(msg)
            elif msg_type == 'check_win':
                return self._handle_check_win(msg)
            elif msg_type == 'quit':
                return {'type': 'goodbye'}
            else:
                return {'type': 'error', 'message': f'Unknown message type: {msg_type}'}

        except json.JSONDecodeError as e:
            return {'type': 'error', 'message': f'Invalid JSON: {e}'}

    def _handle_init(self, msg: dict) -> dict:
        """Initialize a new game."""
        self.difficulty = msg.get('difficulty', 'hard').lower()
        if self.difficulty in DIFFICULTIES:
            self.simulations = DIFFICULTIES[self.difficulty]
        else:
            try:
                self.simulations = int(self.difficulty)
                self.difficulty = 'custom'
            except ValueError:
                self.simulations = DIFFICULTIES['hard']
                self.difficulty = 'hard'

        ai_plays_first = msg.get('ai_plays_first', False)
        if ai_plays_first:
            self.ai_player = 1
            self.human_player = 2
        else:
            self.ai_player = 2
            self.human_player = 1

        self.current_player = 1

        self.board = BitBoard(dimensions=(self.D, self.R, self.C), win_length=4)
        self.mcts = None
        self.game_active = True

        print(f"[Axial AI Server] Game initialized: {self.difficulty} ({self.simulations} sims)")
        print(f"[Axial AI Server] AI is Player {self.ai_player}, Human is Player {self.human_player}")

        return {
            'type': 'init_ok',
            'ai_player': self.ai_player,
            'human_player': self.human_player,
            'difficulty': self.difficulty,
            'simulations': self.simulations
        }

    def _handle_move(self, msg: dict) -> dict:
        """Handle human move and return AI response."""
        if not self.game_active or self.board is None:
            return {'type': 'error', 'message': 'Game not initialized'}

        row = msg.get('row', 0)
        col = msg.get('col', 0)

        valid_moves = self.board.get_valid_moves()
        if (row, col) not in valid_moves:
            return {'type': 'error', 'message': f'Invalid move: ({row}, {col})'}

        self.board.make_move(row, col, self.human_player)
        print(f"[Axial AI Server] Human played: ({row}, {col})")

        winner = self.board.check_win()
        if winner != 0:
            self.game_active = False
            return {
                'type': 'game_over',
                'winner': winner,
                'winner_name': 'human' if winner == self.human_player else 'ai'
            }

        if len(self.board.get_valid_moves()) == 0:
            self.game_active = False
            return {'type': 'game_over', 'winner': 0, 'winner_name': 'draw'}

        if self.mcts is not None:
            if not self.mcts.advance_root((row, col)):
                self.mcts = MCTS(self.board, prev_player=self.human_player)
        else:
            self.mcts = MCTS(self.board, prev_player=self.human_player)

        start_time = time.time()
        ai_move = self.mcts.search(simulations=self.simulations)
        elapsed = time.time() - start_time

        if ai_move is None:
            return {'type': 'error', 'message': 'AI could not find a valid move'}

        self.board.make_move(ai_move[0], ai_move[1], self.ai_player)
        print(f"[Axial AI Server] AI played: ({ai_move[0]}, {ai_move[1]}) in {elapsed:.2f}s")

        self.mcts.advance_root(ai_move)

        winner = self.board.check_win()
        if winner != 0:
            self.game_active = False
            return {
                'type': 'ai_move',
                'row': ai_move[0],
                'col': ai_move[1],
                'time': elapsed,
                'simulations': self.mcts.total_simulations,
                'game_over': True,
                'winner': winner,
                'winner_name': 'ai' if winner == self.ai_player else 'human'
            }

        if len(self.board.get_valid_moves()) == 0:
            self.game_active = False
            return {
                'type': 'ai_move',
                'row': ai_move[0],
                'col': ai_move[1],
                'time': elapsed,
                'simulations': self.mcts.total_simulations,
                'game_over': True,
                'winner': 0,
                'winner_name': 'draw'
            }

        return {
            'type': 'ai_move',
            'row': ai_move[0],
            'col': ai_move[1],
            'time': elapsed,
            'simulations': self.mcts.total_simulations,
            'game_over': False
        }

    def _handle_ai_first(self, msg: dict) -> dict:
        """Handle AI making the first move."""
        if not self.game_active or self.board is None:
            return {'type': 'error', 'message': 'Game not initialized'}

        if self.ai_player != 1:
            return {'type': 'error', 'message': 'AI is not first player'}

        self.mcts = MCTS(self.board, prev_player=2)

        start_time = time.time()
        ai_move = self.mcts.search(simulations=self.simulations)
        elapsed = time.time() - start_time

        if ai_move is None:
            return {'type': 'error', 'message': 'AI could not find a valid move'}

        self.board.make_move(ai_move[0], ai_move[1], self.ai_player)
        print(f"[Axial AI Server] AI (first) played: ({ai_move[0]}, {ai_move[1]}) in {elapsed:.2f}s")

        self.mcts.advance_root(ai_move)

        return {
            'type': 'ai_move',
            'row': ai_move[0],
            'col': ai_move[1],
            'time': elapsed,
            'simulations': self.mcts.total_simulations,
            'game_over': False
        }

    def _handle_state(self, msg: dict) -> dict:
        """Synchronize board state from Unity."""
        board_data = msg.get('board', [])
        current_player = msg.get('current_player', 1)

        if not board_data:
            return {'type': 'error', 'message': 'No board data provided'}

        self.board = BitBoard(dimensions=(self.D, self.R, self.C), win_length=4)

        expected_size = self.D * self.R * self.C
        if len(board_data) != expected_size:
            return {'type': 'error', 'message': f'Invalid board size: {len(board_data)}, expected {expected_size}'}

        self.board.board = np.array(board_data, dtype=np.uint8)

        prev_player = 3 - current_player
        self.mcts = MCTS(self.board, prev_player=prev_player)

        print(f"[Axial AI Server] Board state synchronized, current player: {current_player}")

        return {'type': 'state_ok'}

    def _handle_reset(self, msg: dict) -> dict:
        """Reset the game."""
        ai_plays_first = msg.get('ai_plays_first', False)

        if ai_plays_first:
            self.ai_player = 1
            self.human_player = 2
        else:
            self.ai_player = 2
            self.human_player = 1

        self.current_player = 1
        self.board = BitBoard(dimensions=(self.D, self.R, self.C), win_length=4)
        self.mcts = None
        self.game_active = True

        print(f"[Axial AI Server] Game reset. AI is Player {self.ai_player}")

        return {
            'type': 'reset_ok',
            'ai_player': self.ai_player,
            'human_player': self.human_player
        }

    def _handle_check_win(self, msg: dict) -> dict:
        """Check if there's a winner."""
        if self.board is None:
            return {'type': 'error', 'message': 'Game not initialized'}

        winner = self.board.check_win()
        return {'type': 'win_result', 'winner': winner}


def warmup_jit():
    """Pre-warm Numba JIT compilation."""
    print("[Axial AI Server] Warming up Numba JIT...")

    fb = BitBoard(dimensions=(6, 6, 7), win_length=4)
    fb.check_win()
    fb.get_valid_moves()
    fb.find_threats(1)
    fb.simulate_rollout(2, seed=12345)

    mcts = MCTS(fb, prev_player=2)
    mcts.search(simulations=50)

    print("[Axial AI Server] JIT warmup complete!")


def main():
    parser = argparse.ArgumentParser(description='Axial AI Server for Unity')
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to')
    parser.add_argument('--port', type=int, default=5555, help='Port to listen on')
    parser.add_argument('--warmup', action='store_true', help='Pre-warm Numba JIT')
    args = parser.parse_args()

    if args.warmup:
        warmup_jit()

    server = AxialAIServer(host=args.host, port=args.port)
    server.start()


if __name__ == '__main__':
    main()
