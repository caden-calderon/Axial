using UnityEngine;

/// <summary>
/// Diagnostic script to debug grab issues.
/// Add this to the same GameObject as GrabController.
/// </summary>
public class GrabDiagnostics : MonoBehaviour
{
    [Header("References")]
    [SerializeField] private PinchDetector pinchDetector;
    [SerializeField] private GrabController grabController;

    [Header("Manual Test Settings")]
    [SerializeField] private float testGrabRadius = 2.0f;
    [SerializeField] private LayerMask testLayerMask = -1;

    [Header("Runtime Info (Read Only)")]
    [SerializeField] private bool isPinching;
    [SerializeField] private Vector3 pinchPointWorld;
    [SerializeField] private float pinchDistance;
    [SerializeField] private int collidersInRange;
    [SerializeField] private string[] collidersFound;
    [SerializeField] private string nearestGrabbable;

    [Header("Layer Debug")]
    [SerializeField] private int grabbableLayerIndex = -1;
    [SerializeField] private string grabbableLayerName = "Not Set";

    private void Start()
    {
        // Try to find references if not set
        if (pinchDetector == null)
            pinchDetector = GetComponent<PinchDetector>();
        if (grabController == null)
            grabController = GetComponent<GrabController>();

        // Check for Grabbable layer
        grabbableLayerIndex = LayerMask.NameToLayer("Grabbable");
        grabbableLayerName = grabbableLayerIndex >= 0 ? "Grabbable" : "NOT FOUND!";

        Debug.Log("=== GRAB DIAGNOSTICS STARTED ===");
        Debug.Log($"Grabbable Layer Index: {grabbableLayerIndex}");
        Debug.Log($"Test Layer Mask Value: {testLayerMask.value}");
        
        // List all game pieces in scene
        var pieces = FindObjectsByType<GamePiece>(FindObjectsSortMode.None);
        Debug.Log($"GamePiece objects in scene: {pieces.Length}");
        foreach (var piece in pieces)
        {
            Debug.Log($"  - {piece.name} | Layer: {piece.gameObject.layer} ({LayerMask.LayerToName(piece.gameObject.layer)}) | Has Collider: {piece.GetComponent<Collider>() != null} | Has GrabbableObject: {piece.GetComponent<GrabbableObject>() != null}");
        }

        // List all grabbable objects
        var grabbables = FindObjectsByType<GrabbableObject>(FindObjectsSortMode.None);
        Debug.Log($"GrabbableObject components in scene: {grabbables.Length}");
        foreach (var g in grabbables)
        {
            Debug.Log($"  - {g.name} | Layer: {g.gameObject.layer} ({LayerMask.LayerToName(g.gameObject.layer)}) | Position: {g.transform.position}");
        }
    }

    private void Update()
    {
        if (pinchDetector == null) return;

        isPinching = pinchDetector.IsPinching;
        pinchPointWorld = pinchDetector.PinchPoint;
        pinchDistance = pinchDetector.CurrentPinchDistance;

        // Always do overlap check for diagnostics
        PerformDiagnosticOverlap();

        // Log on pinch start
        if (isPinching && Input.GetKeyDown(KeyCode.Space))
        {
            LogDetailedDiagnostics();
        }
    }

    private void PerformDiagnosticOverlap()
    {
        // Test with ALL layers first
        Collider[] allColliders = Physics.OverlapSphere(pinchPointWorld, testGrabRadius);
        collidersInRange = allColliders.Length;

        collidersFound = new string[Mathf.Min(allColliders.Length, 10)];
        for (int i = 0; i < collidersFound.Length; i++)
        {
            var col = allColliders[i];
            string layerName = LayerMask.LayerToName(col.gameObject.layer);
            bool hasGrabbable = col.GetComponent<GrabbableObject>() != null;
            collidersFound[i] = $"{col.name} (Layer:{layerName}, Grabbable:{hasGrabbable})";
        }

        // Find nearest with GrabbableObject
        nearestGrabbable = "None";
        float nearestDist = float.MaxValue;
        foreach (var col in allColliders)
        {
            if (col.GetComponent<GrabbableObject>() != null)
            {
                float dist = Vector3.Distance(pinchPointWorld, col.transform.position);
                if (dist < nearestDist)
                {
                    nearestDist = dist;
                    nearestGrabbable = $"{col.name} @ {dist:F2}m";
                }
            }
        }
    }

    private void LogDetailedDiagnostics()
    {
        Debug.Log("=== GRAB DIAGNOSTICS (Press Space while pinching) ===");
        Debug.Log($"Pinch Point (World): {pinchPointWorld}");
        Debug.Log($"Is Pinching: {isPinching}");
        Debug.Log($"Pinch Distance: {pinchDistance}");
        Debug.Log($"Test Grab Radius: {testGrabRadius}");
        Debug.Log($"Colliders in range (ALL layers): {collidersInRange}");
        
        foreach (var c in collidersFound)
        {
            Debug.Log($"  Found: {c}");
        }

        Debug.Log($"Nearest Grabbable: {nearestGrabbable}");

        // Test with specific layer mask
        if (grabbableLayerIndex >= 0)
        {
            int layerMask = 1 << grabbableLayerIndex;
            Collider[] filtered = Physics.OverlapSphere(pinchPointWorld, testGrabRadius, layerMask);
            Debug.Log($"Colliders on Grabbable layer only: {filtered.Length}");
            foreach (var col in filtered)
            {
                Debug.Log($"  Grabbable layer: {col.name}");
            }
        }
    }

    private void OnDrawGizmos()
    {
        if (pinchDetector == null) return;

        Vector3 point = pinchDetector.PinchPoint;

        // Draw pinch point
        Gizmos.color = isPinching ? Color.green : Color.red;
        Gizmos.DrawWireSphere(point, 0.1f);

        // Draw grab radius
        Gizmos.color = Color.yellow;
        Gizmos.DrawWireSphere(point, testGrabRadius);

        // Draw lines to all colliders in range
        Collider[] nearby = Physics.OverlapSphere(point, testGrabRadius);
        foreach (var col in nearby)
        {
            bool hasGrabbable = col.GetComponent<GrabbableObject>() != null;
            Gizmos.color = hasGrabbable ? Color.green : Color.gray;
            Gizmos.DrawLine(point, col.transform.position);
        }
    }
}
