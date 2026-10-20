using UnityEngine;

[RequireComponent(typeof(CharacterController))]
public class PlayerMovement : MonoBehaviour
{
    #region Serialized Fields

    [Header("Movement")]
    [SerializeField] private float walkSpeed = 5f;
    [SerializeField] private float sprintSpeed = 10f;
    [SerializeField] private float acceleration = 10f;        // How fast to reach max speed
    [SerializeField] private float deceleration = 10f;        // How fast to stop

    [Header("Jump & Gravity")]
    [SerializeField] private float jumpHeight = 2f;
    [SerializeField] private float gravity = -20f;

    [Header("Ground Check")]
    [SerializeField] private Transform groundCheck;           // Position to check for ground
    [SerializeField] private float groundDistance = 0.2f;     // Radius of ground check sphere
    [SerializeField] private LayerMask groundMask;            // What counts as ground

    [Header("Input")]
    [SerializeField] private KeyCode sprintKey = KeyCode.LeftShift;
    [SerializeField] private KeyCode jumpKey = KeyCode.Space;

    [Header("Debug")]
    [SerializeField] private bool enableDebugLogs = false;

    #endregion

    #region Private Fields

    private CharacterController _controller;
    private Vector3 _velocity;
    private bool _isGrounded;
    private Vector3 _currentMoveVelocity;  // For smooth acceleration

    #endregion

    #region Unity Lifecycle

    private void Start()
    {
        _controller = GetComponent<CharacterController>();

        // Create ground check if missing
        if (groundCheck == null)
        {
            GameObject groundCheckObj = new GameObject("GroundCheck");
            groundCheckObj.transform.SetParent(transform);
            groundCheckObj.transform.localPosition = new Vector3(0, -_controller.height / 2f, 0);
            groundCheck = groundCheckObj.transform;

            if (enableDebugLogs)
            {
                Debug.Log("PlayerMovement: Created GroundCheck transform");
            }
        }

        if (enableDebugLogs)
        {
            Debug.Log("PlayerMovement initialized");
        }
    }

    private void Update()
    {
        CheckGround();
        HandleMovement();
        HandleJump();
        ApplyGravity();
    }

    private void OnDrawGizmosSelected()
    {
        // Visualize ground check sphere
        if (groundCheck != null)
        {
            Gizmos.color = _isGrounded ? Color.green : Color.red;
            Gizmos.DrawWireSphere(groundCheck.position, groundDistance);
        }
    }

    #endregion

    #region Private Methods

    private void CheckGround()
    {
        // Check if player is on ground using sphere cast
        _isGrounded = Physics.CheckSphere(groundCheck.position, groundDistance, groundMask);

        // Reset vertical velocity when grounded
        if (_isGrounded && _velocity.y < 0)
        {
            _velocity.y = -2f; // Small negative value keeps player grounded
        }
    }

    private void HandleMovement()
    {
        // Get input
        float horizontal = Input.GetAxis("Horizontal"); // A/D
        float vertical = Input.GetAxis("Vertical");     // W/S

        // Calculate move direction based on where player is facing
        Vector3 moveDirection = transform.right * horizontal + transform.forward * vertical;

        // Normalize diagonal movement (prevents moving faster diagonally)
        if (moveDirection.magnitude > 1f)
        {
            moveDirection.Normalize();
        }

        // Determine current speed (walk vs sprint)
        bool isSprinting = Input.GetKey(sprintKey);
        float targetSpeed = isSprinting ? sprintSpeed : walkSpeed;

        // Calculate target velocity
        Vector3 targetVelocity = moveDirection * targetSpeed;

        // Smooth acceleration/deceleration
        float smoothSpeed = moveDirection.magnitude > 0.1f ? acceleration : deceleration;
        _currentMoveVelocity = Vector3.Lerp(_currentMoveVelocity, targetVelocity, smoothSpeed * Time.deltaTime);

        // Apply movement
        _controller.Move(_currentMoveVelocity * Time.deltaTime);

        if (enableDebugLogs && moveDirection.magnitude > 0.1f)
        {
            Debug.Log($"Moving: Direction={moveDirection}, Speed={_currentMoveVelocity.magnitude:F2}, Sprinting={isSprinting}");
        }
    }

    private void HandleJump()
    {
        if (Input.GetKeyDown(jumpKey) && _isGrounded)
        {
            // Apply jump velocity using physics formula: v = sqrt(height * -2 * gravity)
            _velocity.y = Mathf.Sqrt(jumpHeight * -2f * gravity);

            if (enableDebugLogs)
            {
                Debug.Log($"Jump! Velocity={_velocity.y:F2}");
            }
        }
    }

    private void ApplyGravity()
    {
        // Apply gravity
        _velocity.y += gravity * Time.deltaTime;

        // Move player vertically
        _controller.Move(_velocity * Time.deltaTime);
    }

    #endregion
}
