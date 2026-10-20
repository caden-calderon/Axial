using UnityEngine;
using UnityEngine.Events;

/// <summary>
/// Spawns game pieces for the HUMAN player only when playing against AI.
/// The AI places its own pieces via GridManager.AttemptDrop().
/// </summary>
public class PieceSpawner : MonoBehaviour
{
    #region Serialized Fields

    [Header("Piece Prefab")]
    [SerializeField] private GameObject piecePrefab;
    
    [Header("Spawn Position")]
    [SerializeField] private Transform spawnPoint;
    [SerializeField] private Vector3 spawnOffset = new Vector3(0, 3f, -2f);

    [Header("Player Colors")]
    [SerializeField] private Color player1Color = new Color(1f, 0.4f, 0.2f, 1f);  // Orange
    [SerializeField] private Color player2Color = new Color(0.2f, 0.5f, 1f, 1f);  // Blue

    [Header("AI Integration")]
    [Tooltip("Reference to the AI game controller. If set, spawner only spawns for human player.")]
    [SerializeField] private AxialGameController gameController;
    
    [Tooltip("If true and no gameController is set, plays as 2-player local game")]
    [SerializeField] private bool allowLocalMultiplayer = false;

    [Header("Game Settings")]
    [SerializeField] private bool autoSpawnOnStart = true;
    [SerializeField] private float spawnDelay = 0.5f;

    [Header("Events")]
    public UnityEvent<int> OnTurnChanged;
    public UnityEvent<int> OnPieceSpawned;

    [Header("Debug")]
    [SerializeField] private bool enableDebugLogs = true;

    #endregion

    #region Private Fields

    private GridManager _gridManager;
    private GamePiece _currentPiece;
    private int _currentPlayer = 1;
    private bool _gameActive = true;
    private int _piecesSpawned = 0;
    private float _pieceSize = 1f;
    private bool _isAIGame = false;

    #endregion

    #region Public Properties

    public int CurrentPlayer => _currentPlayer;
    public GamePiece CurrentPiece => _currentPiece;
    public bool IsGameActive => _gameActive;
    public bool IsAIGame => _isAIGame;

    #endregion

    #region Unity Lifecycle

    private void Start()
    {
        _gridManager = FindAnyObjectByType<GridManager>();
        
        if (_gridManager == null)
        {
            Debug.LogError("PieceSpawner: No GridManager found!");
            return;
        }

        // Auto-find game controller if not set
        if (gameController == null)
        {
            gameController = FindAnyObjectByType<AxialGameController>();
        }

        _isAIGame = gameController != null;

        // Get piece size from grid manager
        _pieceSize = _gridManager.GetRecommendedPieceSize();

        // Subscribe to events
        _gridManager.OnPieceLanded += HandlePieceLanded;
        _gridManager.OnPlayerWins += HandlePlayerWins;
        _gridManager.OnGameDraw += HandleGameDraw;

        // Subscribe to AI controller events if present
        if (gameController != null)
        {
            gameController.OnGameStarted.AddListener(HandleAIGameStarted);
            gameController.OnHumanTurnStart.AddListener(HandleHumanTurnStart);
            gameController.OnAIThinkingStart.AddListener(HandleAITurnStart);
            gameController.OnGameOver.AddListener(HandleAIGameOver);
        }

        // Setup spawn point
        if (spawnPoint == null)
        {
            GameObject spawnObj = new GameObject("PieceSpawnPoint");
            spawnObj.transform.position = _gridManager.transform.position + spawnOffset;
            spawnPoint = spawnObj.transform;
        }

        // Initialize events
        if (OnTurnChanged == null) OnTurnChanged = new UnityEvent<int>();
        if (OnPieceSpawned == null) OnPieceSpawned = new UnityEvent<int>();

        if (enableDebugLogs)
        {
            Debug.Log($"PieceSpawner initialized. AI Game: {_isAIGame}, Spawn: {spawnPoint.position}");
        }

        // For non-AI games, spawn immediately
        // For AI games, wait for OnHumanTurnStart event
        if (autoSpawnOnStart && !_isAIGame)
        {
            SpawnPieceForCurrentPlayer();
        }
    }

