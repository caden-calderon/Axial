using UnityEngine;
using System.Collections;
using System;

public class GridManager_old : MonoBehaviour
{
    #region Events

    public event Action<int, int, int> OnPieceLanded;
    public event Action<int> OnPlayerWins;
    public event Action OnGameDraw;

    #endregion

    #region Serialized Fields

    [Header("Game Dimensions")]
    public int columnsX = 7;
    public int rowsY = 6;
    public int depthZ = 6;

    [Header("References")]
    public GameObject piecePrefab;
    public float cellSpacing = 1.5f;
    public float dropSpeed = 12f;

    [Header("Win Condition")]
    public int winLength = 4;

    [Header("Debug")]
    [SerializeField] private bool enableDebugLogs = true;

    #endregion

    #region Private Fields

    private int[,,] boardGrid;
    private bool isGameActive = true;
    private int totalPiecesPlaced = 0;

    #endregion

    #region Public Properties

    /// <summary>
    /// Get the world position for the CENTER of a grid cell
    /// </summary>
    public Vector3 GetCellCenterWorld(int x, int y, int z)
    {
        float halfSpace = cellSpacing / 2f;
        Vector3 localPos = new Vector3(
            (x * cellSpacing) + halfSpace,
            (y * cellSpacing) + halfSpace,  // CENTER of cell, not bottom!
            (z * cellSpacing) + halfSpace
        );
        return transform.TransformPoint(localPos);
    }

    /// <summary>
    /// Get the local position for the CENTER of a grid cell
    /// </summary>
    public Vector3 GetCellCenterLocal(int x, int y, int z)
    {
        float halfSpace = cellSpacing / 2f;
        return new Vector3(
            (x * cellSpacing) + halfSpace,
            (y * cellSpacing) + halfSpace,
            (z * cellSpacing) + halfSpace
        );
    }

    /// <summary>
    /// Get the recommended piece size to fit nicely in grid cells
    /// </summary>
    public float GetRecommendedPieceSize()
    {
        return cellSpacing * 0.85f; // 85% of cell size for nice fit with gaps
    }

    /// <summary>
    /// Get the center of the grid in world space
    /// </summary>
    public Vector3 GetGridCenterWorld()
    {
        float halfX = columnsX * cellSpacing / 2f;
        float halfY = rowsY * cellSpacing / 2f;
        float halfZ = depthZ * cellSpacing / 2f;
        
        Vector3 localCenter = new Vector3(halfX, halfY, halfZ);
        return transform.TransformPoint(localCenter);
    }

    #endregion

    #region Unity Lifecycle

    void Start()
    {
        boardGrid = new int[columnsX, rowsY, depthZ];
        
        if (enableDebugLogs)
        {
            Debug.Log($"GridManager initialized: {columnsX}x{rowsY}x{depthZ}, spacing={cellSpacing}");
            Debug.Log($"Recommended piece size: {GetRecommendedPieceSize()}");
        }
    }

    void OnDrawGizmos()
    {
        // Draw cell centers for debugging
        if (!Application.isPlaying) return;
        
        Gizmos.color = Color.yellow;
        for (int x = 0; x < columnsX; x++)
        {
            for (int z = 0; z < depthZ; z++)
            {
                Vector3 center = GetCellCenterWorld(x, 0, z);
                Gizmos.DrawWireSphere(center, 0.1f);
            }
        }
        
        // Draw grid center
        Gizmos.color = Color.magenta;
        Gizmos.DrawWireSphere(GetGridCenterWorld(), 0.3f);
    }

    #endregion

    #region Public Methods - Game State

    public bool IsColumnFull(int x, int z)
    {
        if (x < 0 || x >= columnsX || z < 0 || z >= depthZ)
            return true;

        return boardGrid[x, rowsY - 1, z] != 0;
    }

    public int GetLowestEmptyY(int x, int z)
    {
        if (x < 0 || x >= columnsX || z < 0 || z >= depthZ)
            return -1;

        for (int y = 0; y < rowsY; y++)
        {
            if (boardGrid[x, y, z] == 0)
                return y;
        }
        return -1;
    }

