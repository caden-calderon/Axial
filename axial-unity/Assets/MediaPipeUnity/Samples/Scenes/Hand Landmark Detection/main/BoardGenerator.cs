using UnityEngine;

public class BoardGenerator : MonoBehaviour
{
    [Header("Board Dimensions")]
    public int columnsX = 7;
    public int rowsY = 6;
    public int depthZ = 6;

    [Header("Settings")]
    public float spacing = 1.5f;
    public float lineWidth = 0.05f;
    public Color gridColor = Color.cyan;
    public Material lineMaterial;

    [Header("Layer Settings")]
    [Tooltip("Layer name for grid columns. Create this layer in Edit > Project Settings > Tags and Layers")]
    public string gridLayerName = "Grid";

    [Header("Debug")]
    public bool showCellCenters = false;

    void Start()
    {
        GenerateVisualGrid();
        GenerateColliders();
        
        Debug.Log($"BoardGenerator: Created {columnsX}x{rowsY}x{depthZ} grid with spacing={spacing}");
        Debug.Log($"Board spans: X[0 to {columnsX * spacing}], Y[0 to {rowsY * spacing}], Z[0 to {depthZ * spacing}]");
    }

    void OnDrawGizmos()
    {
        if (!showCellCenters) return;
        
        // Draw cell centers for first layer
        Gizmos.color = Color.yellow;
        float halfSpace = spacing / 2f;
        for (int x = 0; x < columnsX; x++)
        {
            for (int z = 0; z < depthZ; z++)
            {
                Vector3 center = transform.TransformPoint(new Vector3(
                    (x * spacing) + halfSpace,
                    halfSpace,
                    (z * spacing) + halfSpace
                ));
                Gizmos.DrawWireSphere(center, spacing * 0.3f);
            }
        }
    }

    void GenerateVisualGrid()
    {
        GameObject gridParent = new GameObject("VisualGrid_Container");
        gridParent.transform.parent = this.transform;
        gridParent.transform.localPosition = Vector3.zero;

        // Vertical Lines (Pillars)
        for (int x = 0; x <= columnsX; x++)
        {
            for (int z = 0; z <= depthZ; z++)
            {
                Vector3 start = new Vector3(x, 0, z) * spacing;
                Vector3 end = new Vector3(x, rowsY, z) * spacing;
                CreateLine(start, end, gridParent.transform);
            }
        }

        // Horizontal Lines (Width)
        for (int y = 0; y <= rowsY; y++)
        {
            for (int z = 0; z <= depthZ; z++)
            {
                Vector3 start = new Vector3(0, y, z) * spacing;
                Vector3 end = new Vector3(columnsX, y, z) * spacing;
                CreateLine(start, end, gridParent.transform);
            }
        }

        // Depth Lines
        for (int x = 0; x <= columnsX; x++)
        {
            for (int y = 0; y <= rowsY; y++)
            {
                Vector3 start = new Vector3(x, y, 0) * spacing;
                Vector3 end = new Vector3(x, y, depthZ) * spacing;
                CreateLine(start, end, gridParent.transform);
            }
        }
    }

    void CreateLine(Vector3 start, Vector3 end, Transform parent)
    {
        GameObject lineObj = new GameObject("GridLine");
        lineObj.transform.parent = parent;
        lineObj.transform.localPosition = Vector3.zero;
        
        LineRenderer lr = lineObj.AddComponent<LineRenderer>();
        
        if (lineMaterial != null)
            lr.material = lineMaterial;
        else
            lr.material = new Material(Shader.Find("Sprites/Default"));

        lr.startColor = gridColor;
        lr.endColor = gridColor;
        lr.startWidth = lineWidth;
        lr.endWidth = lineWidth;
        lr.positionCount = 2;
        lr.useWorldSpace = false;
        lr.SetPosition(0, start);
        lr.SetPosition(1, end);
    }

    void GenerateColliders()
    {
        GameObject colliderParent = new GameObject("Collider_Container");
        colliderParent.transform.parent = this.transform;
        colliderParent.transform.localPosition = Vector3.zero;

        // Get the Grid layer index
        int gridLayer = LayerMask.NameToLayer(gridLayerName);
        if (gridLayer < 0)
        {
            Debug.LogWarning($"BoardGenerator: Layer '{gridLayerName}' not found. Columns will use Default layer. " +
                           "Create the layer in Edit > Project Settings > Tags and Layers for better detection.");
        }

        for (int x = 0; x < columnsX; x++)
        {
            for (int z = 0; z < depthZ; z++)
            {
                GameObject pillar = new GameObject($"Column_{x}_{z}");
                pillar.transform.parent = colliderParent.transform;
                
                // Add GridColumn component
                GridColumn colScript = pillar.AddComponent<GridColumn>();
                colScript.gridX = x;
                colScript.gridZ = z;

                // Add BoxCollider
                BoxCollider box = pillar.AddComponent<BoxCollider>();
                
                // Calculate position and size
                float halfSpace = spacing / 2f;
                float totalHeight = rowsY * spacing;

                pillar.transform.localPosition = new Vector3(
                    (x * spacing) + halfSpace,
                    totalHeight / 2f,
                    (z * spacing) + halfSpace
                );

                box.size = new Vector3(spacing * 0.95f, totalHeight, spacing * 0.95f);
                
                // Set layer
                if (gridLayer >= 0)
                {
                    pillar.layer = gridLayer;
                }
            }
        }

        Debug.Log($"BoardGenerator: Created {columnsX * depthZ} column colliders");
    }
}
