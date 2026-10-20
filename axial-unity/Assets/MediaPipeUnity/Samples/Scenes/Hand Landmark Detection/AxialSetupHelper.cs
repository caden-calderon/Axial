using UnityEngine;

#if UNITY_EDITOR
using UnityEditor;
#endif

/// <summary>
/// Utility script to help set up the Axial game.
/// Add this to an empty GameObject and click the buttons in the Inspector.
/// </summary>
public class AxialSetupHelper : MonoBehaviour
{
    [Header("Layer Names")]
    public string grabbableLayerName = "Grabbable";
    public string handLandmarksLayerName = "HandLandmarks";
    public string gridLayerName = "Grid";

    [Header("References (Auto-filled)")]
    public GridManager gridManager;
    public BoardGenerator boardGenerator;
    public PieceSpawner pieceSpawner;
    public GrabController grabController;

    [Header("Piece Prefab Setup")]
    public GameObject piecePrefab;
    public float pieceRadius = 0.6f;

    private void Reset()
    {
        // Try to find components in scene
        FindReferences();
    }

    public void FindReferences()
    {
        gridManager = FindAnyObjectByType<GridManager>();
        boardGenerator = FindAnyObjectByType<BoardGenerator>();
        pieceSpawner = FindAnyObjectByType<PieceSpawner>();
        grabController = FindAnyObjectByType<GrabController>();
    }

    public void CreatePiecePrefab()
    {
        // Create a basic sphere piece prefab
        GameObject piece = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        piece.name = "GamePiece";
        piece.transform.localScale = Vector3.one * pieceRadius * 2;

        // Add required components
        piece.AddComponent<GrabbableObject>();
        piece.AddComponent<GamePiece>();

        // Set layer
        int layer = LayerMask.NameToLayer(grabbableLayerName);
        if (layer >= 0)
        {
            piece.layer = layer;
        }

        // Configure collider
        SphereCollider col = piece.GetComponent<SphereCollider>();
        if (col != null)
        {
            col.isTrigger = false;
        }

        // Add rigidbody for physics
        Rigidbody rb = piece.AddComponent<Rigidbody>();
        rb.isKinematic = true;
        rb.useGravity = false;

        piecePrefab = piece;

        Debug.Log("Created GamePiece prefab. Save it to your project as a prefab!");

#if UNITY_EDITOR
        // Select the new object
        Selection.activeGameObject = piece;
#endif
    }

    public void SetupGrabControllerLayer()
    {
        if (grabController == null)
        {
            Debug.LogError("GrabController not found!");
            return;
        }

        int layer = LayerMask.NameToLayer(grabbableLayerName);
        if (layer < 0)
        {
            Debug.LogError($"Layer '{grabbableLayerName}' not found! Please create it in Edit > Project Settings > Tags and Layers");
            return;
        }

        // Use SerializedObject to modify the private field
#if UNITY_EDITOR
        SerializedObject so = new SerializedObject(grabController);
        SerializedProperty layerProp = so.FindProperty("grabbableLayer");
        if (layerProp != null)
        {
            layerProp.intValue = 1 << layer;
            so.ApplyModifiedProperties();
            Debug.Log($"Set GrabController grabbableLayer to '{grabbableLayerName}'");
        }
#endif
    }

    public void ValidateSetup()
    {
        FindReferences();

        bool allGood = true;

        // Check layers exist
        string[] requiredLayers = { grabbableLayerName, handLandmarksLayerName, gridLayerName };
        foreach (string layerName in requiredLayers)
        {
            int layer = LayerMask.NameToLayer(layerName);
            if (layer < 0)
            {
                Debug.LogWarning($"Layer '{layerName}' not found. Create it in Edit > Project Settings > Tags and Layers");
                allGood = false;
            }
            else
            {
                Debug.Log($"✓ Layer '{layerName}' exists (index {layer})");
            }
        }

        // Check components
        if (gridManager == null)
        {
            Debug.LogWarning("GridManager not found in scene!");
            allGood = false;
        }
        else
        {
            Debug.Log("✓ GridManager found");
        }

        if (boardGenerator == null)
        {
            Debug.LogWarning("BoardGenerator not found in scene!");
            allGood = false;
        }
        else
        {
            Debug.Log("✓ BoardGenerator found");

            // Check spacing matches
            if (gridManager != null && boardGenerator.spacing != gridManager.cellSpacing)
            {
                Debug.LogWarning($"Spacing mismatch! BoardGenerator: {boardGenerator.spacing}, GridManager: {gridManager.cellSpacing}");
                allGood = false;
            }
        }

        if (pieceSpawner == null)
        {
            Debug.LogWarning("PieceSpawner not found in scene! Add one to spawn pieces.");
            allGood = false;
        }
        else
        {
            Debug.Log("✓ PieceSpawner found");
        }

        if (grabController == null)
        {
            Debug.LogWarning("GrabController not found in scene!");
            allGood = false;
        }
        else
        {
            Debug.Log("✓ GrabController found");
        }

        if (allGood)
        {
            Debug.Log("=== All setup checks passed! ===");
        }
        else
        {
            Debug.LogWarning("=== Some setup issues found. See warnings above. ===");
        }
    }
}

#if UNITY_EDITOR
[CustomEditor(typeof(AxialSetupHelper))]
public class AxialSetupHelperEditor : Editor
{
    public override void OnInspectorGUI()
    {
        DrawDefaultInspector();

        AxialSetupHelper helper = (AxialSetupHelper)target;

        EditorGUILayout.Space(10);
        EditorGUILayout.LabelField("Setup Actions", EditorStyles.boldLabel);

        if (GUILayout.Button("Find References"))
        {
            helper.FindReferences();
        }

        if (GUILayout.Button("Validate Setup"))
        {
            helper.ValidateSetup();
        }

        EditorGUILayout.Space(5);

        if (GUILayout.Button("Create Piece Prefab"))
        {
            helper.CreatePiecePrefab();
        }

        if (GUILayout.Button("Setup GrabController Layer"))
        {
            helper.SetupGrabControllerLayer();
        }

        EditorGUILayout.Space(10);
        EditorGUILayout.HelpBox(
            "Required Layers:\n" +
            "• Grabbable - for game pieces\n" +
            "• HandLandmarks - for hand tracking points\n" +
            "• Grid - for column colliders (optional)\n\n" +
            "Create these in Edit > Project Settings > Tags and Layers",
            MessageType.Info
        );
    }
}
#endif
