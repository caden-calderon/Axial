using UnityEngine;

/// <summary>
/// Handles grabbing and releasing objects based on pinch gestures.
/// Works with PinchDetector to grab nearby objects when pinching.
/// Includes smoothing to reduce hand tracking jitter.
/// Supports position-locked objects for rotation-only interaction.
/// </summary>
[RequireComponent(typeof(PinchDetector))]
public class GrabController_old : MonoBehaviour
{
    #region Serialized Fields

    [Header("Grab Settings")]
    [SerializeField] private float grabRadius = 1.0f;
    [SerializeField] private LayerMask grabbableLayer = -1;
    [SerializeField] private bool useClosestObject = true;

    [Header("Smoothing")]
    [Tooltip("How quickly grabbed objects follow the hand (higher = faster, more jittery)")]
    [SerializeField] [Range(1f, 50f)] private float followSpeed = 15f;
    
    [Tooltip("Smooths the pinch point itself to reduce hand tracking noise")]
    [SerializeField] [Range(0f, 0.95f)] private float pinchPointSmoothing = 0.7f;
    
    [Tooltip("Minimum movement threshold - ignores tiny jitters below this distance")]
    [SerializeField] private float movementDeadzone = 0.005f;

    [Header("Physics")]
    [SerializeField] private bool disableGravityWhenGrabbed = true;
    [SerializeField] private bool disableCollisionsWhenGrabbed = false;
    [SerializeField] private bool applyThrowVelocity = false;
    [SerializeField] [Range(0f, 2f)] private float throwVelocityMultiplier = 1f;

    [Header("Debug")]
    [SerializeField] private bool enableDebugVisualization = true;
    [SerializeField] private bool enableDebugLogs = true;

    #endregion

    #region Private Fields

    private PinchDetector _pinchDetector;
    private GameObject _currentlyGrabbedObject;
    private GrabbableObject _currentGrabbable;
    private Vector3 _grabOffset;
    
    // Physics state storage
    private Rigidbody _grabbedRigidbody;
    private bool _originalIsKinematic;
    private bool _originalUseGravity;
    private CollisionDetectionMode _originalCollisionMode;
    private int _originalLayer;
    
    // Smoothing
    private Vector3 _smoothedPinchPoint;
    private Vector3 _targetPosition;
    private Vector3 _velocity; // For SmoothDamp
    
    // Throw velocity tracking
    private Vector3[] _velocityHistory = new Vector3[5];
    private int _velocityIndex = 0;
    private Vector3 _lastPosition;
    
    // Position lock state
    private bool _isPositionLocked = false;

    #endregion

    #region Public Properties

    public GameObject CurrentlyGrabbedObject => _currentlyGrabbedObject;
    public bool IsHoldingObject => _currentlyGrabbedObject != null;
    public Vector3 SmoothedPinchPoint => _smoothedPinchPoint;
    
    /// <summary>
    /// True if the currently grabbed object has its position locked (rotation only)
    /// </summary>
    public bool IsHoldingPositionLockedObject => _isPositionLocked;

    #endregion

    #region Unity Lifecycle

    private void Start()
    {
        _pinchDetector = GetComponent<PinchDetector>();

        if (_pinchDetector == null)
        {
            Debug.LogError("GrabController requires PinchDetector component!");
            enabled = false;
            return;
        }

        _pinchDetector.OnPinchStart.AddListener(OnPinchStarted);
        _pinchDetector.OnPinchRelease.AddListener(OnPinchReleased);

        // Initialize smoothed position
        _smoothedPinchPoint = _pinchDetector.PinchPoint;

        if (enableDebugLogs)
        {
            Debug.Log("GrabController initialized with smoothing");
        }
    }

    private void Update()
    {
        // Always update smoothed pinch point
        UpdateSmoothedPinchPoint();

        if (_currentlyGrabbedObject != null && _pinchDetector.IsPinching)
        {
            // Only update position if not locked
            if (!_isPositionLocked)
            {
                UpdateGrabbedObjectPosition();
            }
            TrackVelocity();
        }
    }

    private void LateUpdate()
    {
        // LateUpdate ensures we move after any physics updates
        if (_currentlyGrabbedObject != null && _pinchDetector.IsPinching)
        {
            // Only apply position if not locked
            if (!_isPositionLocked)
            {
                // Force position in LateUpdate to override any physics interference
                ApplyFinalPosition();
            }
        }
    }

