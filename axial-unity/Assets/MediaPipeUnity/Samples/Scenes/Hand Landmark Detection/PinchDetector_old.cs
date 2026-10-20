using UnityEngine;
using UnityEngine.Events;

/// <summary>
/// Detects pinch gestures by measuring distance between thumb tip and index finger tip.
/// Attach this to the same GameObject as HandTracker3D.
/// </summary>
[RequireComponent(typeof(HandTracker3D))]
public class PinchDetector_old : MonoBehaviour
{
    #region Constants

    // MediaPipe hand landmark indices
    private const int THUMB_TIP = 4;
    private const int INDEX_TIP = 8;

    #endregion

    #region Serialized Fields

    [Header("Pinch Detection")]
    [SerializeField] private float pinchThreshold = 0.8f;      // Distance to trigger pinch
    [SerializeField] private float releaseThreshold = 1.2f;    // Distance to release pinch (hysteresis)

    [Header("Debug")]
    [SerializeField] private bool enableDebugVisualization = true;
    [SerializeField] private bool enableDebugLogs = false;

    #endregion

    #region Events

    [Header("Events")]
    public UnityEvent OnPinchStart;
    public UnityEvent OnPinchRelease;

    #endregion

    #region Public Properties

    /// <summary>
    /// Is the hand currently in a pinch state?
    /// </summary>
    public bool IsPinching { get; private set; }

    /// <summary>
    /// World position of the pinch point (midpoint between thumb and index tips)
    /// </summary>
    public Vector3 PinchPoint { get; private set; }

    /// <summary>
    /// Current distance between thumb and index tips (world space)
    /// </summary>
    public float CurrentPinchDistance { get; private set; }

    #endregion

    #region Private Fields

    private HandTracker3D _handTracker;
    private GameObject _thumbTipLandmark;
    private GameObject _indexTipLandmark;
    private bool _landmarksInitialized = false;

    #endregion

    #region Unity Lifecycle

    private void Start()
    {
        // Get reference to HandTracker3D on same GameObject
        _handTracker = GetComponent<HandTracker3D>();

        if (_handTracker == null)
        {
            Debug.LogError("PinchDetector requires HandTracker3D component on the same GameObject!");
            enabled = false;
            return;
        }

        // Initialize events if null
        if (OnPinchStart == null) OnPinchStart = new UnityEvent();
        if (OnPinchRelease == null) OnPinchRelease = new UnityEvent();

        if (enableDebugLogs)
        {
            Debug.Log("PinchDetector initialized successfully");
        }
    }

    private void Update()
    {
        // Try to initialize landmark references if not done yet
        if (!_landmarksInitialized)
        {
            TryInitializeLandmarks();
            return;
        }

        // Check if landmarks are still valid
        if (_thumbTipLandmark == null || _indexTipLandmark == null ||
            !_thumbTipLandmark.activeInHierarchy || !_indexTipLandmark.activeInHierarchy)
        {
            // Hand not visible - reset pinch state
            if (IsPinching)
            {
                ReleasePinch();
            }
            return;
        }

        // Calculate pinch distance
        UpdatePinchState();
    }

    private void OnDrawGizmos()
    {
        if (!enableDebugVisualization || !_landmarksInitialized)
        {
            return;
        }

        if (_thumbTipLandmark == null || _indexTipLandmark == null)
        {
            return;
        }

        if (!_thumbTipLandmark.activeInHierarchy || !_indexTipLandmark.activeInHierarchy)
        {
            return;
        }

        Vector3 thumbPos = _thumbTipLandmark.transform.position;
        Vector3 indexPos = _indexTipLandmark.transform.position;

        // Draw line between thumb and index
        Gizmos.color = IsPinching ? Color.green : Color.yellow;
        Gizmos.DrawLine(thumbPos, indexPos);

        // Draw pinch point
        Gizmos.color = IsPinching ? Color.green : Color.cyan;
        Gizmos.DrawWireSphere(PinchPoint, 0.05f);

        // Draw threshold visualization
        Gizmos.color = Color.red;
        Gizmos.DrawWireSphere(thumbPos, pinchThreshold);
    }

    #endregion

    #region Private Methods

    private void TryInitializeLandmarks()
    {
        // Access the landmark prefabs array from HandTracker3D
        // We need to use reflection or make the array public, or access child transforms
        // For now, let's find them by name since HandTracker3D names them "Landmark_X"

        Transform thumbTip = transform.Find($"Landmark_{THUMB_TIP}");
        Transform indexTip = transform.Find($"Landmark_{INDEX_TIP}");

        if (thumbTip != null && indexTip != null)
        {
            _thumbTipLandmark = thumbTip.gameObject;
            _indexTipLandmark = indexTip.gameObject;
            _landmarksInitialized = true;

            if (enableDebugLogs)
            {
                Debug.Log("PinchDetector: Landmark references initialized");
            }
        }
    }

    private void UpdatePinchState()
    {
        // Get world positions
        Vector3 thumbPos = _thumbTipLandmark.transform.position;
        Vector3 indexPos = _indexTipLandmark.transform.position;

        // Calculate distance
        CurrentPinchDistance = Vector3.Distance(thumbPos, indexPos);

        // Update pinch point (midpoint)
        PinchPoint = (thumbPos + indexPos) * 0.5f;

        // State machine with hysteresis
        if (!IsPinching)
        {
            // Check if we should start pinching
            if (CurrentPinchDistance <= pinchThreshold)
            {
                StartPinch();
            }
        }
        else
        {
            // Check if we should release pinch
            if (CurrentPinchDistance >= releaseThreshold)
            {
                ReleasePinch();
            }
        }
    }

    private void StartPinch()
    {
        IsPinching = true;
        OnPinchStart?.Invoke();

        if (enableDebugLogs)
        {
            Debug.Log($"PINCH START - Distance: {CurrentPinchDistance:F3}");
        }
    }

    private void ReleasePinch()
    {
        IsPinching = false;
        OnPinchRelease?.Invoke();

        if (enableDebugLogs)
        {
            Debug.Log($"PINCH RELEASE - Distance: {CurrentPinchDistance:F3}");
        }
    }

    #endregion
}