    private void OnDestroy()
    {
        if (_gridManager != null)
        {
            _gridManager.OnPieceLanded -= HandlePieceLanded;
            _gridManager.OnPlayerWins -= HandlePlayerWins;
            _gridManager.OnGameDraw -= HandleGameDraw;
        }

        if (gameController != null)
        {
            gameController.OnGameStarted.RemoveListener(HandleAIGameStarted);
            gameController.OnHumanTurnStart.RemoveListener(HandleHumanTurnStart);
            gameController.OnAIThinkingStart.RemoveListener(HandleAITurnStart);
            gameController.OnGameOver.RemoveListener(HandleAIGameOver);
        }
    }

    #endregion

    #region Public Methods

    /// <summary>
    /// Spawn a piece for the current player (used in local multiplayer mode).
    /// In AI mode, use SpawnPieceForHuman() instead.
    /// </summary>
    public void SpawnPieceForCurrentPlayer()
    {
        if (!_gameActive)
        {
            if (enableDebugLogs) Debug.Log("PieceSpawner: Game not active");
            return;
        }

        if (_currentPiece != null && !_currentPiece.HasBeenDropped)
        {
            if (enableDebugLogs) Debug.Log("PieceSpawner: Piece already active");
            return;
        }

        SpawnPiece(_currentPlayer);
    }

    /// <summary>
    /// Spawn a piece specifically for the human player (AI mode).
    /// </summary>
    public void SpawnPieceForHuman()
    {
        if (!_gameActive)
        {
            if (enableDebugLogs) Debug.Log("PieceSpawner: Game not active");
            return;
        }

        if (_currentPiece != null && !_currentPiece.HasBeenDropped)
        {
            if (enableDebugLogs) Debug.Log("PieceSpawner: Piece already active");
            return;
        }

        int humanPlayer = gameController != null ? gameController.HumanPlayer : 1;
        _currentPlayer = humanPlayer;
        
        SpawnPiece(humanPlayer);
    }

    /// <summary>
    /// Switch to the next player (local multiplayer only).
    /// In AI mode, turn switching is handled by the controller.
    /// </summary>
    public void SwitchPlayer()
    {
        _currentPlayer = (_currentPlayer == 1) ? 2 : 1;
        OnTurnChanged?.Invoke(_currentPlayer);

        if (enableDebugLogs)
            Debug.Log($"PieceSpawner: Now Player {_currentPlayer}'s turn");
    }

    public void EndGame()
    {
        _gameActive = false;
        if (enableDebugLogs)
            Debug.Log("PieceSpawner: Game ended");
    }

    public void ResetGame()
    {
        _gameActive = true;
        _currentPlayer = 1;
        _piecesSpawned = 0;

        // Destroy any existing piece
        if (_currentPiece != null)
        {
            Destroy(_currentPiece.gameObject);
            _currentPiece = null;
        }

        // Cancel any pending spawns
        CancelInvoke(nameof(SpawnPieceForCurrentPlayer));
        CancelInvoke(nameof(SpawnPieceForHuman));

        if (enableDebugLogs)
            Debug.Log("PieceSpawner: Reset (waiting for turn signal)");
    }

    /// <summary>
    /// Clear all spawned pieces from the scene.
    /// </summary>
    public void ClearAllPieces()
    {
        // Find and destroy all GamePiece objects
        GamePiece[] pieces = FindObjectsByType<GamePiece>(FindObjectsSortMode.None);
        foreach (var piece in pieces)
        {
            Destroy(piece.gameObject);
        }

        _currentPiece = null;
        _piecesSpawned = 0;

        if (enableDebugLogs)
            Debug.Log($"PieceSpawner: Cleared {pieces.Length} pieces");
    }

    #endregion

    #region Private Methods

