using UnityEngine;
using Mediapipe.Tasks.Vision.HandLandmarker;

/// <summary>
/// Tracks a single hand in 3D space based on MediaPipe landmarks.
/// Improved Z-depth calculation for intuitive hand distance.
/// </summary>
public class HandTracker3D : MonoBehaviour
{
    #region Enums

    public enum HandSizeMethod
    {
        MediaPipeZAverage,
        AverageMultiplePairs,
        PalmWidth,
        PalmMaxDimension,
        StableLandmarksOnly
    }

    public enum ZDepthMode
    {
        /// <summary>
        /// Larger palm = further Z (hand close to camera = reaching further into scene)
        /// </summary>
        LargerPalmFurtherZ,
        
        /// <summary>
        /// Larger palm = closer Z (hand close to camera = close in scene)
        /// </summary>
        LargerPalmCloserZ,
        
        /// <summary>
        /// Fixed Z depth - hand stays at constant distance
        /// </summary>
        FixedDepth
    }

    public enum HandType
    {
        Either,
        Left,
        Right
    }

    #endregion

    #region Constants

    private const int WRIST = 0;
    private const int INDEX_FINGER_BASE = 5;
    private const int MIDDLE_FINGER_BASE = 9;
    private const int MIDDLE_FINGER_TIP = 12;
    private const int PINKY_FINGER_BASE = 17;

    private static readonly int[] STABLE_LANDMARKS = { 0, 5, 9, 13, 17 };

    private static readonly int[,] HAND_CONNECTIONS = new int[,]
    {
        {0, 1}, {0, 5}, {0, 9}, {0, 13}, {0, 17},
        {1, 2}, {2, 3}, {3, 4},
        {5, 6}, {6, 7}, {7, 8},
        {9, 10}, {10, 11}, {11, 12},
        {13, 14}, {14, 15}, {15, 16},
        {17, 18}, {18, 19}, {19, 20}
    };

    #endregion

    #region Serialized Fields

    [Header("Hand Configuration")]
    [SerializeField] private HandType handType = HandType.Either;

    [Header("Landmark Prefabs")]
    [SerializeField] private GameObject[] landmarkPrefabs = new GameObject[21];

    [Header("Hand Skeleton Bones")]
    [SerializeField] private bool enableSkeletonBones = true;
    [SerializeField] private Material boneMaterial;
    [SerializeField] private float boneThickness = 0.05f;

    [Header("Screen Mapping (X/Y)")]
    [SerializeField] private float screenWidth = 10.0f;
    [SerializeField] private float screenHeight = 10.0f;

    [Header("Z Depth Settings")]
    [SerializeField] private ZDepthMode zDepthMode = ZDepthMode.LargerPalmFurtherZ;
    [SerializeField] private HandSizeMethod handSizeMethod = HandSizeMethod.PalmMaxDimension;
    
    [Tooltip("Closest Z position (when hand is nearest to camera)")]
    [SerializeField] private float nearZ = 5.0f;
    
    [Tooltip("Furthest Z position (when hand is furthest from camera)")]
    [SerializeField] private float farZ = 25.0f;
    
    [Tooltip("Fixed Z position when using FixedDepth mode")]
    [SerializeField] private float fixedZ = 15.0f;
    
    [Tooltip("Sensitivity of Z movement (higher = more responsive to hand distance changes)")]
    [SerializeField] [Range(0.5f, 3.0f)] private float zSensitivity = 1.0f;

    [Header("Landmark Depth (finger curvature)")]
    [Tooltip("How much individual landmarks move in Z relative to palm")]
    [SerializeField] private float landmarkDepthScale = 2.0f;

    [Header("Mirroring")]
    [SerializeField] private bool mirrorX = true;

    [Header("Smoothing")]
    [Tooltip("Smooth position changes (0 = no smoothing, higher = smoother but laggier)")]
    [SerializeField] [Range(0f, 0.9f)] private float positionSmoothing = 0.3f;

    [Header("Debug")]
    [SerializeField] private bool enableDebugLogs = false;
    [SerializeField] private bool showDebugGizmos = false;

    #endregion

    #region Private Fields

    private readonly object _currentTargetLock = new();
    private HandLandmarkerResult _currentTarget;
    private int _targetHandIndex = 0;
    private bool _isResultReady = false;
    private bool _landmarksVisible = false;

    private GameObject[] _boneObjects;
    private Transform[] _boneTransforms;

    // Smoothing
    private Vector3 _smoothedPosition;
    private float _lastRawHandSize = 0.5f;

    // Debug
    private float _debugRawSize;
    private float _debugNormSize;
    private float _debugCalculatedZ;

