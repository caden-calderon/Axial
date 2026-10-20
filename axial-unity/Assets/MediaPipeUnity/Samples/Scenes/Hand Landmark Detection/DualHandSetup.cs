using UnityEngine;
using Mediapipe.Unity.Sample.HandLandmarkDetection;

/// <summary>
/// Helper script to set up dual hand tracking.
/// Add this to an empty GameObject and use the Setup button.
/// </summary>
public class DualHandSetup : MonoBehaviour
{
    [Header("References")]
    [SerializeField] private HandLandmarkerRunner handLandmarkerRunner;
    
    [Header("Created Objects (Read Only)")]
    [SerializeField] private DualHandManager dualHandManager;
    [SerializeField] private GameObject leftHandObject;
    [SerializeField] private GameObject rightHandObject;

    [Header("Prefab Settings")]
    [Tooltip("Prefab for individual landmarks (usually a small sphere)")]
    [SerializeField] private GameObject landmarkPrefab;
    [SerializeField] private Material leftHandMaterial;
    [SerializeField] private Material rightHandMaterial;
    [SerializeField] private Material boneMaterial;

    [Header("Hand Settings")]
    [SerializeField] private float screenWidth = 10f;
    [SerializeField] private float screenHeight = 10f;
    [SerializeField] private float zScaleMultiplier = 10f;

#if UNITY_EDITOR
    [ContextMenu("Setup Dual Hands")]
    public void SetupDualHands()
    {
        // Find HandLandmarkerRunner if not assigned
        if (handLandmarkerRunner == null)
        {
            handLandmarkerRunner = FindAnyObjectByType<HandLandmarkerRunner>();
        }

        if (handLandmarkerRunner == null)
        {
            Debug.LogError("DualHandSetup: Cannot find HandLandmarkerRunner!");
            return;
        }

        // Create parent container
        GameObject handContainer = new GameObject("DualHandTracking");
        handContainer.transform.SetParent(transform);

        // Add DualHandManager
        dualHandManager = handContainer.AddComponent<DualHandManager>();

        // Create Left Hand
        leftHandObject = CreateHandObject("LeftHand", HandTracker3D.HandType.Left, leftHandMaterial);
        leftHandObject.transform.SetParent(handContainer.transform);

        // Create Right Hand
        rightHandObject = CreateHandObject("RightHand", HandTracker3D.HandType.Right, rightHandMaterial);
        rightHandObject.transform.SetParent(handContainer.transform);

        // Connect to DualHandManager via SerializedObject
        UnityEditor.SerializedObject so = new UnityEditor.SerializedObject(dualHandManager);
        so.FindProperty("leftHandTracker").objectReferenceValue = leftHandObject.GetComponent<HandTracker3D>();
        so.FindProperty("rightHandTracker").objectReferenceValue = rightHandObject.GetComponent<HandTracker3D>();
        so.FindProperty("handLandmarkerRunner").objectReferenceValue = handLandmarkerRunner;
        so.ApplyModifiedProperties();

        Debug.Log("DualHandSetup: Dual hand tracking configured!");
        Debug.Log("Left Hand: " + leftHandObject.name);
        Debug.Log("Right Hand: " + rightHandObject.name);
        Debug.Log("Each hand has: HandTracker3D, PinchDetector, GrabController");
    }

    private GameObject CreateHandObject(string name, HandTracker3D.HandType handType, Material handMaterial)
    {
        GameObject handObj = new GameObject(name);

        // Add HandTracker3D
        HandTracker3D tracker = handObj.AddComponent<HandTracker3D>();
        
        // Configure via SerializedObject
        UnityEditor.SerializedObject trackerSO = new UnityEditor.SerializedObject(tracker);
        trackerSO.FindProperty("handType").enumValueIndex = (int)handType;
        trackerSO.FindProperty("screenWidth").floatValue = screenWidth;
        trackerSO.FindProperty("screenHeight").floatValue = screenHeight;
        trackerSO.FindProperty("zScaleMultiplier").floatValue = zScaleMultiplier;
        
        if (boneMaterial != null)
        {
            trackerSO.FindProperty("boneMaterial").objectReferenceValue = boneMaterial;
        }

        // Setup landmark prefabs array
        UnityEditor.SerializedProperty landmarkArray = trackerSO.FindProperty("landmarkPrefabs");
        if (landmarkPrefab != null)
        {
            for (int i = 0; i < 21; i++)
            {
                landmarkArray.GetArrayElementAtIndex(i).objectReferenceValue = landmarkPrefab;
            }
        }

        trackerSO.ApplyModifiedProperties();

        // Add PinchDetector
        handObj.AddComponent<PinchDetector>();

        // Add GrabController
        GrabController grabController = handObj.AddComponent<GrabController>();
        
        // Configure GrabController layer mask
        UnityEditor.SerializedObject grabSO = new UnityEditor.SerializedObject(grabController);
        int grabbableLayer = LayerMask.NameToLayer("Grabbable");
        if (grabbableLayer >= 0)
        {
            grabSO.FindProperty("grabbableLayer").intValue = 1 << grabbableLayer;
        }
        grabSO.ApplyModifiedProperties();

        return handObj;
    }

    [ContextMenu("Validate Setup")]
    public void ValidateSetup()
    {
        Debug.Log("=== Dual Hand Setup Validation ===");

        // Check HandLandmarkerRunner
        var runner = FindAnyObjectByType<HandLandmarkerRunner>();
        if (runner != null)
        {
            Debug.Log("✓ HandLandmarkerRunner found");
            
            // Check if numHands is at least 2
            // (Can't easily check this without reflection, just warn)
            Debug.Log("  → Make sure numHands is set to 2 in HandLandmarkDetectionConfig");
        }
        else
        {
            Debug.LogError("✗ HandLandmarkerRunner NOT found!");
        }

        // Check DualHandManager
        var manager = FindAnyObjectByType<DualHandManager>();
        if (manager != null)
        {
            Debug.Log("✓ DualHandManager found");
        }
        else
        {
            Debug.LogWarning("✗ DualHandManager not found - run Setup Dual Hands");
        }

        // Check HandTracker3D instances
        var trackers = FindObjectsByType<HandTracker3D>(FindObjectsSortMode.None);
        Debug.Log($"  Found {trackers.Length} HandTracker3D instances");
        foreach (var t in trackers)
        {
            Debug.Log($"    - {t.name}: {t.ConfiguredHandType}");
        }

        // Check PinchDetectors
        var pinchers = FindObjectsByType<PinchDetector>(FindObjectsSortMode.None);
        Debug.Log($"  Found {pinchers.Length} PinchDetector instances");

        // Check GrabControllers
        var grabbers = FindObjectsByType<GrabController>(FindObjectsSortMode.None);
        Debug.Log($"  Found {grabbers.Length} GrabController instances");

        // Check layers
        int grabbableLayer = LayerMask.NameToLayer("Grabbable");
        int handLandmarksLayer = LayerMask.NameToLayer("HandLandmarks");

        if (grabbableLayer >= 0)
            Debug.Log("✓ 'Grabbable' layer exists");
        else
            Debug.LogWarning("✗ 'Grabbable' layer not found - create it!");

        if (handLandmarksLayer >= 0)
            Debug.Log("✓ 'HandLandmarks' layer exists");
        else
            Debug.LogWarning("✗ 'HandLandmarks' layer not found - create it!");

        Debug.Log("=== Validation Complete ===");
    }
#endif
}