    private void SpawnPiece(int playerNumber)
    {
        if (piecePrefab == null)
        {
            Debug.LogError("PieceSpawner: No piece prefab assigned!");
            return;
        }

        Vector3 spawnPos = spawnPoint.position;
        GameObject pieceObj = Instantiate(piecePrefab, spawnPos, Quaternion.identity);
        pieceObj.name = $"Piece_P{playerNumber}_{_piecesSpawned}";
        
        // Size to fit grid
        pieceObj.transform.localScale = Vector3.one * _pieceSize;

        // Setup GamePiece component
        GamePiece gamePiece = pieceObj.GetComponent<GamePiece>();
        if (gamePiece == null)
        {
            gamePiece = pieceObj.AddComponent<GamePiece>();
        }

        gamePiece.playerNumber = playerNumber;
        gamePiece.SetSpawner(spawnPoint, spawnPos);
        gamePiece.SetPlayerColor(playerNumber == 1 ? player1Color : player2Color);

        // Ensure GrabbableObject exists
        if (pieceObj.GetComponent<GrabbableObject>() == null)
        {
            pieceObj.AddComponent<GrabbableObject>();
        }

        // Set layer
        int grabbableLayer = LayerMask.NameToLayer("Grabbable");
        if (grabbableLayer >= 0)
        {
            pieceObj.layer = grabbableLayer;
        }

        _currentPiece = gamePiece;
        _piecesSpawned++;

        OnPieceSpawned?.Invoke(playerNumber);

        if (enableDebugLogs)
        {
            Debug.Log($"PieceSpawner: Spawned piece for Player {playerNumber} (Human: {gameController?.HumanPlayer ?? -1})");
        }
    }

    #endregion

    #region Event Handlers - GridManager

    private void HandlePieceLanded(int x, int z, int playerNumber)
    {
        if (enableDebugLogs)
            Debug.Log($"PieceSpawner: Piece landed at [{x}, {z}] by Player {playerNumber}");

        // In AI mode, we DON'T switch players or auto-spawn here
        // The AxialGameController handles turn management
        // We just wait for OnHumanTurnStart event
        
        if (_isAIGame)
        {
            // Do nothing - wait for controller events
            return;
        }

        // Local multiplayer mode - handle turns ourselves
        if (allowLocalMultiplayer || !_isAIGame)
        {
            SwitchPlayer();

            if (_gameActive)
            {
                Invoke(nameof(SpawnPieceForCurrentPlayer), spawnDelay);
            }
        }
    }

    private void HandlePlayerWins(int playerNumber)
    {
        _gameActive = false;
        if (enableDebugLogs)
            Debug.Log($"PieceSpawner: Player {playerNumber} wins!");
    }

    private void HandleGameDraw()
    {
        _gameActive = false;
        if (enableDebugLogs)
            Debug.Log("PieceSpawner: Game is a draw!");
    }

    #endregion

    #region Event Handlers - AI Controller

    private void HandleAIGameStarted()
    {
        _gameActive = true;
        _piecesSpawned = 0;

        // Destroy any existing piece
        if (_currentPiece != null)
        {
            Destroy(_currentPiece.gameObject);
            _currentPiece = null;
        }

        if (enableDebugLogs)
            Debug.Log("PieceSpawner: AI game started, waiting for turn...");
    }

    private void HandleHumanTurnStart()
    {
        if (!_gameActive) return;

        if (enableDebugLogs)
            Debug.Log("PieceSpawner: Human turn - spawning piece");

        // Small delay to let AI piece finish dropping animation
        Invoke(nameof(SpawnPieceForHuman), spawnDelay);
    }

    private void HandleAITurnStart()
    {
        // AI is thinking - we don't need to do anything
        // The AI will place its piece via GridManager.AttemptDrop()
        if (enableDebugLogs)
            Debug.Log("PieceSpawner: AI turn - waiting...");
    }

    private void HandleAIGameOver(int winner, string message)
    {
        _gameActive = false;
        if (enableDebugLogs)
            Debug.Log($"PieceSpawner: AI game over - {message}");
    }

    #endregion

    #region Editor

    private void OnDrawGizmos()
    {
        Vector3 pos = spawnPoint != null ? spawnPoint.position : transform.position + spawnOffset;
        
        Gizmos.color = _currentPlayer == 1 ? player1Color : player2Color;
        Gizmos.DrawWireSphere(pos, 0.5f);
        Gizmos.DrawLine(pos, pos + Vector3.down * 2f);
    }

    #endregion
}