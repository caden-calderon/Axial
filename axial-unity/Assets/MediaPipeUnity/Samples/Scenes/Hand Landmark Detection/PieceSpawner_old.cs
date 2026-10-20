using UnityEngine;
using UnityEngine.Events;

/// <summary>
/// Spawns game pieces for players and manages turn order.
/// Place this in your scene and assign the piece prefab.
/// </summary>
public class PieceSpawner_old : MonoBehaviour
{
    #region Serialized Fields

    [Header("Piece Prefab")]
    [SerializeField] private GameObject piecePrefab;           // Must have GrabbableObject + GamePiece
    [SerializeField] private float pieceScale = 0.8f;          // Scale of spawned pieces

    [Header("Spawn Position")]
    [SerializeField] private Transform spawnPoint;             // Where pieces appear
    [SerializeField] private Vector3 spawnOffset = new Vector3(0, 2f, -3f);  // Offset from board if no spawn point

    [Header("Player Colors")]
    [SerializeField] private Color player1Color = new Color(1f, 0.5f, 0.3f, 1f);  // Orange/Coral
    [SerializeField] private Color player2Color = new Color(0.3f, 0.5f, 1f, 1f);  // Blue

    [Header("Game Settings")]
    [SerializeField] private bool autoSpawnOnStart = true;
    [SerializeField] private float spawnDelay = 0.5f;          // Delay before spawning next piece

    [Header("Events")]
    public UnityEvent<int> OnTurnChanged;                      // Fires when turn changes (passes player number)
    public UnityEvent<int> OnPieceSpawned;                     // Fires when piece spawns (passes player number)

    [Header("Debug")]
    [SerializeField] private bool enableDebugLogs = true;

    #endregion

    #region Private Fields

    private GridManager _gridManager;
    private GamePiece _currentPiece;
    private int _currentPlayer = 1;
    private bool _gameActive = true;
    private int _piecesSpawned = 0;

    #endregion

    #region Public Properties

    public int CurrentPlayer => _currentPlayer;
    public GamePiece CurrentPiece => _currentPiece;
    public bool IsGameActive => _gameActive;

    #endregion

    #region Unity Lifecycle

    private void Start()
    {
        // Find GridManager
        _gridManager = FindAnyObjectByType<GridManager>();
        
        if (_gridManager == null)
        {
            Debug.LogError("PieceSpawner: No GridManager found in scene!");
            return;
        }

        // Subscribe to GridManager events
        _gridManager.OnPieceLanded += HandlePieceLanded;

        // Calculate spawn point if not set
        if (spawnPoint == null)
        {
            // Create spawn point relative to board
            GameObject spawnObj = new GameObject("PieceSpawnPoint");
            spawnObj.transform.position = _gridManager.transform.position + spawnOffset;
            spawnPoint = spawnObj.transform;
        }

        // Initialize events
        if (OnTurnChanged == null) OnTurnChanged = new UnityEvent<int>();
        if (OnPieceSpawned == null) OnPieceSpawned = new UnityEvent<int>();

        // Spawn first piece
        if (autoSpawnOnStart)
        {
            SpawnPieceForCurrentPlayer();
        }

        if (enableDebugLogs)
        {
            Debug.Log($"PieceSpawner initialized. Spawn point: {spawnPoint.position}");
        }
    }

    private void OnDestroy()
    {
        // Unsubscribe from events
        if (_gridManager != null)
        {
            _gridManager.OnPieceLanded -= HandlePieceLanded;
        }
    }

    private void Update()
    {
        // Check if current piece was dropped (for manual spawning)
        if (_currentPiece != null && _currentPiece.HasBeenDropped)
        {
            _currentPiece = null;
        }
    }

    #endregion

    #region Public Methods

    /// <summary>
    /// Manually spawn a piece for the current player
    /// </summary>
    public void SpawnPieceForCurrentPlayer()
    {
        if (!_gameActive)
        {
            if (enableDebugLogs)
            {
                Debug.Log("PieceSpawner: Game is not active, cannot spawn piece");
            }
            return;
        }

        if (_currentPiece != null && !_currentPiece.HasBeenDropped)
        {
            if (enableDebugLogs)
            {
                Debug.Log("PieceSpawner: Current piece still active, cannot spawn new piece");
            }
            return;
        }

        SpawnPiece(_currentPlayer);
    }

    /// <summary>
    /// Switch to the other player
    /// </summary>
    public void SwitchPlayer()
    {
        _currentPlayer = (_currentPlayer == 1) ? 2 : 1;
        OnTurnChanged?.Invoke(_currentPlayer);

        if (enableDebugLogs)
        {
            Debug.Log($"PieceSpawner: Switched to Player {_currentPlayer}");
        }
    }

    /// <summary>
    /// End the game (call when someone wins or draws)
    /// </summary>
    public void EndGame()
    {
        _gameActive = false;

        if (enableDebugLogs)
        {
            Debug.Log("PieceSpawner: Game ended");
        }
    }

    /// <summary>
    /// Reset for a new game
    /// </summary>
    public void ResetGame()
    {
        _gameActive = true;
        _currentPlayer = 1;
        _piecesSpawned = 0;

        if (_currentPiece != null)
        {
            Destroy(_currentPiece.gameObject);
            _currentPiece = null;
        }

        SpawnPieceForCurrentPlayer();

        if (enableDebugLogs)
        {
            Debug.Log("PieceSpawner: Game reset");
        }
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

        // Create the piece
        Vector3 spawnPos = spawnPoint != null ? spawnPoint.position : transform.position;
        GameObject pieceObj = Instantiate(piecePrefab, spawnPos, Quaternion.identity);
        pieceObj.name = $"Piece_P{playerNumber}_{_piecesSpawned}";
        pieceObj.transform.localScale = Vector3.one * pieceScale;

        // Get or add GamePiece component
        GamePiece gamePiece = pieceObj.GetComponent<GamePiece>();
        if (gamePiece == null)
        {
            gamePiece = pieceObj.AddComponent<GamePiece>();
        }

        // Configure the piece
        gamePiece.playerNumber = playerNumber;
        gamePiece.SetSpawner(spawnPoint, spawnPos);
        gamePiece.SetPlayerColor(playerNumber == 1 ? player1Color : player2Color);

        // Ensure it has GrabbableObject
        if (pieceObj.GetComponent<GrabbableObject>() == null)
        {
            pieceObj.AddComponent<GrabbableObject>();
        }

        // Set layer to Grabbable (create layer if needed, or use Default)
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
            Debug.Log($"PieceSpawner: Spawned piece for Player {playerNumber} at {spawnPos}");
        }
    }

    private void HandlePieceLanded(int x, int z, int playerNumber)
    {
        if (enableDebugLogs)
        {
            Debug.Log($"PieceSpawner: Piece landed at [{x}, {z}] for Player {playerNumber}");
        }

        // Switch players
        SwitchPlayer();

        // Spawn next piece after delay
        if (_gameActive)
        {
            Invoke(nameof(SpawnPieceForCurrentPlayer), spawnDelay);
        }
    }

    #endregion

    #region Editor Helpers

    private void OnDrawGizmos()
    {
        // Draw spawn point
        Vector3 spawnPos = spawnPoint != null ? spawnPoint.position : transform.position + spawnOffset;
        
        Gizmos.color = _currentPlayer == 1 ? player1Color : player2Color;
        Gizmos.DrawWireSphere(spawnPos, 0.5f);
        
        Gizmos.color = Color.white;
        Gizmos.DrawLine(spawnPos, spawnPos + Vector3.down * 2f);
    }

    #endregion
}
