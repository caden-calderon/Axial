using UnityEngine;
using UnityEngine.Events;

/// <summary>
/// Detects pinch gestures by measuring distance between thumb tip and index finger tip.
/// Includes optional smoothing to reduce hand tracking jitter.
/// Attach this to the same GameObject as HandTracker3D.
/// </summary>
[RequireComponent(typeof(HandTracker3D))]
public class PinchDetector : MonoBehaviour
{
    #region Constants

    // MediaPipe hand landmark indices
    private const int THUMB_TIP = 4;
    private const int INDEX_TIP = 8;

    #endregion

    #region Serialized Fields

    [Header("Pinch Detection")]
    [SerializeField] private float pinchThreshold = 0.8f;
    [SerializeField] private float releaseThreshold = 1.2f;

    [Header("Smoothing")]
    [Tooltip("Smooths the pinch point position (0 = no smoothing, higher = more smooth but laggy)")]
    [SerializeField] [Range(0f, 0.95f)] private float positionSmoothing = 0.5f;
    
    [Tooltip("Smooths the pinch distance for more stable detection")]
    [SerializeField] [Range(0f, 0.95f)] private float distanceSmoothing = 0.3f;
    
    [Tooltip("How many frames a pinch must be held before triggering (prevents false positives)")]
    [SerializeField] [Range(0, 10)] private int pinchConfirmFrames = 2;

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
    /// World position of the pinch point (smoothed midpoint between thumb and index tips)
    /// </summary>
    public Vector3 PinchPoint => _smoothedPinchPoint;

    /// <summary>
    /// Raw (unsmoothed) pinch point for debugging
    /// </summary>
    public Vector3 RawPinchPoint => _rawPinchPoint;

    /// <summary>
    /// Current distance between thumb and index tips (smoothed)
    /// </summary>
    public float CurrentPinchDistance => _smoothedDistance;

    /// <summary>
    /// Raw (unsmoothed) distance for debugging
    /// </summary>
    public float RawPinchDistance => _rawDistance;

    #endregion

    #region Private Fields

    private HandTracker3D _handTracker;
    private GameObject _thumbTipLandmark;
    private GameObject _indexTipLandmark;
    private bool _landmarksInitialized = false;

    // Smoothing
    private Vector3 _rawPinchPoint;
    private Vector3 _smoothedPinchPoint;
    private float _rawDistance;
    private float _smoothedDistance;

    // Confirmation
    private int _pinchConfirmCounter = 0;
    private int _releaseConfirmCounter = 0;

    #endregion

    #region Unity Lifecycle

    private void Start()
    {
        _handTracker = GetComponent<HandTracker3D>();

        if (_handTracker == null)
        {
            Debug.LogError("PinchDetector requires HandTracker3D component on the same GameObject!");
            enabled = false;
            return;
        }

        if (OnPinchStart == null) OnPinchStart = new UnityEvent();
        if (OnPinchRelease == null) OnPinchRelease = new UnityEvent();

        if (enableDebugLogs)
        {
            Debug.Log("PinchDetector initialized with smoothing");
        }
    }

    private void Update()
    {
        if (!_landmarksInitialized)
        {
            TryInitializeLandmarks();
            return;
        }

        if (_thumbTipLandmark == null || _indexTipLandmark == null ||
            !_thumbTipLandmark.activeInHierarchy || !_indexTipLandmark.activeInHierarchy)
        {
            if (IsPinching)
            {
                ReleasePinch();
            }
            return;
        }

        UpdatePinchState();
    }

    private void OnDrawGizmos()
    {
        if (!enableDebugVisualization || !_landmarksInitialized)
            return;

        if (_thumbTipLandmark == null || _indexTipLandmark == null)
            return;

        if (!_thumbTipLandmark.activeInHierarchy || !_indexTipLandmark.activeInHierarchy)
            return;

        Vector3 thumbPos = _thumbTipLandmark.transform.position;
        Vector3 indexPos = _indexTipLandmark.transform.position;

        // Line between thumb and index (raw)
        Gizmos.color = Color.gray;
        Gizmos.DrawLine(thumbPos, indexPos);

        // Raw pinch point
        Gizmos.color = Color.red;
        Gizmos.DrawWireSphere(_rawPinchPoint, 0.03f);

        // Smoothed pinch point
        Gizmos.color = IsPinching ? Color.green : Color.cyan;
        Gizmos.DrawWireSphere(_smoothedPinchPoint, 0.05f);

        // Threshold visualization on thumb
        Gizmos.color = new Color(1f, 0f, 0f, 0.3f);
        Gizmos.DrawWireSphere(thumbPos, pinchThreshold);
    }

    #endregion

    #region Private Methods

    private void TryInitializeLandmarks()
    {
        Transform thumbTip = transform.Find($"Landmark_{THUMB_TIP}");
        Transform indexTip = transform.Find($"Landmark_{INDEX_TIP}");

        if (thumbTip != null && indexTip != null)
        {
            _thumbTipLandmark = thumbTip.gameObject;
            _indexTipLandmark = indexTip.gameObject;
            _landmarksInitialized = true;

            // Initialize smoothed values
            Vector3 thumbPos = _thumbTipLandmark.transform.position;
            Vector3 indexPos = _indexTipLandmark.transform.position;
            _rawPinchPoint = (thumbPos + indexPos) * 0.5f;
            _smoothedPinchPoint = _rawPinchPoint;
            _rawDistance = Vector3.Distance(thumbPos, indexPos);
            _smoothedDistance = _rawDistance;

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

        // Calculate raw values
        _rawDistance = Vector3.Distance(thumbPos, indexPos);
        _rawPinchPoint = (thumbPos + indexPos) * 0.5f;

        // Apply smoothing (exponential moving average)
        _smoothedDistance = Mathf.Lerp(_rawDistance, _smoothedDistance, distanceSmoothing);
        _smoothedPinchPoint = Vector3.Lerp(_rawPinchPoint, _smoothedPinchPoint, positionSmoothing);

        // State machine with hysteresis AND confirmation frames
        if (!IsPinching)
        {
            // Check if we should start pinching
            if (_smoothedDistance <= pinchThreshold)
            {
                _pinchConfirmCounter++;
                if (_pinchConfirmCounter >= pinchConfirmFrames)
                {
                    StartPinch();
                    _pinchConfirmCounter = 0;
                }
            }
            else
            {
                _pinchConfirmCounter = 0;
            }
            _releaseConfirmCounter = 0;
        }
        else
        {
            // Check if we should release pinch
            if (_smoothedDistance >= releaseThreshold)
            {
                _releaseConfirmCounter++;
                if (_releaseConfirmCounter >= pinchConfirmFrames)
                {
                    ReleasePinch();
                    _releaseConfirmCounter = 0;
                }
            }
            else
            {
                _releaseConfirmCounter = 0;
            }
            _pinchConfirmCounter = 0;
        }
    }

    private void StartPinch()
    {
        IsPinching = true;
        OnPinchStart?.Invoke();

        if (enableDebugLogs)
        {
            Debug.Log($"PINCH START - Distance: {_smoothedDistance:F3} (raw: {_rawDistance:F3})");
        }
    }

    private void ReleasePinch()
    {
        IsPinching = false;
        OnPinchRelease?.Invoke();

        if (enableDebugLogs)
        {
            Debug.Log($"PINCH RELEASE - Distance: {_smoothedDistance:F3} (raw: {_rawDistance:F3})");
        }
    }

    #endregion
}
