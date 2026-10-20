using UnityEngine;
using UnityEngine.EventSystems; // <-- Add this line at the top

public class PlayerLook : MonoBehaviour
{
    public float mouseSensitivity = 2f;
    public Transform playerCamera; // Make sure your Main Camera is assigned here in the Inspector

    private float xRotation = 0f;
    private bool isCursorLocked = false;

    void Start()
    {
        UnlockCursor();
    }

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.Escape))
        {
            UnlockCursor();
        }

        // Check if we should lock the cursor
        if (Input.GetMouseButtonDown(0))
        {
            // THIS IS THE FIX: Check if the mouse is currently over a UI element
            if (!EventSystem.current.IsPointerOverGameObject())
            {
                // If not over UI, then lock the cursor.
                LockCursor();
            }
            // If it IS over a UI element, this code is skipped,
            // allowing the button click to go through normally.
        }

        // Only rotate the view if the cursor is locked
        if (isCursorLocked)
        {
            float mouseX = Input.GetAxis("Mouse X") * mouseSensitivity * Time.deltaTime;
            float mouseY = Input.GetAxis("Mouse Y") * mouseSensitivity * Time.deltaTime;

            xRotation -= mouseY;
            xRotation = Mathf.Clamp(xRotation, -90f, 90f);

            // This line rotates the camera up/down
            if (playerCamera != null)
            {
                playerCamera.localRotation = Quaternion.Euler(xRotation, 0f, 0f);
            }

            // This line rotates the whole player left/right
            transform.Rotate(Vector3.up * mouseX);
        }
    }

    private void LockCursor()
    {
        Cursor.lockState = CursorLockMode.Locked;
        Cursor.visible = false;
        isCursorLocked = true;
    }

    private void UnlockCursor()
    {
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
        isCursorLocked = false;
    }
}
