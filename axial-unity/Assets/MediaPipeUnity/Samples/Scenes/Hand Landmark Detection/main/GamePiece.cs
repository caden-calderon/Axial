using UnityEngine;
using System.Collections;

/// <summary>
/// Represents a game piece that can be grabbed, snapped to grid columns, and dropped.
/// Uses discrete grid snapping with hysteresis for precise alignment.
/// </summary>
[RequireComponent(typeof(GrabbableObject))]
[RequireComponent(typeof(Collider))]
public class GamePiece : MonoBehaviour
{
    #region Serialized Fields

    [Header("Grid Snapping")]
    [Tooltip("Snap to discrete grid positions (recommended) vs smooth interpolation")]
    [SerializeField] private bool useDiscreteSnapping = true;
    [Tooltip("Height offset above board when hovering")]
    [SerializeField] private float hoverHeightOffset = 2.0f;
    
    [Header("Snapping Hysteresis")]
    [Tooltip("How far into adjacent cell before switching (0-0.5). Higher = stickier.")]
    [SerializeField] [Range(0f, 0.5f)] private float snapHysteresis = 0.3f;
    [Tooltip("Align piece rotation with grid when hovering")]
    [SerializeField] private bool alignRotationWithGrid = true;

    [Header("Visual Feedback")]
    [SerializeField] private Color validDropColor = new Color(0.3f, 1f, 0.3f, 1f);
    [SerializeField] private Color invalidDropColor = new Color(1f, 0.3f, 0.3f, 1f);
    [SerializeField] private Color normalColor = new Color(1f, 0.6f, 0.2f, 1f);
    [SerializeField] private bool showDropPreview = true;

    [Header("Player Settings")]
    public int playerNumber = 1;

    [Header("Debug")]
    [SerializeField] private bool enableDebugLogs = true;
    [SerializeField] private bool enableDebugGizmos = true;

    #endregion

    #region Private Fields

    private GrabbableObject _grabbable;
    private GridManager _gridManager;
    private Renderer _renderer;
    private Color _originalColor;

    // Grid state
    private int _currentGridX = -1;
    private int _currentGridZ = -1;
    private int _lockedGridX = -1;  // For hysteresis
    private int _lockedGridZ = -1;  // For hysteresis
    private bool _isOverGrid = false;
    private bool _hasBeenDropped = false;

    // Cached
    private Transform _boardTransform;
    private float _cellSpacing;
    private int _boardColumns;
    private int _boardRows;
    private int _boardDepth;

    // Spawn
    private Vector3 _spawnPoint;

    // Preview
    private GameObject _previewGhost;

    #endregion

    #region Public Properties

    public bool IsOverValidColumn => _isOverGrid && !IsColumnFull();
    public bool HasBeenDropped => _hasBeenDropped;
    public int CurrentGridX => _currentGridX;
    public int CurrentGridZ => _currentGridZ;

    #endregion

    #region Unity Lifecycle

    private void Awake()
    {
        _grabbable = GetComponent<GrabbableObject>();
        _renderer = GetComponent<Renderer>();
        
        if (_renderer != null && _renderer.material != null)
        {
            _originalColor = normalColor;
            _renderer.material.color = _originalColor;
        }
    }

    private void Start()
    {
        _gridManager = FindAnyObjectByType<GridManager>();
        
        if (_gridManager == null)
        {
            Debug.LogError("GamePiece: No GridManager found!");
            return;
        }

        // Cache board info
        _boardTransform = _gridManager.transform;
        _cellSpacing = _gridManager.cellSpacing;
        _boardColumns = _gridManager.columnsX;
        _boardRows = _gridManager.rowsY;
        _boardDepth = _gridManager.depthZ;

        _spawnPoint = transform.position;

        // Size piece to fit grid
        float pieceSize = _gridManager.GetRecommendedPieceSize();
        transform.localScale = Vector3.one * pieceSize;

        if (showDropPreview)
        {
            CreatePreviewGhost();
        }

        if (enableDebugLogs)
        {
            Debug.Log($"GamePiece initialized. Cell spacing: {_cellSpacing}, Piece size: {pieceSize}, Hysteresis: {snapHysteresis}");
        }
    }

    private void Update()
    {
        if (_hasBeenDropped) return;

        if (_grabbable != null && _grabbable.IsGrabbed)
        {
            UpdateGridPosition();
            UpdateVisuals();
            UpdatePreview();
            
            // Align rotation with grid when grabbed
            if (alignRotationWithGrid && _boardTransform != null)
            {
                transform.rotation = _boardTransform.rotation;
            }
        }
        else
        {
            HidePreview();
            ResetColor();
            // Reset locked position when not grabbed
            _lockedGridX = -1;
            _lockedGridZ = -1;
        }
    }