    #endregion

    #region Public Properties

    public HandType ConfiguredHandType => handType;
    public bool IsVisible => _landmarksVisible;

    #endregion

    #region Unity Lifecycle

    private void Start()
    {
        InitializeLandmarkPrefabs();
        InitializeSkeletonBones();
        ToggleLandmarks(false);
        
        _smoothedPosition = transform.localPosition;

        if (enableDebugLogs)
        {
            Debug.Log($"HandTracker3D ({handType}) initialized. ZMode: {zDepthMode}, Near: {nearZ}, Far: {farZ}");
        }
    }

    private void Update()
    {
        if (_isResultReady)
        {
            SyncNow();
            _isResultReady = false;
        }
    }

    private void OnDrawGizmos()
    {
        if (!showDebugGizmos) return;

        // Draw hand position
        Gizmos.color = _landmarksVisible ? Color.green : Color.red;
        Gizmos.DrawWireSphere(transform.position, 0.3f);

        // Draw Z range
        Vector3 pos = transform.position;
        Gizmos.color = Color.blue;
        Gizmos.DrawLine(new Vector3(pos.x, pos.y, nearZ), new Vector3(pos.x, pos.y, farZ));
        
        // Draw current Z
        Gizmos.color = Color.yellow;
        Gizmos.DrawWireSphere(new Vector3(pos.x, pos.y, pos.z), 0.2f);
    }

    #endregion

    #region Public API

    public void OnHandDataReceived(HandLandmarkerResult handDataResult)
    {
        OnHandDataReceivedWithIndex(handDataResult, 0);
    }

    public void OnHandDataReceivedWithIndex(HandLandmarkerResult handDataResult, int handIndex)
    {
        lock (_currentTargetLock)
        {
            handDataResult.CloneTo(ref _currentTarget);
            _targetHandIndex = handIndex;
            _isResultReady = true;
        }
    }

    public void HideHandExternal()
    {
        HideHand();
    }

    #endregion

    #region Private Methods - Initialization

    private void InitializeLandmarkPrefabs()
    {
        for (int i = 0; i < landmarkPrefabs.Length; i++)
        {
            if (landmarkPrefabs[i] != null)
            {
                landmarkPrefabs[i] = Instantiate(landmarkPrefabs[i], transform);
                landmarkPrefabs[i].name = $"Landmark_{i}";

                int landmarkLayer = LayerMask.NameToLayer("HandLandmarks");
                if (landmarkLayer >= 0)
                {
                    landmarkPrefabs[i].layer = landmarkLayer;
                }

                Collider col = landmarkPrefabs[i].GetComponent<Collider>();
                if (col == null)
                {
                    col = landmarkPrefabs[i].AddComponent<SphereCollider>();
                }

                Rigidbody rb = landmarkPrefabs[i].GetComponent<Rigidbody>();
                if (rb == null)
                {
                    rb = landmarkPrefabs[i].AddComponent<Rigidbody>();
                }
                rb.isKinematic = true;
                rb.useGravity = false;
            }
        }
    }

    private void InitializeSkeletonBones()
    {
        if (!enableSkeletonBones) return;

        int connectionCount = HAND_CONNECTIONS.GetLength(0);
        _boneObjects = new GameObject[connectionCount];
        _boneTransforms = new Transform[connectionCount];

        for (int i = 0; i < connectionCount; i++)
        {
            GameObject boneObj = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            boneObj.name = $"Bone_{i}";
            boneObj.transform.SetParent(transform);

            _boneTransforms[i] = boneObj.transform;
            Destroy(boneObj.GetComponent<Collider>());

            MeshRenderer meshRenderer = boneObj.GetComponent<MeshRenderer>();
            if (boneMaterial != null)
            {
                meshRenderer.material = boneMaterial;
            }

            meshRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            meshRenderer.receiveShadows = false;

            _boneObjects[i] = boneObj;
        }
    }

    #endregion

    #region Private Methods - Update Logic

    private void SyncNow()
    {
        lock (_currentTargetLock)
        {
            if (_currentTarget.handLandmarks == null || 
                _currentTarget.handLandmarks.Count == 0 ||
                _targetHandIndex >= _currentTarget.handLandmarks.Count)
            {
                HideHand();
                return;
            }

            ShowHand();
            ProcessHandData(_currentTarget, _targetHandIndex);
        }
    }