    public int GetGridValue(int x, int y, int z)
    {
        if (x < 0 || x >= columnsX || y < 0 || y >= rowsY || z < 0 || z >= depthZ)
            return -1;
        return boardGrid[x, y, z];
    }

    public void ResetBoard()
    {
        boardGrid = new int[columnsX, rowsY, depthZ];
        isGameActive = true;
        totalPiecesPlaced = 0;

        if (enableDebugLogs)
            Debug.Log("GridManager: Board reset");
    }

    #endregion

    #region Public Methods - Piece Placement

    public void AcceptPieceDrop(GameObject piece, int x, int z, int playerNumber)
    {
        if (!isGameActive)
        {
            if (enableDebugLogs)
                Debug.Log("GridManager: Game not active");
            return;
        }

        if (x < 0 || x >= columnsX || z < 0 || z >= depthZ)
        {
            Debug.LogError($"GridManager: Invalid column [{x}, {z}]");
            return;
        }

        int targetY = GetLowestEmptyY(x, z);
        
        if (targetY == -1)
        {
            Debug.LogWarning($"GridManager: Column [{x}, {z}] is full!");
            return;
        }

        // Mark grid BEFORE animation
        boardGrid[x, targetY, z] = playerNumber;
        totalPiecesPlaced++;

        if (enableDebugLogs)
        {
            Debug.Log($"GridManager: Player {playerNumber} -> [{x}, {targetY}, {z}]. Total pieces: {totalPiecesPlaced}");
            
            // Debug: print column state
            string colState = $"Column [{x},{z}] state: ";
            for (int y = 0; y < rowsY; y++)
            {
                colState += boardGrid[x, y, z] + " ";
            }
            Debug.Log(colState);
        }

        StartCoroutine(DropPieceRoutine(piece, x, targetY, z, playerNumber));
    }

    public void AttemptDrop(int x, int z, int playerNumber = 1)
    {
        if (!isGameActive) return;

        int targetY = GetLowestEmptyY(x, z);

        if (targetY == -1)
        {
            Debug.Log($"Column [{x},{z}] is full!");
            return;
        }

        boardGrid[x, targetY, z] = playerNumber;
        totalPiecesPlaced++;

        StartCoroutine(SpawnAndDropRoutine(x, targetY, z, playerNumber));
    }

    #endregion

    #region Private Methods - Animation

    private IEnumerator DropPieceRoutine(GameObject piece, int x, int targetY, int z, int playerNumber)
    {
        // Calculate CELL CENTER positions
        Vector3 localEnd = GetCellCenterLocal(x, targetY, z);
        Vector3 worldEnd = transform.TransformPoint(localEnd);

        // Parent to board - this makes the piece inherit the grid's transform
        piece.transform.SetParent(this.transform);
        
        // IMPORTANT: Align piece rotation with grid rotation
        // Setting localRotation to identity makes the piece align with the grid
        piece.transform.localRotation = Quaternion.identity;

        // Snap X/Z to target column immediately, keep current Y
        Vector3 worldStart = new Vector3(worldEnd.x, piece.transform.position.y, worldEnd.z);
        piece.transform.position = worldStart;

        // Ensure physics is off
        Rigidbody rb = piece.GetComponent<Rigidbody>();
        if (rb != null)
        {
            rb.isKinematic = true;
            rb.linearVelocity = Vector3.zero;
            rb.angularVelocity = Vector3.zero;
        }

        // Size the piece to fit the grid
        float pieceSize = GetRecommendedPieceSize();
        piece.transform.localScale = Vector3.one * pieceSize;

        // Animate fall
        float stopDistance = 0.01f;
        while (Vector3.Distance(piece.transform.position, worldEnd) > stopDistance)
        {
            piece.transform.position = Vector3.MoveTowards(
                piece.transform.position,
                worldEnd,
                dropSpeed * Time.deltaTime
            );
            yield return null;
        }

        // Snap to exact final position
        piece.transform.position = worldEnd;
        piece.transform.localPosition = localEnd;
        
        // Ensure rotation is still aligned after animation
        piece.transform.localRotation = Quaternion.identity;

        if (enableDebugLogs)
        {
            Debug.Log($"GridManager: Piece landed at cell [{x}, {targetY}, {z}], world pos: {worldEnd}");
        }

        OnPieceLanded?.Invoke(x, z, playerNumber);
        CheckGameEnd(x, targetY, z, playerNumber);
    }