    private void OnDrawGizmos()
    {
        if (!enableDebugVisualization || _pinchDetector == null)
            return;

        // Raw pinch point (red)
        Gizmos.color = Color.red;
        Gizmos.DrawWireSphere(_pinchDetector.PinchPoint, 0.05f);

        // Smoothed pinch point (green)
        Gizmos.color = Color.green;
        Gizmos.DrawWireSphere(_smoothedPinchPoint, 0.08f);

        // Grab radius
        Gizmos.color = _currentlyGrabbedObject != null ? Color.green : Color.yellow;
        Gizmos.DrawWireSphere(_smoothedPinchPoint, grabRadius);

        // Line to grabbed object (cyan for normal, magenta for position-locked)
        if (_currentlyGrabbedObject != null)
        {
            Gizmos.color = _isPositionLocked ? Color.magenta : Color.cyan;
            Gizmos.DrawLine(_smoothedPinchPoint, _currentlyGrabbedObject.transform.position);
        }
    }

    #endregion

    #region Smoothing

    private void UpdateSmoothedPinchPoint()
    {
        Vector3 rawPoint = _pinchDetector.PinchPoint;
        
        // Apply exponential smoothing (low-pass filter)
        _smoothedPinchPoint = Vector3.Lerp(rawPoint, _smoothedPinchPoint, pinchPointSmoothing);
        
        // Deadzone - if movement is tiny, don't update at all
        if (Vector3.Distance(rawPoint, _smoothedPinchPoint) < movementDeadzone)
        {
            // Keep current smoothed position
        }
    }

    #endregion

    #region Event Handlers

    private void OnPinchStarted()
    {
        if (enableDebugLogs)
        {
            Debug.Log("GrabController: Pinch started - searching for objects");
        }

        // Reset smoothed position to current on grab start
        _smoothedPinchPoint = _pinchDetector.PinchPoint;

        GameObject targetObject = FindNearestGrabbableObject();

        if (targetObject != null)
        {
            GrabObject(targetObject);
        }
        else if (enableDebugLogs)
        {
            Debug.Log("GrabController: No grabbable objects in range");
        }
    }

    private void OnPinchReleased()
    {
        if (enableDebugLogs)
        {
            Debug.Log("GrabController: Pinch released");
        }

        if (_currentlyGrabbedObject != null)
        {
            ReleaseObject();
        }
    }

    #endregion

    #region Object Search

    private GameObject FindNearestGrabbableObject()
    {
        Vector3 searchPoint = _smoothedPinchPoint;
        Collider[] colliders = Physics.OverlapSphere(searchPoint, grabRadius, grabbableLayer);

        if (colliders.Length == 0)
            return null;

        GameObject closestObject = null;
        float closestDistance = float.MaxValue;

        foreach (Collider col in colliders)
        {
            GrabbableObject grabbable = col.GetComponent<GrabbableObject>();
            
            // Skip if no GrabbableObject component
            if (grabbable == null)
                continue;
            
            // Skip if already grabbed by another hand
            if (grabbable.IsGrabbed)
            {
                if (enableDebugLogs)
                {
                    Debug.Log($"GrabController: Skipping '{col.name}' - already grabbed");
                }
                continue;
            }

            float distance = Vector3.Distance(searchPoint, col.transform.position);
            if (distance < closestDistance)
            {
                closestDistance = distance;
                closestObject = col.gameObject;
            }
        }

        return closestObject;
    }

    #endregion

    #region Grab/Release

    private void GrabObject(GameObject obj)
    {
        _currentlyGrabbedObject = obj;

        // Get GrabbableObject component
        _currentGrabbable = obj.GetComponent<GrabbableObject>();
        
        // Check if position should be locked (for rotation-only objects like game board)
        _isPositionLocked = _currentGrabbable != null && _currentGrabbable.LockPositionWhenGrabbed;

        // Calculate grab offset (even for locked objects, for consistency)
        if (_currentGrabbable != null && _currentGrabbable.HasCustomOffset)
        {
            _grabOffset = _currentGrabbable.CustomGrabOffset;
        }
        else
        {
            _grabOffset = obj.transform.position - _smoothedPinchPoint;
        }

        // Store and modify rigidbody state
        _grabbedRigidbody = obj.GetComponent<Rigidbody>();
        if (_grabbedRigidbody != null)
        {
            // Store original state
            _originalIsKinematic = _grabbedRigidbody.isKinematic;
            _originalUseGravity = _grabbedRigidbody.useGravity;
            _originalCollisionMode = _grabbedRigidbody.collisionDetectionMode;

            // FORCE kinematic - this is the key to stopping physics interference
            _grabbedRigidbody.collisionDetectionMode = CollisionDetectionMode.ContinuousSpeculative;
            _grabbedRigidbody.isKinematic = true;
            _grabbedRigidbody.useGravity = false;
            
            // Zero out any existing velocity
            _grabbedRigidbody.linearVelocity = Vector3.zero;
            _grabbedRigidbody.angularVelocity = Vector3.zero;
        }

        // Optionally disable collisions entirely (but not for position-locked objects)
        if (disableCollisionsWhenGrabbed && !_isPositionLocked)
        {
            _originalLayer = obj.layer;
            obj.layer = LayerMask.NameToLayer("Ignore Raycast");
        }

        // Initialize position tracking
        _targetPosition = obj.transform.position;
        _lastPosition = obj.transform.position;
        _velocity = Vector3.zero;
        
        // Clear velocity history
        for (int i = 0; i < _velocityHistory.Length; i++)
            _velocityHistory[i] = Vector3.zero;

        // Notify GrabbableObject
        if (_currentGrabbable != null)
        {
            _currentGrabbable.OnGrabbed();
        }

        if (enableDebugLogs)
        {
            Debug.Log($"GrabController: Grabbed '{obj.name}' | Kinematic forced ON | PositionLocked={_isPositionLocked}");
        }
    }

