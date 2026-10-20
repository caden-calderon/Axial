using UnityEngine;
using Mediapipe.Tasks.Vision.HandLandmarker;
using Mediapipe.Unity.Sample.HandLandmarkDetection;

/// <summary>
/// Manages dual hand tracking by routing MediaPipe hand data to separate left/right hand trackers.
/// Connect this to HandLandmarkerRunner's OnHandLandmarksResultOutput event.
/// </summary>
public class DualHandManager : MonoBehaviour
{
    #region Enums

    public enum Handedness
    {
        Left,
        Right
    }

    #endregion

    #region Serialized Fields

    [Header("Hand Trackers")]
    [Tooltip("Tracker for the left hand")]
    [SerializeField] private HandTracker3D leftHandTracker;
    
    [Tooltip("Tracker for the right hand")]
    [SerializeField] private HandTracker3D rightHandTracker;

    [Header("Source")]
    [Tooltip("The HandLandmarkerRunner that provides hand data")]
    [SerializeField] private HandLandmarkerRunner handLandmarkerRunner;

    [Header("Settings")]
    [Tooltip("Minimum confidence to accept handedness classification")]
    [SerializeField] [Range(0f, 1f)] private float handednessConfidenceThreshold = 0.5f;

    [Header("Debug")]
    [SerializeField] private bool enableDebugLogs = false;

    #endregion

    #region Private Fields

    private bool _leftHandVisible = false;
    private bool _rightHandVisible = false;

    #endregion

    #region Public Properties

    public bool IsLeftHandVisible => _leftHandVisible;
    public bool IsRightHandVisible => _rightHandVisible;
    public int VisibleHandCount => (_leftHandVisible ? 1 : 0) + (_rightHandVisible ? 1 : 0);

    #endregion

    #region Unity Lifecycle

    private void Start()
    {
        // Auto-find HandLandmarkerRunner if not assigned
        if (handLandmarkerRunner == null)
        {
            handLandmarkerRunner = FindAnyObjectByType<HandLandmarkerRunner>();
        }

        if (handLandmarkerRunner == null)
        {
            Debug.LogError("DualHandManager: No HandLandmarkerRunner found!");
            enabled = false;
            return;
        }

        // Subscribe to hand data events
        handLandmarkerRunner.OnHandLandmarksResultOutput.AddListener(OnHandDataReceived);

        // Validate trackers
        if (leftHandTracker == null)
        {
            Debug.LogWarning("DualHandManager: Left hand tracker not assigned");
        }
        if (rightHandTracker == null)
        {
            Debug.LogWarning("DualHandManager: Right hand tracker not assigned");
        }

        if (enableDebugLogs)
        {
            Debug.Log("DualHandManager initialized");
        }
    }

    private void OnDestroy()
    {
        if (handLandmarkerRunner != null)
        {
            handLandmarkerRunner.OnHandLandmarksResultOutput.RemoveListener(OnHandDataReceived);
        }
    }

    #endregion

    #region Hand Data Processing

    /// <summary>
    /// Called when new hand data is received from MediaPipe
    /// </summary>
    private void OnHandDataReceived(HandLandmarkerResult result)
    {
        // Reset visibility flags
        bool leftFound = false;
        bool rightFound = false;

        // Check if we have valid hand data
        if (result.handLandmarks == null || result.handLandmarks.Count == 0)
        {
            // No hands detected - hide both
            HideHand(leftHandTracker);
            HideHand(rightHandTracker);
            _leftHandVisible = false;
            _rightHandVisible = false;
            return;
        }

        // Process each detected hand
        int handCount = result.handLandmarks.Count;
        
        for (int i = 0; i < handCount; i++)
        {
            // Get handedness for this hand
            Handedness handedness = DetermineHandedness(result, i);

            if (enableDebugLogs)
            {
                Debug.Log($"DualHandManager: Hand {i} detected as {handedness}");
            }

            // Route to appropriate tracker
            if (handedness == Handedness.Left && leftHandTracker != null)
            {
                leftHandTracker.OnHandDataReceivedWithIndex(result, i);
                leftFound = true;
            }
            else if (handedness == Handedness.Right && rightHandTracker != null)
            {
                rightHandTracker.OnHandDataReceivedWithIndex(result, i);
                rightFound = true;
            }
        }

        // Hide hands that weren't found
        if (!leftFound && leftHandTracker != null)
        {
            HideHand(leftHandTracker);
        }
        if (!rightFound && rightHandTracker != null)
        {
            HideHand(rightHandTracker);
        }

        _leftHandVisible = leftFound;
        _rightHandVisible = rightFound;
    }

    /// <summary>
    /// Determine if a hand is left or right based on MediaPipe handedness classification
    /// </summary>
    private Handedness DetermineHandedness(HandLandmarkerResult result, int handIndex)
    {
        // Check if handedness data exists
        if (result.handedness == null || result.handedness.Count <= handIndex)
        {
            // Default to right if no handedness data
            return Handedness.Right;
        }

        var handednessCategories = result.handedness[handIndex].categories;
        
        if (handednessCategories == null || handednessCategories.Count == 0)
        {
            return Handedness.Right;
        }

        // Get the first (most confident) classification
        var classification = handednessCategories[0];
        
        // Check confidence threshold
        if (classification.score < handednessConfidenceThreshold)
        {
            if (enableDebugLogs)
            {
                Debug.Log($"DualHandManager: Low confidence ({classification.score:F2}), defaulting to Right");
            }
            return Handedness.Right;
        }

        // MediaPipe returns "Left" or "Right" as category name
        // NOTE: MediaPipe's handedness is from the camera's perspective, which is mirrored
        // So "Left" in MediaPipe = user's RIGHT hand, and vice versa
        string categoryName = classification.categoryName.ToLower();
        
        if (categoryName.Contains("left"))
        {
            // MediaPipe "Left" = user's Right hand (mirrored)
            return Handedness.Right;
        }
        else if (categoryName.Contains("right"))
        {
            // MediaPipe "Right" = user's Left hand (mirrored)
            return Handedness.Left;
        }

        return Handedness.Right;
    }

    /// <summary>
    /// Hide a hand tracker
    /// </summary>
    private void HideHand(HandTracker3D tracker)
    {
        if (tracker != null)
        {
            tracker.HideHandExternal();
        }
    }

    #endregion
}
