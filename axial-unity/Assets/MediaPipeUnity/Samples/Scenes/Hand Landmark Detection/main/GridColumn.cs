using UnityEngine;

public class GridColumn : MonoBehaviour
{
    public int gridX;
    public int gridZ;

    // You can access your main manager here to tell it "I was clicked!"
    void OnMouseDown()
    {
        // Find the GridManager in the scene and tell it to drop a piece
        FindAnyObjectByType<GridManager>().AttemptDrop(gridX, gridZ);
    }
}