    private void ReleaseObject()
    {
        if (_currentlyGrabbedObject == null)
            return;

        GameObject releasedObject = _currentlyGrabbedObject;
        bool wasPositionLocked = _isPositionLocked;

        // Check for GamePiece first
        GamePiece gamePiece = releasedObject.GetComponent<GamePiece>();
        bool pieceHandledDrop = false;

        if (gamePiece != null)
        {
            pieceHandledDrop = gamePiece.OnPieceReleased();
        }

        // Restore rigidbody state (only if GamePiece didn't take over)
        if (!pieceHandledDrop && _grabbedRigidbody != null)
        {
            // Restore original state
            _grabbedRigidbody.isKinematic = _originalIsKinematic;
            _grabbedRigidbody.useGravity = _originalUseGravity;
            _grabbedRigidbody.collisionDetectionMode = _originalCollisionMode;

            // Apply throw velocity (but not for position-locked objects)
            if (applyThrowVelocity && !_grabbedRigidbody.isKinematic && !wasPositionLocked)
            {
                Vector3 avgVelocity = CalculateAverageVelocity();
                _grabbedRigidbody.linearVelocity = avgVelocity * throwVelocityMultiplier;

                if (enableDebugLogs)
                {
                    Debug.Log($"GrabController: Throw velocity {avgVelocity.magnitude:F2}");
                }
            }
        }

        // Restore layer
        if (disableCollisionsWhenGrabbed && !wasPositionLocked)
        {
            releasedObject.layer = _originalLayer;
        }

        // Notify GrabbableObject
        if (_currentGrabbable != null)
        {
            _currentGrabbable.OnReleased();
        }

        if (enableDebugLogs)
        {
            Debug.Log($"GrabController: Released '{releasedObject.name}'");
        }

        _currentlyGrabbedObject = null;
        _currentGrabbable = null;
        _grabbedRigidbody = null;
        _isPositionLocked = false;
    }

    #endregion

    #region Position Updates

    private void UpdateGrabbedObjectPosition()
    {
        // Calculate target position using smoothed pinch point
        _targetPosition = _smoothedPinchPoint + _grabOffset;
    }

    private void ApplyFinalPosition()
    {
        if (_currentlyGrabbedObject == null)
            return;

        Vector3 currentPos = _currentlyGrabbedObject.transform.position;
        
        // Smooth movement toward target
        Vector3 newPosition = Vector3.Lerp(currentPos, _targetPosition, followSpeed * Time.deltaTime);
        
        // Apply deadzone
        if (Vector3.Distance(newPosition, currentPos) < movementDeadzone)
        {
            return; // Don't update if movement is too small
        }

        _currentlyGrabbedObject.transform.position = newPosition;
    }

    private void TrackVelocity()
    {
        if (_currentlyGrabbedObject == null)
            return;

        Vector3 currentPos = _currentlyGrabbedObject.transform.position;
        Vector3 frameVelocity = (currentPos - _lastPosition) / Time.deltaTime;
        
        _velocityHistory[_velocityIndex] = frameVelocity;
        _velocityIndex = (_velocityIndex + 1) % _velocityHistory.Length;
        
        _lastPosition = currentPos;
    }

    private Vector3 CalculateAverageVelocity()
    {
        Vector3 sum = Vector3.zero;
        foreach (var v in _velocityHistory)
        {
            sum += v;
        }
        return sum / _velocityHistory.Length;
    }

    #endregion
}