    private void ProcessHandData(HandLandmarkerResult handDataResult, int handIndex)
    {
        var landmarks = handDataResult.handLandmarks[handIndex].landmarks;

        if (!ValidateLandmarks(landmarks))
        {
            if (enableDebugLogs)
            {
                Debug.LogWarning($"HandTracker3D ({handType}): Invalid landmarks");
            }
            return;
        }

        UpdateHandPosition(landmarks);
        UpdateLandmarkPositions(landmarks);
        UpdateSkeletonBones();
    }

    private bool ValidateLandmarks(System.Collections.Generic.IReadOnlyList<Mediapipe.Tasks.Components.Containers.NormalizedLandmark> landmarks)
    {
        return landmarks != null && landmarks.Count >= 21;
    }

    #endregion

    #region Private Methods - Position Calculation

    private float CalculateHandSize(System.Collections.Generic.IReadOnlyList<Mediapipe.Tasks.Components.Containers.NormalizedLandmark> landmarks)
    {
        switch (handSizeMethod)
        {
            case HandSizeMethod.MediaPipeZAverage:
                float totalZ = 0f;
                foreach (int idx in STABLE_LANDMARKS)
                {
                    totalZ += Mathf.Abs(landmarks[idx].z);
                }
                return totalZ / STABLE_LANDMARKS.Length;

            case HandSizeMethod.PalmWidth:
                return Mathf.Abs(landmarks[INDEX_FINGER_BASE].x - landmarks[PINKY_FINGER_BASE].x);

            case HandSizeMethod.PalmMaxDimension:
                // Palm width in X
                float widthX = Mathf.Abs(landmarks[INDEX_FINGER_BASE].x - landmarks[PINKY_FINGER_BASE].x);
                
                // Palm width in Y (for rotated hand)
                float widthY = Mathf.Abs(landmarks[INDEX_FINGER_BASE].y - landmarks[PINKY_FINGER_BASE].y);

                // Palm height (wrist to middle finger base)
                Vector2 wrist2D = new Vector2(landmarks[WRIST].x, landmarks[WRIST].y);
                Vector2 middleBase2D = new Vector2(landmarks[MIDDLE_FINGER_BASE].x, landmarks[MIDDLE_FINGER_BASE].y);
                float palmHeight = Vector2.Distance(wrist2D, middleBase2D);

                // Normalize to 0-1 range based on typical values
                // These represent the range of palm sizes seen at different distances
                float normWidthX = Mathf.InverseLerp(0.03f, 0.12f, widthX);
                float normWidthY = Mathf.InverseLerp(0.01f, 0.15f, widthY);
                float normHeight = Mathf.InverseLerp(0.06f, 0.20f, palmHeight);

                // Take maximum (most reliable measurement)
                return Mathf.Max(normWidthX, normWidthY, normHeight);

            case HandSizeMethod.StableLandmarksOnly:
                float minX = float.MaxValue, maxX = float.MinValue;
                float minY = float.MaxValue, maxY = float.MinValue;

                foreach (int idx in STABLE_LANDMARKS)
                {
                    var lm = landmarks[idx];
                    minX = Mathf.Min(minX, lm.x);
                    maxX = Mathf.Max(maxX, lm.x);
                    minY = Mathf.Min(minY, lm.y);
                    maxY = Mathf.Max(maxY, lm.y);
                }

                float w = maxX - minX;
                float h = maxY - minY;
                return Mathf.Sqrt(w * w + h * h);

            default:
                return 0.5f;
        }
    }

    private float CalculateZPosition(float normalizedHandSize)
    {
        // Apply sensitivity
        float adjustedSize = Mathf.Pow(normalizedHandSize, 1f / zSensitivity);
        
        switch (zDepthMode)
        {
            case ZDepthMode.LargerPalmFurtherZ:
                // Hand close to camera = big palm = large Z = reaching further into scene
                // normalizedHandSize: 0 = small palm (far), 1 = big palm (close to camera)
                // Z output: nearZ when size=0, farZ when size=1
                return Mathf.Lerp(nearZ, farZ, adjustedSize);

            case ZDepthMode.LargerPalmCloserZ:
                // Hand close to camera = big palm = small Z = close in scene
                return Mathf.Lerp(farZ, nearZ, adjustedSize);

            case ZDepthMode.FixedDepth:
                return fixedZ;

            default:
                return nearZ;
        }
    }

