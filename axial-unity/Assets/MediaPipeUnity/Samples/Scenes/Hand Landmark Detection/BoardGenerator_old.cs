using UnityEngine;

public class BoardGenerator_old : MonoBehaviour
{
    [Header("Board Dimensions")]
    public int columnsX = 7; // Width
    public int rowsY = 6;    // Height (The stack limit)
    public int depthZ = 6;   // Depth

    [Header("Settings")]
    public float spacing = 1.5f;   // Space between holes
    public float lineWidth = 0.05f;
    public Color gridColor = Color.cyan;
    public Material lineMaterial; // Drag a "Particles/Standard Unlit" or "Sprites/Default" material here

    void Start()
    {
        GenerateVisualGrid();
        GenerateColliders();
    }

    void GenerateVisualGrid()
    {
        // Create a parent object to keep the hierarchy clean
        GameObject gridParent = new GameObject("VisualGrid_Container");
        gridParent.transform.parent = this.transform;

        // 1. Draw Vertical Lines (Pillars)
        // We need lines at every X and Z intersection, going up the Y axis
        for (int x = 0; x <= columnsX; x++)
        {
            for (int z = 0; z <= depthZ; z++)
            {
                Vector3 start = new Vector3(x, 0, z) * spacing;
                Vector3 end = new Vector3(x, rowsY, z) * spacing;
                CreateLine(start, end, gridParent.transform);
            }
        }

        // 2. Draw Horizontal Lines (Width)
        // Lines running along X axis
        for (int y = 0; y <= rowsY; y++)
        {
            for (int z = 0; z <= depthZ; z++)
            {
                Vector3 start = new Vector3(0, y, z) * spacing;
                Vector3 end = new Vector3(columnsX, y, z) * spacing;
                CreateLine(start, end, gridParent.transform);
            }
        }

        // 3. Draw Depth Lines (Depth)
        // Lines running along Z axis
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
        // Reset local position so it aligns with parent
        lineObj.transform.localPosition = Vector3.zero; 
        lineObj.transform.localRotation = Quaternion.identity;
            
        LineRenderer lr = lineObj.AddComponent<LineRenderer>();
            
        // IMPORTANT: This allows the grid to resize when you scale the GameBoard object!
        lr.useWorldSpace = false; 

        // Setup Material
        if(lineMaterial != null)
            lr.material = lineMaterial;
        else 
            lr.material = new Material(Shader.Find("Sprites/Default"));

            lr.startColor = gridColor;
            lr.endColor = gridColor;
            lr.startWidth = lineWidth;
            lr.endWidth = lineWidth;
            lr.positionCount = 2;
            lr.SetPosition(0, start);
            lr.SetPosition(1, end);
    }

    void GenerateColliders()
    {
        GameObject colliderParent = new GameObject("Collider_Container");
        colliderParent.transform.parent = this.transform;

        // We need one collider for every generic COLUMN (X, Z combination)
        // We do NOT need colliders for the rows (Y), because gravity handles that.
        // Loop through the "floor" of the grid (X and Z)
        for (int x = 0; x < columnsX; x++)
        {
            for (int z = 0; z < depthZ; z++)
            {
                // Create the invisible pillar
                GameObject pillar = new GameObject($"Column_{x}_{z}");
                pillar.transform.parent = colliderParent.transform;
                
                // Add the Clickable Script (You need to create this script separately!)
                GridColumn colScript = pillar.AddComponent<GridColumn>();
                colScript.gridX = x;
                colScript.gridZ = z;

                // Add the Box Collider
                BoxCollider box = pillar.AddComponent<BoxCollider>();
                
                // CALCULATE CENTER:
                // X = current x * spacing + half a cell width
                // Y = half the total height
                // Z = current z * spacing + half a cell depth
                float halfSpace = spacing / 2f;
                float totalHeight = rowsY * spacing;

                pillar.transform.position = new Vector3(
                    (x * spacing) + halfSpace, 
                    totalHeight / 2f, 
                    (z * spacing) + halfSpace
                );

                // SIZE:
                // Width/Depth = spacing (minus a tiny bit so they don't overlap)
                // Height = total height of the board
                box.size = new Vector3(spacing * 0.9f, totalHeight, spacing * 0.9f);
                
                // Layer handling (Optional: Put this on a "Grid" layer for raycasting)
                // pillar.layer = LayerMask.NameToLayer("Grid");
            }
        }
    }
}