import math
import random
from Axial_BitBoard import BitBoard

class MCTSNode:
    def __init__(self, state: BitBoard, parent=None, action=None, prev_player = 2):
        """
        :param state: The BitBoard state at this node.
        :param parent: The parent MCTSNode.
        :param action: The move (r, c) that led to this state.
        """
        self.state = state
        self.parent = parent
        self.action = action
        self.prev_player = prev_player
        
        self.children = {}  # Map: (r, c) -> MCTSNode
        self.visits = 0
        self.value = 0.0  # Total value (wins/losses)
        
        # Possible moves from this state (untried)
        self.untried_moves = state.get_valid_moves()



    def is_fully_expanded(self) -> bool:
        """Returns True if all valid moves have been expanded."""
        return len(self.untried_moves) == 0

    def best_child(self, c_param: float = 1.414) -> 'MCTSNode':
        """
        Selects the best child using the UCT formula.
        TODO: Implement UCT logic here or in the loop.
        """
        # Placeholder
        if self.visits == 0:
            return self

        UCT = lambda node: node.value / node.visits + c_param * math.sqrt(math.log(node.parent.visits) / node.visits)
        return max(self.children.values(), key=UCT)

class MCTS:
    def __init__(self, root_state: BitBoard):
        self.root = MCTSNode(root_state)

    def search(self, simulations=1000):
        """
        Runs MCTS simulations to find the best move.
        Returns the best action (r, c).
        """
        # TODO: Loop 'simulations' times:
        # 1. node = self._select(self.root)
        # 2. result = self._simulate(node.state)
        # 3. self._backpropagate(node, result)
        
        # TODO: Return the action of the child with the most visits
        for _ in range(simulations):
            node = self._select(self.root)
            result = self._simulate(node.state, node.prev_player)
            self._backpropagate(node, result)

        return self.root.best_child(c_param=0).action

    def _select(self, node):
        """
        Phase 1: Selection & Phase 2: Expansion
        Traverse down the tree using UCT until a node is found that is not fully expanded.
        Then expand it.
        """
        # TODO: Implement Selection and Expansion logic
        while node.is_fully_expanded() and node.state.check_win() == 0:
            node = node.best_child()
     
        if node.state.check_win() != 0:
            return node
        return self._expand(node)

    def _expand(self, node):
        """
        Phase 2: Expansion
        Adds a new child node from untried_moves.
        """
        # TODO:
        # 1. Pop a move from node.untried_moves
        # 2. Create a new state (copy) and apply the move
        # 3. Create a new MCTSNode
        # 4. Add it to node.children
        action = node.untried_moves.pop()
        new_state = node.state.copy()
        curr_player = 3 - node.prev_player
        new_state.make_move(action[0], action[1], curr_player)
        child = MCTSNode(state=new_state, parent=node, action=action, prev_player=curr_player)
        node.children[action] = child
        return child       

    def _simulate(self, state, prev_player):
        """
        Phase 3: Simulation (Rollout)
        Play random moves until the game ends.
        Returns: 1 if Player 1 wins, -1 if Player 2 wins, 0 for Draw.
        """
        # TODO: Implement Random Rollout
        curr_state = state.copy()
        curr_player = prev_player
        while curr_state.check_win() == 0:
            moves = curr_state.get_valid_moves()
            if not moves: break
            action = random.choice(moves)
            curr_player = 3 - curr_player
            curr_state.make_move(action[0], action[1], curr_player)
        return curr_state.check_win()
            
    def _backpropagate(self, node, result):
        """
        Phase 4: Backpropagation
        Update visits and value up the tree.
        """
        # TODO: Walk up node.parent until root, updating stats
        while node is not None:
            node.visits += 1

            if result == 0:
                node.value += 0.5
            elif result == 1 and node.prev_player == 1:
                node.value += 1
            elif result == 2 and node.prev_player == 2:
                node.value += 1
            
            node = node.parent

if __name__ == "__main__":
    print("--- Testing MCTS Structure ---")
    bb = BitBoard()
    mcts = MCTS(bb)
    print("MCTS Initialized. Ready for implementation.")
    
