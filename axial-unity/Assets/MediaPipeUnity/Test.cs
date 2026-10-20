using UnityEngine;

public class Test : MonoBehaviour
{
    // These are your existing variables
    public Transform player; // This is your 'Player' parent object
    public float mouseSensitivity = 2f;
    
    // New variables for the toggle
    public KeyCode lookToggleKey = KeyCode.Tab;
    private bool isLooking = false; // Start with mouse free for UI

    float cameraVerticalRotation = 0f;

    void Start()
    {
        // Start with the cursor unlocked so you can click your UI
        Cursor.lockState = CursorLockMode.None;
        Cursor.visible = true;
    }

    void Update()
    {
        // --- 1. THE TOGGLE LOGIC ---
        // Check if the user pressed the toggle key
        if (Input.GetKeyDown(lookToggleKey))
        {
            isLooking = !isLooking; // Flip the mode

            if (isLooking)
            {
                // Lock the mouse to look around
                Cursor.lockState = CursorLockMode.Locked;
                Cursor.visible = false;
            }
            else
            {
                // Unlock the mouse to click UI
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
            }
        }

        // --- 2. THE LOOK LOGIC ---
        // Only run this if we're in "Look Mode"
        if (isLooking)
        {
            // This is your existing code for X and Y input
            float inputX = Input.GetAxis("Mouse X") * mouseSensitivity;
            float inputY = Input.GetAxis("Mouse Y") * mouseSensitivity;

            // This is your existing code for vertical (up/down) rotation
            cameraVerticalRotation -= inputY;
            cameraVerticalRotation = Mathf.Clamp(cameraVerticalRotation, -90f, 90f);
            transform.localEulerAngles = Vector3.right * cameraVerticalRotation;
            
            // --- 3. THE MISSING PIECE (Horizontal Rotation) ---
            // This line rotates the PARENT 'Player' object left and right
            player.Rotate(Vector3.up * inputX);
        }
    }
}