    private IEnumerator SpawnAndDropRoutine(int x, int targetY, int z, int playerNumber)
    {
        // Spawn above board
        Vector3 spawnLocal = GetCellCenterLocal(x, rowsY + 1, z);
        Vector3 spawnWorld = transform.TransformPoint(spawnLocal);

        Vector3 endLocal = GetCellCenterLocal(x, targetY, z);
        Vector3 endWorld = transform.TransformPoint(endLocal);

        // Spawn with grid's rotation
        GameObject newPiece = Instantiate(piecePrefab, spawnWorld, transform.rotation);
        newPiece.transform.parent = this.transform;
        newPiece.transform.localScale = Vector3.one * GetRecommendedPieceSize();
        newPiece.transform.localRotation = Quaternion.identity; // Align with grid

        float stopDistance = 0.01f;
        while (Vector3.Distance(newPiece.transform.position, endWorld) > stopDistance)
        {
            newPiece.transform.position = Vector3.MoveTowards(
                newPiece.transform.position,
                endWorld,
                dropSpeed * Time.deltaTime
            );
            yield return null;
        }

        newPiece.transform.position = endWorld;
        newPiece.transform.localPosition = endLocal;
        newPiece.transform.localRotation = Quaternion.identity;

        OnPieceLanded?.Invoke(x, z, playerNumber);
        CheckGameEnd(x, targetY, z, playerNumber);
    }

    private void CheckGameEnd(int x, int y, int z, int playerNumber)
    {
        if (CheckWin(x, y, z, playerNumber))
        {
            isGameActive = false;
            OnPlayerWins?.Invoke(playerNumber);
            if (enableDebugLogs)
                Debug.Log($"GridManager: Player {playerNumber} WINS!");
        }
        else if (totalPiecesPlaced >= columnsX * rowsY * depthZ)
        {
            isGameActive = false;
            OnGameDraw?.Invoke();
            if (enableDebugLogs)
                Debug.Log("GridManager: DRAW!");
        }
    }

    #endregion

    #region Win Detection

    private bool CheckWin(int x, int y, int z, int player)
    {
        int[][] directions = new int[][]
        {
            new int[] {1, 0, 0},
            new int[] {0, 1, 0},
            new int[] {0, 0, 1},
            new int[] {1, 1, 0},
            new int[] {1, -1, 0},
            new int[] {1, 0, 1},
            new int[] {1, 0, -1},
            new int[] {0, 1, 1},
            new int[] {0, 1, -1},
            new int[] {1, 1, 1},
            new int[] {1, 1, -1},
            new int[] {1, -1, 1},
            new int[] {1, -1, -1}
        };

        foreach (int[] dir in directions)
        {
            int count = 1;
            count += CountInDirection(x, y, z, dir[0], dir[1], dir[2], player);
            count += CountInDirection(x, y, z, -dir[0], -dir[1], -dir[2], player);

            if (count >= winLength)
            {
                if (enableDebugLogs)
                    Debug.Log($"Win! Direction [{dir[0]},{dir[1]},{dir[2]}], Count: {count}");
                return true;
            }
        }

        return false;
    }

    private int CountInDirection(int startX, int startY, int startZ, int dx, int dy, int dz, int player)
    {
        int count = 0;
        int x = startX + dx;
        int y = startY + dy;
        int z = startZ + dz;

        while (x >= 0 && x < columnsX &&
               y >= 0 && y < rowsY &&
               z >= 0 && z < depthZ &&
               boardGrid[x, y, z] == player)
        {
            count++;
            x += dx;
            y += dy;
            z += dz;
        }

        return count;
    }

    #endregion
}