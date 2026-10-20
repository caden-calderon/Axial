using UnityEngine;
using UnityEngine.Events;

/// <summary>
/// Enables rotation of grabbed objects using a secondary hand's pinch-and-drag gesture.
/// When one hand grabs an object and the other hand pinches and drags, the object rotates.
/// At the end of each turn, the grid's Y rotation resets to upright.
/// </summary>
public class RotationController : MonoBehaviour
{
    #region Constants

    private const int INDEX_TIP = 8;

    #endregion

    #region Serialized Fields

    [Header("Hand References")]
    [Tooltip("GrabController for the left hand")]
    [SerializeField] private GrabController leftGrabController;
    
    [Tooltip("GrabController for the right hand")]
    [SerializeField] private GrabController rightGrabController;
    
    [Tooltip("PinchDetector for the left hand")]
    [SerializeField] private PinchDetector leftPinchDetector;
    
    [Tooltip("PinchDetector for the right hand")]
    [SerializeField] private PinchDetector rightPinchDetector;

    [Header("Rotation Settings")]
    [Tooltip("How sensitive rotation is to hand movement (degrees per unit)")]
    [SerializeField] private float rotationSensitivity = 180f;
    
    [Tooltip("Smooth the rotation input to reduce jitter")]
    [SerializeField] [Range(0f, 0.9f)] private float rotationSmoothing = 0.3f;
    
    [Tooltip("Enable rotation around X axis (pitch - tilt forward/back)")]
    [SerializeField] private bool enablePitchRotation = true;
    
    [Tooltip("Enable rotation around Y axis (yaw - turn left/right)")]
    [SerializeField] private bool enableYawRotation = true;

    [Header("Grid Reset")]
    [Tooltip("Reference to the GridManager for turn-based reset")]
    [SerializeField] private GridManager gridManager;
    
    [Tooltip("Reference to the grid/board transform to reset rotation")]
    [SerializeField] private Transform gridTransform;
    
    [Tooltip("How fast the grid resets to upright (degrees per second)")]
    [SerializeField] private float gridResetSpeed = 180f;
    
    [Tooltip("Only reset Y rotation, preserve X and Z")]
    [SerializeField] private bool resetYRotationOnly = true;
    
    [Tooltip("Automatically reset grid rotation when a piece lands")]
    [SerializeField] private bool autoResetOnTurnEnd = true;

    [Header("Events")]
    public UnityEvent<GameObject> OnRotationStarted;
    public UnityEvent<GameObject> OnRotationEnded;
    public UnityEvent OnGridResetStarted;
    public UnityEvent OnGridResetComplete;

    [Header("Debug")]
    [SerializeField] private bool enableDebugLogs = true;
    [SerializeField] private bool showDebugGizmos = true;

    #endregion

    #region Private Fields

    // Rotation state
    private bool _isRotating = false;
    private GameObject _objectBeingRotated;
    private GrabController _grabbingHand;
    private PinchDetector _rotatingHand;
    private Transform _rotatingHandTracker;
    
    // Index tip tracking
    private Transform _rotatingIndexTip;
    private Vector3 _initialIndexTipPosition;
    private Vector3 _lastIndexTipPosition;
    private Vector3 _smoothedDelta;
    
    // Grid reset
    private bool _isResettingGrid = false;
    private Quaternion _gridTargetRotation;
    
    // Cached grid center
    private Vector3 _gridCenter;
    private bool _gridCenterCalculated = false;

    #endregion

    #region Public Properties

    public bool IsRotating => _isRotating;
    public GameObject ObjectBeingRotated => _objectBeingRotated;
    public bool IsResettingGrid => _isResettingGrid;

    #endregion

    #region Unity Lifecycle

    private void Start()
    {
        // Auto-find components if not assigned
        if (leftGrabController == null || rightGrabController == null)
        {
            AutoFindHandComponents();
        }

        // Auto-find GridManager
        if (gridManager == null)
        {
            gridManager = FindAnyObjectByType<GridManager>();
        }

        // Subscribe to grid events for turn-based reset
        if (gridManager != null)
        {
            gridManager.OnPieceLanded += HandlePieceLanded;
            
            // Auto-find grid transform if not assigned
            if (gridTransform == null)
            {
                gridTransform = gridManager.transform;
            }
            
            if (enableDebugLogs)
            {
                Debug.Log($"RotationController: Subscribed to GridManager.OnPieceLanded");
            }
        }
        else
        {
            Debug.LogWarning("RotationController: No GridManager found - grid reset on turn end won't work");
        }

        // Initialize events
        if (OnRotationStarted == null) OnRotationStarted = new UnityEvent<GameObject>();
        if (OnRotationEnded == null) OnRotationEnded = new UnityEvent<GameObject>();
        if (OnGridResetStarted == null) OnGridResetStarted = new UnityEvent();
        if (OnGridResetComplete == null) OnGridResetComplete = new UnityEvent();

        if (enableDebugLogs)
        {
            Debug.Log($"RotationController initialized. GridManager={gridManager != null}, GridTransform={gridTransform != null}");
        }
    }