    private void OnDrawGizmos()
    {
        if (!enableDebugGizmos || _gridManager == null) return;

        // Current position indicator
        Gizmos.color = _isOverGrid ? Color.green : Color.red;
        Gizmos.DrawWireCube(transform.position, Vector3.one * 0.3f);

        // Grid cell being hovered
        if (_isOverGrid && _currentGridX >= 0)
        {
            Vector3 cellCenter = _gridManager.GetCellCenterWorld(_currentGridX, _boardRows, _currentGridZ);
            Gizmos.color = Color.cyan;
            Gizmos.DrawWireCube(cellCenter, Vector3.one * _cellSpacing * 0.9f);
            
            // Draw hysteresis zone
            float hysteresisSize = _cellSpacing * (1f - snapHysteresis * 2f);
            Gizmos.color = new Color(1f, 1f, 0f, 0.3f);
            Gizmos.DrawWireCube(cellCenter, Vector3.one * hysteresisSize);
        }
    }

    #endregion

    #region Public Methods

    public bool OnPieceReleased()
    {
        if (_hasBeenDropped) return false;

        // Final position check
        UpdateGridPosition();

        if (enableDebugLogs)
        {
            Debug.Log($"GamePiece Released: Grid[{_currentGridX}, {_currentGridZ}], Valid={IsOverValidColumn}");
        }

        HidePreview();

        if (IsOverValidColumn)
        {
            DropIntoGrid();
            return true;
        }
        else
        {
            ReturnToSpawn();
            return false;
        }
    }

    public void SetSpawner(Transform spawner, Vector3 spawnPoint)
    {
        _spawnPoint = spawnPoint;
    }

    public void SetPlayerColor(Color color)
    {
        _originalColor = color;
        normalColor = color;
        if (_renderer != null && _renderer.material != null)
        {
            _renderer.material.color = color;
        }
        
        // Update preview ghost color too
        if (_previewGhost != null)
        {
            Renderer ghostRenderer = _previewGhost.GetComponent<Renderer>();
            if (ghostRenderer != null)
            {
                Color ghostColor = color;
                ghostColor.a = 0.4f;
                ghostRenderer.material.color = ghostColor;
            }
        }
    }

    #endregion

    #region Grid Detection & Snapping

    private void UpdateGridPosition()
    {
        if (_boardTransform == null) return;

        // Convert piece world position to board local space
        Vector3 localPos = _boardTransform.InverseTransformPoint(transform.position);

        // Calculate which grid cell we're over (raw, before hysteresis)
        int rawGridX = Mathf.FloorToInt(localPos.x / _cellSpacing);
        int rawGridZ = Mathf.FloorToInt(localPos.z / _cellSpacing);

        // Clamp to valid range
        rawGridX = Mathf.Clamp(rawGridX, 0, _boardColumns - 1);
        rawGridZ = Mathf.Clamp(rawGridZ, 0, _boardDepth - 1);

        // Check if over the board area
        bool overBoardX = localPos.x >= 0 && localPos.x < _boardColumns * _cellSpacing;
        bool overBoardZ = localPos.z >= 0 && localPos.z < _boardDepth * _cellSpacing;
        _isOverGrid = overBoardX && overBoardZ;

        // Apply hysteresis to prevent jittery switching at cell boundaries
        if (_isOverGrid)
        {
            // If we don't have a locked position yet, use the raw position
            if (_lockedGridX < 0 || _lockedGridZ < 0)
            {
                _lockedGridX = rawGridX;
                _lockedGridZ = rawGridZ;
            }
            else
            {
                // Calculate how far we are from the CENTER of the locked cell
                float lockedCenterX = (_lockedGridX + 0.5f) * _cellSpacing;
                float lockedCenterZ = (_lockedGridZ + 0.5f) * _cellSpacing;
                
                float distFromLockedX = Mathf.Abs(localPos.x - lockedCenterX);
                float distFromLockedZ = Mathf.Abs(localPos.z - lockedCenterZ);
                
                // Only switch to new cell if we've moved past the hysteresis threshold
                float switchThreshold = _cellSpacing * (0.5f + snapHysteresis);
                
                if (distFromLockedX > switchThreshold)
                {
                    _lockedGridX = rawGridX;
                }
                
                if (distFromLockedZ > switchThreshold)
                {
                    _lockedGridZ = rawGridZ;
                }
            }
            
            // Use the locked (hysteresis-affected) position
            _currentGridX = _lockedGridX;
            _currentGridZ = _lockedGridZ;

            // DISCRETE SNAPPING: Snap piece X/Z to cell center
            if (useDiscreteSnapping)
            {
                ApplyDiscreteSnap();
            }
        }
        else
        {
            _currentGridX = -1;
            _currentGridZ = -1;
            // Don't reset locked position immediately - keep it for when we re-enter
        }
    }