    private void UpdateHandPosition(System.Collections.Generic.IReadOnlyList<Mediapipe.Tasks.Components.Containers.NormalizedLandmark> landmarks)
    {
        // Calculate hand center (average of all landmarks)
        float centerX = 0f;
        float centerY = 0f;
        foreach (var landmark in landmarks)
        {
            centerX += landmark.x;
            centerY += landmark.y;
        }
        centerX /= landmarks.Count;
        centerY /= landmarks.Count;

        // Calculate normalized hand size (0-1)
        float rawHandSize = CalculateHandSize(landmarks);
        
        // Smooth the hand size to reduce jitter
        _lastRawHandSize = Mathf.Lerp(rawHandSize, _lastRawHandSize, positionSmoothing);
        float smoothedHandSize = _lastRawHandSize;

        // Calculate Z based on mode
        float z = CalculateZPosition(smoothedHandSize);

        // Calculate X and Y
        float x = (centerX - 0.5f) * screenWidth * (mirrorX ? -1 : 1);
        float y = -(centerY - 0.5f) * screenHeight;

        // Build target position
        Vector3 targetPosition = new Vector3(x, y, z);

        // Apply position smoothing
        _smoothedPosition = Vector3.Lerp(targetPosition, _smoothedPosition, positionSmoothing);
        
        transform.localPosition = _smoothedPosition;

        // Store debug info
        _debugRawSize = rawHandSize;
        _debugNormSize = smoothedHandSize;
        _debugCalculatedZ = z;

        if (enableDebugLogs)
        {
            Debug.Log($"[{handType}] RawSize: {rawHandSize:F3}, SmoothedSize: {smoothedHandSize:F3}, " +
                      $"Z: {z:F2}, Pos: ({x:F2}, {y:F2}, {z:F2})");
        }
    }

    private void UpdateLandmarkPositions(System.Collections.Generic.IReadOnlyList<Mediapipe.Tasks.Components.Containers.NormalizedLandmark> landmarks)
    {
        // Calculate hand center for relative positioning
        float centerX = 0f;
        float centerY = 0f;
        foreach (var landmark in landmarks)
        {
            centerX += landmark.x;
            centerY += landmark.y;
        }
        centerX /= landmarks.Count;
        centerY /= landmarks.Count;

        for (int i = 0; i < landmarks.Count; i++)
        {
            if (i >= landmarkPrefabs.Length || landmarkPrefabs[i] == null)
                continue;

            var landmark = landmarks[i];

            // Position RELATIVE to hand center
            // The parent transform already handles the overall hand position
            float relX = (landmark.x - centerX) * screenWidth * (mirrorX ? -1 : 1);
            float relY = -(landmark.y - centerY) * screenHeight;
            
            // Z is the depth of the finger relative to palm
            // MediaPipe Z: negative = toward camera, positive = away
            float relZ = -landmark.z * landmarkDepthScale;

            landmarkPrefabs[i].transform.localPosition = new Vector3(relX, relY, relZ);
        }
    }

    private void UpdateSkeletonBones()
    {
        if (!enableSkeletonBones || _boneTransforms == null)
            return;

        int connectionCount = _boneTransforms.Length;
        for (int i = 0; i < connectionCount; i++)
        {
            int startIdx = HAND_CONNECTIONS[i, 0];
            int endIdx = HAND_CONNECTIONS[i, 1];

            if (startIdx >= landmarkPrefabs.Length || endIdx >= landmarkPrefabs.Length)
                continue;

            GameObject startLandmark = landmarkPrefabs[startIdx];
            GameObject endLandmark = landmarkPrefabs[endIdx];

            if (startLandmark == null || endLandmark == null)
                continue;

            Vector3 startPos = startLandmark.transform.localPosition;
            Vector3 endPos = endLandmark.transform.localPosition;

            Vector3 direction = endPos - startPos;
            float distance = direction.magnitude;

            if (distance < 0.001f)
                continue;

            Transform boneTransform = _boneTransforms[i];
            boneTransform.localPosition = (startPos + endPos) * 0.5f;
            boneTransform.localRotation = Quaternion.FromToRotation(Vector3.up, direction);
            boneTransform.localScale = new Vector3(boneThickness, distance * 0.5f, boneThickness);
        }
    }

    #endregion

    #region Private Methods - Visibility

    private void ShowHand()
    {
        if (!_landmarksVisible)
        {
            ToggleLandmarks(true);
            _landmarksVisible = true;
        }
    }

    private void HideHand()
    {
        if (_landmarksVisible)
        {
            ToggleLandmarks(false);
            _landmarksVisible = false;
        }
    }

    private void ToggleLandmarks(bool show)
    {
        foreach (var landmark in landmarkPrefabs)
        {
            if (landmark != null && landmark.activeSelf != show)
            {
                landmark.SetActive(show);
            }
        }

        if (enableSkeletonBones && _boneObjects != null)
        {
            foreach (var bone in _boneObjects)
            {
                if (bone != null && bone.activeSelf != show)
                {
                    bone.SetActive(show);
                }
            }
        }
    }

    #endregion
}