    private void Update()
    {
        // Check for rotation start/stop conditions
        UpdateRotationState();

        // Apply rotation if active
        if (_isRotating)
        {
            ApplyRotation();
        }

        // Handle grid reset animation
        if (_isResettingGrid)
        {
            UpdateGridReset();
        }
    }

    private void OnDestroy()
    {
        if (gridManager != null)
        {
            gridManager.OnPieceLanded -= HandlePieceLanded;
        }
    }

    private void OnDrawGizmos()
    {
        if (!showDebugGizmos)
            return;

        // Draw grid center
        if (gridManager != null && gridTransform != null)
        {
            Vector3 center = CalculateGridCenter();
            Gizmos.color = Color.magenta;
            Gizmos.DrawWireSphere(center, 0.3f);
            
            // Draw rotation axes at center
            Gizmos.color = Color.red;
            Gizmos.DrawRay(center, gridTransform.right * 2f);
            Gizmos.color = Color.green;
            Gizmos.DrawRay(center, gridTransform.up * 2f);
            Gizmos.color = Color.blue;
            Gizmos.DrawRay(center, gridTransform.forward * 2f);
        }

        if (!_isRotating || _rotatingIndexTip == null)
            return;

        // Draw initial position
        Gizmos.color = Color.red;
        Gizmos.DrawWireSphere(_initialIndexTipPosition, 0.1f);

        // Draw current position
        Gizmos.color = Color.green;
        Gizmos.DrawWireSphere(_rotatingIndexTip.position, 0.1f);

        // Draw line between them
        Gizmos.color = Color.yellow;
        Gizmos.DrawLine(_initialIndexTipPosition, _rotatingIndexTip.position);
    }

    #endregion

    #region Private Methods - Auto Setup

    private void AutoFindHandComponents()
    {
        // Find all GrabControllers and PinchDetectors in the scene
        GrabController[] grabControllers = FindObjectsByType<GrabController>(FindObjectsSortMode.None);
        
        foreach (var gc in grabControllers)
        {
            HandTracker3D tracker = gc.GetComponent<HandTracker3D>();
            PinchDetector pinch = gc.GetComponent<PinchDetector>();
            
            if (tracker == null || pinch == null) continue;

            if (tracker.ConfiguredHandType == HandTracker3D.HandType.Left)
            {
                leftGrabController = gc;
                leftPinchDetector = pinch;
            }
            else if (tracker.ConfiguredHandType == HandTracker3D.HandType.Right)
            {
                rightGrabController = gc;
                rightPinchDetector = pinch;
            }
        }

        if (enableDebugLogs)
        {
            Debug.Log($"RotationController: Auto-found Left={leftGrabController != null}, Right={rightGrabController != null}");
        }
    }

    #endregion

    #region Private Methods - Grid Center Calculation

    private Vector3 CalculateGridCenter()
    {
        if (gridManager == null || gridTransform == null)
            return Vector3.zero;

        // Calculate the center of the grid in local space, then transform to world
        float halfX = gridManager.columnsX * gridManager.cellSpacing / 2f;
        float halfY = gridManager.rowsY * gridManager.cellSpacing / 2f;
        float halfZ = gridManager.depthZ * gridManager.cellSpacing / 2f;
        
        Vector3 localCenter = new Vector3(halfX, halfY, halfZ);
        return gridTransform.TransformPoint(localCenter);
    }

    private Vector3 CalculateObjectCenter(GameObject obj)
    {
        // Check if this is the grid
        if (gridManager != null && obj == gridTransform?.gameObject)
        {
            return CalculateGridCenter();
        }

        // For other objects, try to use renderer bounds or just transform position
        Renderer rend = obj.GetComponent<Renderer>();
        if (rend != null)
        {
            return rend.bounds.center;
        }

        // Check children for renderers
        Renderer[] childRenderers = obj.GetComponentsInChildren<Renderer>();
        if (childRenderers.Length > 0)
        {
            Bounds combinedBounds = childRenderers[0].bounds;
            for (int i = 1; i < childRenderers.Length; i++)
            {
                combinedBounds.Encapsulate(childRenderers[i].bounds);
            }
            return combinedBounds.center;
        }

        // Fallback to transform position
        return obj.transform.position;
    }