    private void ApplyDiscreteSnap()
    {
        if (_currentGridX < 0 || _currentGridZ < 0) return;

        // Get the exact center of the current cell (at hover height)
        float halfSpace = _cellSpacing / 2f;
        float hoverY = (_boardRows * _cellSpacing) + hoverHeightOffset;

        Vector3 snapLocalPos = new Vector3(
            (_currentGridX * _cellSpacing) + halfSpace,
            hoverY,
            (_currentGridZ * _cellSpacing) + halfSpace
        );

        Vector3 snapWorldPos = _boardTransform.TransformPoint(snapLocalPos);

        // Snap X and Z, keep hand's Y position
        transform.position = new Vector3(
            snapWorldPos.x,
            transform.position.y,  // Keep current Y from hand
            snapWorldPos.z
        );
    }

    private bool IsColumnFull()
    {
        if (_currentGridX < 0 || _currentGridZ < 0 || _gridManager == null)
            return true;

        return _gridManager.IsColumnFull(_currentGridX, _currentGridZ);
    }

    #endregion

    #region Visual Feedback

    private void UpdateVisuals()
    {
        if (_renderer == null) return;

        if (IsOverValidColumn)
        {
            _renderer.material.color = Color.Lerp(_originalColor, validDropColor, 0.4f);
        }
        else if (_isOverGrid)
        {
            _renderer.material.color = Color.Lerp(_originalColor, invalidDropColor, 0.4f);
        }
        else
        {
            _renderer.material.color = _originalColor;
        }
    }

    private void ResetColor()
    {
        if (_renderer != null)
        {
            _renderer.material.color = _originalColor;
        }
    }

    private void CreatePreviewGhost()
    {
        // Use cube primitive for preview
        _previewGhost = GameObject.CreatePrimitive(PrimitiveType.Cube);
        _previewGhost.name = "DropPreview";
        
        // Remove collider
        Collider col = _previewGhost.GetComponent<Collider>();
        if (col != null) Destroy(col);

        // Setup transparent material
        Renderer rend = _previewGhost.GetComponent<Renderer>();
        if (rend != null)
        {
            Material mat = new Material(Shader.Find("Standard"));
            mat.SetFloat("_Mode", 3);
            mat.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
            mat.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            mat.SetInt("_ZWrite", 0);
            mat.DisableKeyword("_ALPHATEST_ON");
            mat.EnableKeyword("_ALPHABLEND_ON");
            mat.DisableKeyword("_ALPHAPREMULTIPLY_ON");
            mat.renderQueue = 3000;
            
            Color ghostColor = _originalColor;
            ghostColor.a = 0.4f;
            mat.color = ghostColor;
            
            rend.material = mat;
        }

        _previewGhost.SetActive(false);
    }

    private void UpdatePreview()
    {
        if (_previewGhost == null || !showDropPreview) return;

        if (IsOverValidColumn)
        {
            int targetY = _gridManager.GetLowestEmptyY(_currentGridX, _currentGridZ);
            
            if (targetY >= 0)
            {
                // Position at where piece will land
                Vector3 previewPos = _gridManager.GetCellCenterWorld(_currentGridX, targetY, _currentGridZ);
                _previewGhost.transform.position = previewPos;
                _previewGhost.transform.localScale = transform.localScale * 0.95f;
                
                // Match grid rotation
                _previewGhost.transform.rotation = _boardTransform.rotation;
                
                _previewGhost.SetActive(true);
                return;
            }
        }

        _previewGhost.SetActive(false);
    }

    private void HidePreview()
    {
        if (_previewGhost != null)
        {
            _previewGhost.SetActive(false);
        }
    }

    #endregion

    #region Drop & Return

    private void DropIntoGrid()
    {
        if (_gridManager == null) return;

        _hasBeenDropped = true;
        ResetColor();

        // IMPORTANT: Disable grabbing so piece can't be picked up again
        if (_grabbable != null)
        {
            _grabbable.SetGrabbable(false);
        }

        if (enableDebugLogs)
        {
            Debug.Log($"GamePiece: Dropping into [{_currentGridX}, {_currentGridZ}] as Player {playerNumber} (now un-grabbable)");
        }

        _gridManager.AcceptPieceDrop(
            this.gameObject,
            _currentGridX,
            _currentGridZ,
            playerNumber
        );

        if (_previewGhost != null)
        {
            Destroy(_previewGhost);
        }
    }

    private void ReturnToSpawn()
    {
        if (enableDebugLogs)
        {
            Debug.Log("GamePiece: Not over valid column, returning to spawn");
        }

        ResetColor();
        
        // Reset locked position
        _lockedGridX = -1;
        _lockedGridZ = -1;
        
        StartCoroutine(ReturnRoutine());
    }

    private IEnumerator ReturnRoutine()
    {
        Vector3 start = transform.position;
        float duration = 0.25f;
        float t = 0f;

        while (t < duration)
        {
            t += Time.deltaTime;
            float progress = t / duration;
            progress = progress * progress * (3f - 2f * progress); // Smoothstep
            transform.position = Vector3.Lerp(start, _spawnPoint, progress);
            yield return null;
        }

        transform.position = _spawnPoint;
    }

    #endregion
}