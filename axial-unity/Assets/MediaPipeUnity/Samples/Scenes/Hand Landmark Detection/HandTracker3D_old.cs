using UnityEngine;
using Mediapipe.Tasks.Vision.HandLandmarker;

public class HandTracker3D_old : MonoBehaviour
{
    #region Enums

    public enum HandSizeMethod
    {
        MediaPipeZAverage,     // Average of MediaPipe's Z values from stable points
        AverageMultiplePairs,  // Average of multiple landmark pairs (affected by gestures)
        PalmWidth,             // Just the X distance between index and pinky base (affected by rotation)
        PalmMaxDimension,      // Max of palm width OR height (rotation resistant!)
        StableLandmarksOnly    // Only wrist and finger bases (ignores finger movements)
    }

    #endregion

    #region Constants

    // Landmark indices for hand distance calculation
    private const int WRIST = 0;
    private const int INDEX_FINGER_BASE = 5;
    private const int MIDDLE_FINGER_BASE = 9;
    private const int MIDDLE_FINGER_TIP = 12;
    private const int PINKY_FINGER_BASE = 17;

    // Stable landmarks (not affected by finger movements)
    private static readonly int[] STABLE_LANDMARKS = { 0, 5, 9, 13, 17 }; // Wrist and finger bases

    // Hand bone connections (pairs of landmark indices to connect)
    private static readonly int[,] HAND_CONNECTIONS = new int[,]
    {
        // Wrist to finger bases
        {0, 1},   // Wrist to thumb base
        {0, 5},   // Wrist to index base
        {0, 9},   // Wrist to middle base
        {0, 13},  // Wrist to ring base
        {0, 17},  // Wrist to pinky base

        // Thumb chain
        {1, 2}, {2, 3}, {3, 4},

        // Index finger chain
        {5, 6}, {6, 7}, {7, 8},

        // Middle finger chain
        {9, 10}, {10, 11}, {11, 12},

        // Ring finger chain
        {13, 14}, {14, 15}, {15, 16},

        // Pinky finger chain
        {17, 18}, {18, 19}, {19, 20}
    };

    #endregion

    #region Serialized Fields

    [Header("Landmark Prefabs")]
    [SerializeField] private GameObject[] landmarkPrefabs = new GameObject[21];

    [Header("Hand Skeleton Bones")]
    [SerializeField] private bool enableSkeletonBones = true;
    [SerializeField] private Material boneMaterial;
    [SerializeField] private float boneThickness = 0.05f;

    [Header("Screen Mapping")]
    [SerializeField] private float screenWidth = 10.0f;
    [SerializeField] private float screenHeight = 10.0f;
    [SerializeField] private float depthScale = 5.0f;

    [Header("Camera Distance Settings")]
    [SerializeField] private HandSizeMethod handSizeMethod = HandSizeMethod.PalmMaxDimension;
    [SerializeField] private float zScaleMultiplier = 10.0f; // Scale factor for raw values (adjust based on method)
    [SerializeField] private float minZ = 2.0f; // Minimum Z (hand far away)
    [SerializeField] private float maxZ = 50.0f; // Maximum Z (hand close)

    [Header("Mirroring")]
    [SerializeField] private bool mirrorX = true;
    [SerializeField] private bool mirrorZ = false; // When true: closer hand = smaller Z, further = larger Z

    [Header("Debug")]
    [SerializeField] private bool enableDebugLogs = true;

    #endregion

    #region Private Fields

    // Thread-safe result caching
    private readonly object _currentTargetLock = new();
    private HandLandmarkerResult _currentTarget;
    private bool _isResultReady = false;

    // State
    private bool _landmarksVisible = false;

    // Skeleton bones (cached for performance)
    private GameObject[] _boneObjects;
    private Transform[] _boneTransforms;

    #endregion

    #region Unity Lifecycle Methods

    private void Start()
    {
        InitializeLandmarkPrefabs();
        InitializeSkeletonBones();
        ToggleLandmarks(false);

        // Reset to origin on start (debugging floating issue)
        transform.localPosition = Vector3.zero;

        if (enableDebugLogs)
        {
            Debug.Log($"HandTracker3D Start - Initial position reset to {transform.localPosition}");
        }
    }

    private void Update()
    {
        // Deferred update pattern - process results on main thread
        if (_isResultReady)
        {
            SyncNow();
            _isResultReady = false;
        }
    }

    #endregion

    #region Public API