    #endregion

    #region Private Methods - Rotation State

    private void UpdateRotationState()
    {
        // Already rotating - check if we should stop
        if (_isRotating)
        {
            // Stop if rotating hand releases pinch
            if (_rotatingHand != null && !_rotatingHand.IsPinching)
            {
                StopRotation();
                return;
            }

            // Stop if grabbing hand releases the object
            if (_grabbingHand != null && !_grabbingHand.IsHoldingObject)
            {
                StopRotation();
                return;
            }

            return;
        }

        // Not rotating - check if we should start
        // Condition: One hand holding an object, other hand starts pinching (but not holding anything)

        // Check if left hand is grabbing and right hand can rotate
        if (leftGrabController != null && leftGrabController.IsHoldingObject)
        {
            if (rightPinchDetector != null && rightPinchDetector.IsPinching)
            {
                if (rightGrabController == null || !rightGrabController.IsHoldingObject)
                {
                    StartRotation(leftGrabController, rightPinchDetector, rightGrabController?.GetComponent<HandTracker3D>()?.transform);
                    return;
                }
            }
        }

        // Check if right hand is grabbing and left hand can rotate
        if (rightGrabController != null && rightGrabController.IsHoldingObject)
        {
            if (leftPinchDetector != null && leftPinchDetector.IsPinching)
            {
                if (leftGrabController == null || !leftGrabController.IsHoldingObject)
                {
                    StartRotation(rightGrabController, leftPinchDetector, leftGrabController?.GetComponent<HandTracker3D>()?.transform);
                    return;
                }
            }
        }
    }

    private void StartRotation(GrabController grabbingHand, PinchDetector rotatingHand, Transform rotatingHandTracker)
    {
        _isRotating = true;
        _grabbingHand = grabbingHand;
        _rotatingHand = rotatingHand;
        _rotatingHandTracker = rotatingHandTracker;
        _objectBeingRotated = grabbingHand.CurrentlyGrabbedObject;

        // Find the index tip landmark on the rotating hand
        if (_rotatingHandTracker != null)
        {
            _rotatingIndexTip = _rotatingHandTracker.Find($"Landmark_{INDEX_TIP}");
        }

        // Store initial position
        if (_rotatingIndexTip != null)
        {
            _initialIndexTipPosition = _rotatingIndexTip.position;
            _lastIndexTipPosition = _initialIndexTipPosition;
        }
        else
        {
            // Fallback to pinch point
            _initialIndexTipPosition = rotatingHand.PinchPoint;
            _lastIndexTipPosition = _initialIndexTipPosition;
        }

        _smoothedDelta = Vector3.zero;

        // Stop grid reset if user is manually rotating
        if (_objectBeingRotated == gridTransform?.gameObject)
        {
            _isResettingGrid = false;
        }

        OnRotationStarted?.Invoke(_objectBeingRotated);

        if (enableDebugLogs)
        {
            Debug.Log($"RotationController: Started rotating '{_objectBeingRotated.name}'");
        }
    }

    private void StopRotation()
    {
        if (enableDebugLogs && _objectBeingRotated != null)
        {
            Debug.Log($"RotationController: Stopped rotating '{_objectBeingRotated.name}'");
        }

        GameObject rotatedObject = _objectBeingRotated;

        _isRotating = false;
        _objectBeingRotated = null;
        _grabbingHand = null;
        _rotatingHand = null;
        _rotatingHandTracker = null;
        _rotatingIndexTip = null;

        OnRotationEnded?.Invoke(rotatedObject);
    }

    #endregion

    #region Private Methods - Apply Rotation

