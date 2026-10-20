using UnityEngine;

/// <summary>
/// Marks a GameObject as grabbable by the GrabController.
/// Add this component to any object you want to be able to grab.
/// Requires a Collider component for detection.
/// </summary>
[RequireComponent(typeof(Collider))]
public class GrabbableObject_old : MonoBehaviour
{
    #region Serialized Fields

    [Header("Grab Settings")]
    [SerializeField] private bool customGrabOffset = false;
    [SerializeField] private Vector3 grabOffsetOverride = Vector3.zero;
    
    [Tooltip("If true, object stays in place when grabbed (useful for rotation-only objects like the game board)")]
    [SerializeField] private bool lockPositionWhenGrabbed = false;

    [Header("Visual Feedback")]
    [SerializeField] private bool highlightWhenNearby = false;
    [SerializeField] private Color highlightColor = Color.yellow;

    [Header("Events")]
    [SerializeField] private bool enableDebugLogs = false;

    #endregion

    #region Private Fields

    private Renderer _renderer;
    private Color _originalColor;
    private bool _isGrabbed = false;
    private bool _isHighlighted = false;

    #endregion

    #region Public Properties

    public bool IsGrabbed => _isGrabbed;
    public Vector3 CustomGrabOffset => customGrabOffset ? grabOffsetOverride : Vector3.zero;
    public bool HasCustomOffset => customGrabOffset;
    
    /// <summary>
    /// If true, GrabController should not move this object's position when grabbed.
    /// Useful for objects that should only be rotated in place (like the game board).
    /// </summary>
    public bool LockPositionWhenGrabbed => lockPositionWhenGrabbed;

    #endregion

    #region Unity Lifecycle

    private void Start()
    {
        // Get renderer for highlight effect
        _renderer = GetComponent<Renderer>();
        if (_renderer != null && _renderer.material != null)
        {
            _originalColor = _renderer.material.color;
        }

        // Ensure we have a collider
        Collider col = GetComponent<Collider>();
        if (col == null)
        {
            Debug.LogError($"GrabbableObject on '{gameObject.name}' requires a Collider component!");
        }
    }

    #endregion

    #region Public Methods

    /// <summary>
    /// Called when this object is grabbed
    /// </summary>
    public void OnGrabbed()
    {
        _isGrabbed = true;

        if (highlightWhenNearby)
        {
            RemoveHighlight();
        }

        if (enableDebugLogs)
        {
            Debug.Log($"GrabbableObject '{gameObject.name}': Grabbed (LockPosition={lockPositionWhenGrabbed})");
        }
    }

    /// <summary>
    /// Called when this object is released
    /// </summary>
    public void OnReleased()
    {
        _isGrabbed = false;

        if (enableDebugLogs)
        {
            Debug.Log($"GrabbableObject '{gameObject.name}': Released");
        }
    }

    /// <summary>
    /// Called when hand is nearby (optional feature for future)
    /// </summary>
    public void OnNearby()
    {
        if (highlightWhenNearby && !_isGrabbed && !_isHighlighted)
        {
            ApplyHighlight();
        }
    }

    /// <summary>
    /// Called when hand moves away (optional feature for future)
    /// </summary>
    public void OnNotNearby()
    {
        if (_isHighlighted)
        {
            RemoveHighlight();
        }
    }

    #endregion

    #region Private Methods

    private void ApplyHighlight()
    {
        if (_renderer != null && _renderer.material != null)
        {
            _renderer.material.color = highlightColor;
            _isHighlighted = true;
        }
    }

    private void RemoveHighlight()
    {
        if (_renderer != null && _renderer.material != null)
        {
            _renderer.material.color = _originalColor;
            _isHighlighted = false;
        }
    }

    #endregion
}