    /// <summary>
    /// Receives hand data from HandLandmarkerRunner. Thread-safe.
    /// </summary>
    public void OnHandDataReceived(HandLandmarkerResult handDataResult)
    {
        lock (_currentTargetLock)
        {
            // Clone result to avoid race conditions
            handDataResult.CloneTo(ref _currentTarget);
            _isResultReady = true;
        }
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

                // Set to HandLandmarks layer (prevents grabbing but allows collision)
                landmarkPrefabs[i].layer = LayerMask.NameToLayer("HandLandmarks");

                // Ensure collider exists for physics interaction
                Collider col = landmarkPrefabs[i].GetComponent<Collider>();
                if (col == null)
                {
                    // Add sphere collider if missing
                    col = landmarkPrefabs[i].AddComponent<SphereCollider>();
                }

                // Add kinematic rigidbody so landmarks can push objects but aren't affected by physics
                Rigidbody rb = landmarkPrefabs[i].GetComponent<Rigidbody>();
                if (rb == null)
                {
                    rb = landmarkPrefabs[i].AddComponent<Rigidbody>();
                }
                rb.isKinematic = true;  // Kinematic = moves via transform, not physics
                rb.useGravity = false;
            }
        }
    }

    private void InitializeSkeletonBones()
    {
        if (!enableSkeletonBones)
        {
            return;
        }

        // Calculate number of connections
        int connectionCount = HAND_CONNECTIONS.GetLength(0);
        _boneObjects = new GameObject[connectionCount];
        _boneTransforms = new Transform[connectionCount];

        // Create a cylinder GameObject for each bone connection
        for (int i = 0; i < connectionCount; i++)
        {
            GameObject boneObj = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            boneObj.name = $"Bone_{i}";
            boneObj.transform.SetParent(transform);

            // Cache transform for performance
            _boneTransforms[i] = boneObj.transform;

            // Remove the collider - we don't need physics
            Destroy(boneObj.GetComponent<Collider>());

            // Get mesh renderer once
            MeshRenderer meshRenderer = boneObj.GetComponent<MeshRenderer>();

            // Apply material if provided
            if (boneMaterial != null)
            {
                meshRenderer.material = boneMaterial;
            }

            // Disable shadows and lighting for performance
            meshRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            meshRenderer.receiveShadows = false;

            _boneObjects[i] = boneObj;
        }
    }

    #endregion

    #region Private Methods - Update Logic

    /// <summary>
    /// Synchronizes the visual representation with the cached hand data.
    /// Must be called on the main thread.
    /// </summary>
    private void SyncNow()
    {
        lock (_currentTargetLock)
        {
            // Check if we have valid hand data
            if (_currentTarget.handLandmarks == null || _currentTarget.handLandmarks.Count == 0)
            {
                HideHand();
                return;
            }

            ShowHand();
            ProcessHandData(_currentTarget);
        }
    }

    private void ProcessHandData(HandLandmarkerResult handDataResult)
    {
        var normalizedLandmarks = handDataResult.handLandmarks[0].landmarks;

        // Validate landmarks before processing
        if (!ValidateLandmarks(normalizedLandmarks))
        {
            if (enableDebugLogs)
            {
                Debug.LogWarning("Invalid landmarks detected - skipping frame");
            }
            return;
        }

        // Update hand position (X, Y, Z) based on hand size and center
        UpdateHandPosition(normalizedLandmarks);

        // Update individual landmark positions
        UpdateLandmarkPositions(normalizedLandmarks);

        // Update skeleton bones connecting landmarks
        UpdateSkeletonBones();
    }

    private bool ValidateLandmarks(System.Collections.Generic.IReadOnlyList<Mediapipe.Tasks.Components.Containers.NormalizedLandmark> landmarks)
    {
        // Check if we have enough landmarks
        if (landmarks == null || landmarks.Count < 21)
        {
            return false;
        }

        // Validate critical landmarks for distance calculation exist based on method
        switch (handSizeMethod)
        {
            case HandSizeMethod.PalmWidth:
                return INDEX_FINGER_BASE < landmarks.Count && PINKY_FINGER_BASE < landmarks.Count;
            case HandSizeMethod.PalmMaxDimension:
                return WRIST < landmarks.Count && INDEX_FINGER_BASE < landmarks.Count &&
                       MIDDLE_FINGER_BASE < landmarks.Count && PINKY_FINGER_BASE < landmarks.Count;
            case HandSizeMethod.AverageMultiplePairs:
                return WRIST < landmarks.Count && INDEX_FINGER_BASE < landmarks.Count &&
                       MIDDLE_FINGER_TIP < landmarks.Count && PINKY_FINGER_BASE < landmarks.Count;
            case HandSizeMethod.StableLandmarksOnly:
            case HandSizeMethod.MediaPipeZAverage:
                // Verify all stable landmarks exist
                foreach (int idx in STABLE_LANDMARKS)
                {
                    if (idx >= landmarks.Count)
                    {
                        return false;
                    }
                }
                return true;
            default:
                return false;
        }
    }

    private float CalculateHandSize(System.Collections.Generic.IReadOnlyList<Mediapipe.Tasks.Components.Containers.NormalizedLandmark> landmarks)
    {
        switch (handSizeMethod)
        {
            case HandSizeMethod.MediaPipeZAverage:
                // Use MediaPipe's native Z values (depth estimation)
                // Average Z from stable landmarks only
                float zSum = 0f;
                string zDebug = "Individual Z values: ";
                float z = 0f;
                foreach (int idx in STABLE_LANDMARKS)
                {
                    z = landmarks[idx].z;
                    zSum += z;
                    zDebug += $"[{idx}]={z:F4} ";
                }
                float avgZ = zSum / STABLE_LANDMARKS.Length;

                if (enableDebugLogs)
                {
                    Debug.Log($"{zDebug} | RawZ={z:F4} | Avg={avgZ:F4} | Negated={-avgZ:F4}");
                }

                // Return negative because larger Z = further from camera in MediaPipe
                // We want larger value = closer to camera
                return -avgZ;

            case HandSizeMethod.AverageMultiplePairs:
                // Average multiple measurements for more stability
                float dist1 = Vector3.Distance(
                    new Vector3(landmarks[INDEX_FINGER_BASE].x, landmarks[INDEX_FINGER_BASE].y, landmarks[INDEX_FINGER_BASE].z),
                    new Vector3(landmarks[PINKY_FINGER_BASE].x, landmarks[PINKY_FINGER_BASE].y, landmarks[PINKY_FINGER_BASE].z)
                );
                float dist2 = Vector3.Distance(
                    new Vector3(landmarks[WRIST].x, landmarks[WRIST].y, landmarks[WRIST].z),
                    new Vector3(landmarks[MIDDLE_FINGER_TIP].x, landmarks[MIDDLE_FINGER_TIP].y, landmarks[MIDDLE_FINGER_TIP].z)
                );
                return (dist1 + dist2) / 2.0f;

            case HandSizeMethod.PalmWidth:
                // Only use X distance (2D width) - ignores depth and vertical position
                return Mathf.Abs(landmarks[INDEX_FINGER_BASE].x - landmarks[PINKY_FINGER_BASE].x);

            case HandSizeMethod.PalmMaxDimension:
                // Use NORMALIZED MAX of THREE measurements to handle all rotations:
                // 1. Palm width X-only: for normal/bent wrist (ignores vertical screen shift)
                // 2. Palm width Y-only: for waving (when X collapses, Y grows)
                // 3. Palm height 2D: vertical distance (stable for most rotations)
                //
                // Normalize each to 0-1 range first, so they compete fairly

                // Palm width components
                float palmWidthX = Mathf.Abs(landmarks[INDEX_FINGER_BASE].x - landmarks[PINKY_FINGER_BASE].x);
                float palmWidthY = Mathf.Abs(landmarks[INDEX_FINGER_BASE].y - landmarks[PINKY_FINGER_BASE].y);

                // Palm height: 2D distance from wrist to middle finger base
                Vector2 wrist2D = new Vector2(landmarks[WRIST].x, landmarks[WRIST].y);
                Vector2 middleBase2D = new Vector2(landmarks[MIDDLE_FINGER_BASE].x, landmarks[MIDDLE_FINGER_BASE].y);
                float palmHeight2D = Vector2.Distance(wrist2D, middleBase2D);

                // Calibrated ranges - centered on neutral position for rotation stability
                // Neutral values: widthX=0.0585, height=0.1241
                float widthXMin = 0.03f, widthXMax = 0.09f;   // Center: 0.06, neutral 0.0585 → norm 0.48
                float widthYMin = 0.01f, widthYMax = 0.12f;   // For waving
                float heightMin = 0.09f, heightMax = 0.16f;   // Center: 0.125, neutral 0.1241 → norm 0.49

                // Normalize each to 0-1 range
                float normWidthX = Mathf.InverseLerp(widthXMin, widthXMax, palmWidthX);
                float normWidthY = Mathf.InverseLerp(widthYMin, widthYMax, palmWidthY);
                float normHeight = Mathf.InverseLerp(heightMin, heightMax, palmHeight2D);

                // Take max of normalized values - now they compete fairly!
                float maxNormalized = Mathf.Max(normWidthX, normWidthY, normHeight);

                // Return normalized value (0-1) - will be scaled by zScaleMultiplier later
                // This allows full Z range instead of being stuck at 3-9

                if (enableDebugLogs)
                {
                    Debug.Log($"PalmWidthX: {palmWidthX:F4} (norm: {normWidthX:F2}), " +
                              $"PalmWidthY: {palmWidthY:F4} (norm: {normWidthY:F2}), " +
                              $"PalmHeight2D: {palmHeight2D:F4} (norm: {normHeight:F2}), " +
                              $"MaxNorm: {maxNormalized:F2}");
                }

                return maxNormalized;

            case HandSizeMethod.StableLandmarksOnly:
                // Use only stable landmarks (wrist and finger bases)
                // Calculate bounding box of these points only
                float minXStable = float.MaxValue, maxXStable = float.MinValue;
                float minYStable = float.MaxValue, maxYStable = float.MinValue;

                foreach (int idx in STABLE_LANDMARKS)
                {
                    var landmark = landmarks[idx];
                    if (landmark.x < minXStable) minXStable = landmark.x;
                    if (landmark.x > maxXStable) maxXStable = landmark.x;
                    if (landmark.y < minYStable) minYStable = landmark.y;
                    if (landmark.y > maxYStable) maxYStable = landmark.y;
                }

                float widthStable = maxXStable - minXStable;
                float heightStable = maxYStable - minYStable;
                return Mathf.Sqrt(widthStable * widthStable + heightStable * heightStable);

            default:
                return 0f;
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

        // Calculate raw hand size/distance metric
        float rawHandSize = CalculateHandSize(landmarks);

        // Scale the raw value to usable Unity space
        float scaledZ = rawHandSize * zScaleMultiplier;

        // Apply mirror: invert Z direction if needed
        if (mirrorZ)
        {
            scaledZ = -scaledZ;
        }

        // Clamp to safe bounds (prevent hand from going too close/far)
        float z = Mathf.Clamp(scaledZ, minZ, maxZ);

        // Calculate X and Y positions from hand center (camera handles perspective)
        float x = (centerX - 0.5f) * screenWidth * (mirrorX ? -1 : 1);
        float y = -(centerY - 0.5f) * screenHeight;

        // Debug logging
        if (enableDebugLogs)
        {
            Debug.Log($"Method: {handSizeMethod}, RawHandSize: {rawHandSize:F4}, " +
                      $"Scaled: {scaledZ:F2}, Clamped Z: {z:F2}, " +
                      $"Pos: ({x:F2}, {y:F2}, {z:F2})");
        }

        // Move parent GameObject to represent hand position (NO SMOOTHING)
        transform.localPosition = new Vector3(x, y, z);
    }

    private void UpdateLandmarkPositions(System.Collections.Generic.IReadOnlyList<Mediapipe.Tasks.Components.Containers.NormalizedLandmark> landmarks)
    {
        // Position individual landmarks relative to parent (hand structure)
        // Camera handles perspective automatically based on parent Z position
        for (int i = 0; i < landmarks.Count; i++)
        {
            if (i >= landmarkPrefabs.Length || landmarkPrefabs[i] == null)
            {
                continue;
            }

            var landmark = landmarks[i];

            // Note: These are RELATIVE to parent position (which is already at hand center)
            float x = (landmark.x - 0.5f) * screenWidth * 2 * (mirrorX ? -1 : 1);
            float y = -(landmark.y - 0.5f) * screenHeight * 2;
            float z = landmark.z * depthScale * (mirrorZ ? -1 : 1);

            landmarkPrefabs[i].transform.localPosition = new Vector3(x, y, z);
        }
    }

    private void UpdateSkeletonBones()
    {
        if (!enableSkeletonBones || _boneTransforms == null)
        {
            return;
        }

        // Update each bone cylinder to stretch between its two landmarks
        int connectionCount = _boneTransforms.Length;
        for (int i = 0; i < connectionCount; i++)
        {
            int startIdx = HAND_CONNECTIONS[i, 0];
            int endIdx = HAND_CONNECTIONS[i, 1];

            // Validate landmark indices
            if (startIdx >= landmarkPrefabs.Length || endIdx >= landmarkPrefabs.Length)
            {
                continue;
            }

            GameObject startLandmark = landmarkPrefabs[startIdx];
            GameObject endLandmark = landmarkPrefabs[endIdx];

            // Check if both landmark prefabs exist
            if (startLandmark == null || endLandmark == null)
            {
                continue;
            }

            // Get positions from landmark prefabs (local positions)
            Vector3 startPos = startLandmark.transform.localPosition;
            Vector3 endPos = endLandmark.transform.localPosition;

            // Calculate direction and distance
            Vector3 direction = endPos - startPos;
            float distance = direction.magnitude;

            // Skip zero-length bones
            if (distance < 0.001f)
            {
                continue;
            }

            // Use cached transform reference
            Transform boneTransform = _boneTransforms[i];

            // Position bone at midpoint
            boneTransform.localPosition = (startPos + endPos) * 0.5f;

            // Rotate bone to point along the connection
            // Unity cylinder's default orientation is along Y-axis
            boneTransform.localRotation = Quaternion.FromToRotation(Vector3.up, direction);

            // Scale bone: keep thickness on X/Z, stretch length on Y (half distance because cylinder height is 2)
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

        // Also toggle skeleton bones
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