    private void ApplyRotation()
    {
        if (_objectBeingRotated == null) return;

        // Get current index tip position
        Vector3 currentPosition;
        if (_rotatingIndexTip != null && _rotatingIndexTip.gameObject.activeInHierarchy)
        {
            currentPosition = _rotatingIndexTip.position;
        }
        else if (_rotatingHand != null)
        {
            currentPosition = _rotatingHand.PinchPoint;
        }
        else
        {
            return;
        }

        // Calculate delta from last frame (for incremental rotation)
        Vector3 frameDelta = currentPosition - _lastIndexTipPosition;
        _lastIndexTipPosition = currentPosition;

        // Apply smoothing
        _smoothedDelta = Vector3.Lerp(frameDelta, _smoothedDelta, rotationSmoothing);

        // Calculate rotation amounts
        // X movement (horizontal) -> Y rotation (yaw)
        // Y movement (vertical) -> X rotation (pitch)
        float yawAmount = 0f;
        float pitchAmount = 0f;

        if (enableYawRotation)
        {
            yawAmount = _smoothedDelta.x * rotationSensitivity;
        }

        if (enablePitchRotation)
        {
            pitchAmount = -_smoothedDelta.y * rotationSensitivity; // Negative for intuitive direction
        }

        // Apply rotation around the object's CENTER (not its pivot point)
        if (Mathf.Abs(yawAmount) > 0.001f || Mathf.Abs(pitchAmount) > 0.001f)
        {
            Vector3 rotationCenter = CalculateObjectCenter(_objectBeingRotated);
            
            // Rotate around world up for yaw (feels more natural)
            if (Mathf.Abs(yawAmount) > 0.001f)
            {
                _objectBeingRotated.transform.RotateAround(rotationCenter, Vector3.up, yawAmount);
            }
            
            // Rotate around object's right for pitch
            if (Mathf.Abs(pitchAmount) > 0.001f)
            {
                _objectBeingRotated.transform.RotateAround(rotationCenter, _objectBeingRotated.transform.right, pitchAmount);
            }

            if (enableDebugLogs)
            {
                Debug.Log($"RotationController: Yaw={yawAmount:F2}, Pitch={pitchAmount:F2}, Center={rotationCenter}");
            }
        }
    }

    #endregion

    #region Private Methods - Grid Reset

    private void HandlePieceLanded(int x, int z, int playerNumber)
    {
        if (enableDebugLogs)
        {
            Debug.Log($"RotationController: Piece landed at [{x}, {z}] by Player {playerNumber}. AutoReset={autoResetOnTurnEnd}");
        }

        // Start resetting the grid rotation at end of turn
        if (autoResetOnTurnEnd && gridTransform != null && !_isRotating)
        {
            StartGridReset();
        }
    }

    private void StartGridReset()
    {
        _isResettingGrid = true;

        if (resetYRotationOnly)
        {
            // Only reset Y rotation, keep current X and Z
            Vector3 currentEuler = gridTransform.eulerAngles;
            _gridTargetRotation = Quaternion.Euler(currentEuler.x, 0f, currentEuler.z);
        }
        else
        {
            // Full reset to identity
            _gridTargetRotation = Quaternion.identity;
        }

        OnGridResetStarted?.Invoke();

        if (enableDebugLogs)
        {
            Debug.Log($"RotationController: Starting grid reset. Current Y={gridTransform.eulerAngles.y:F1}");
        }
    }

    private void UpdateGridReset()
    {
        if (gridTransform == null)
        {
            _isResettingGrid = false;
            return;
        }

        // If user starts rotating during reset, cancel the reset
        if (_isRotating && _objectBeingRotated == gridTransform.gameObject)
        {
            _isResettingGrid = false;
            return;
        }

        // Smoothly rotate toward target
        float step = gridResetSpeed * Time.deltaTime;
        gridTransform.rotation = Quaternion.RotateTowards(gridTransform.rotation, _gridTargetRotation, step);

        // Check if we've reached the target
        float angle = Quaternion.Angle(gridTransform.rotation, _gridTargetRotation);
        if (angle < 0.5f)
        {
            gridTransform.rotation = _gridTargetRotation;
            _isResettingGrid = false;

            OnGridResetComplete?.Invoke();

            if (enableDebugLogs)
            {
                Debug.Log("RotationController: Grid reset complete");
            }
        }
    }

    #endregion

    #region Public Methods

    /// <summary>
    /// Manually trigger a grid rotation reset (can be called from UI button)
    /// </summary>
    public void ResetGridRotation()
    {
        if (gridTransform != null)
        {
            StartGridReset();
        }
    }

    /// <summary>
    /// Immediately snap grid to upright (no animation)
    /// </summary>
    public void SnapGridUpright()
    {
        if (gridTransform != null)
        {
            if (resetYRotationOnly)
            {
                Vector3 euler = gridTransform.eulerAngles;
                gridTransform.eulerAngles = new Vector3(euler.x, 0f, euler.z);
            }
            else
            {
                gridTransform.rotation = Quaternion.identity;
            }
            _isResettingGrid = false;
            
            OnGridResetComplete?.Invoke();
        }
    }

    /// <summary>
    /// Force stop any active rotation
    /// </summary>
    public void ForceStopRotation()
    {
        if (_isRotating)
        {
            StopRotation();
        }
    }

    #endregion
}