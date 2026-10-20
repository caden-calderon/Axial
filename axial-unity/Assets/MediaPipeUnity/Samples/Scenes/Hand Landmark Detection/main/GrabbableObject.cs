using UnityEngine;

/// <summary>
/// Marks a GameObject as grabbable by the GrabController.
/// Add this component to any object you want to be able to grab.
/// Requires a Collider component for detection.
/// </summary>
[RequireComponent(typeof(Collider))]
public class GrabbableObject : MonoBehaviour
{
    #region Serialized Fields

    [Header("Grab Settings")]
    [SerializeField] private bool customGrabOffset = false;
    [SerializeField] private Vector3 grabOffsetOverride = Vector3.zero;
    
    [Tooltip("If true, object stays in place when grabbed (useful for rotation-only objects like the game board)")]
    [SerializeField] private bool lockPositionWhenGrabbed = false;

    [Header("Visual Feedback")]
    [Tooltip("Enable highlight effect when hand is nearby")]
    [SerializeField] private bool highlightWhenNearby = true;
    
    [Tooltip("Color tint when nearby")]
    [SerializeField] private Color highlightColor = new Color(1f, 1f, 0.5f, 1f);
    
    [Tooltip("Emission color for glow effect")]
    [SerializeField] private Color emissionColor = new Color(1f, 0.8f, 0.2f, 1f);
    
    [Tooltip("Intensity of the emission glow")]
    [SerializeField] [Range(0f, 2f)] private float emissionIntensity = 0.5f;
    
    [Tooltip("Pulse the highlight for extra visibility")]
    [SerializeField] private bool pulseHighlight = true;
    
    [Tooltip("Speed of the pulse effect")]
    [SerializeField] private float pulseSpeed = 3f;
    
    [Tooltip("Scale increase when nearby (1.0 = no change)")]
    [SerializeField] [Range(1f, 1.3f)] private float nearbyScaleMultiplier = 1.05f;

    [Header("Debug")]
    [SerializeField] private bool enableDebugLogs = false;

    #endregion

    #region Private Fields

    private Renderer _renderer;
    private Material _material;
    private Color _originalColor;
    private Color _originalEmission;
    private Vector3 _originalScale;
    private bool _isGrabbed = false;
    private bool _isHighlighted = false;
    private bool _canBeGrabbed = true;
    private float _pulseTimer = 0f;
    
    // Material property IDs for efficiency
    private static readonly int EmissionColorId = Shader.PropertyToID("_EmissionColor");

    #endregion

    #region Public Properties

    public bool IsGrabbed => _isGrabbed;
    public Vector3 CustomGrabOffset => customGrabOffset ? grabOffsetOverride : Vector3.zero;
    public bool HasCustomOffset => customGrabOffset;
    public bool LockPositionWhenGrabbed => lockPositionWhenGrabbed;
    
    /// <summary>
    /// If false, this object cannot be grabbed. Use SetGrabbable() to change.
    /// </summary>
    public bool CanBeGrabbed => _canBeGrabbed && enabled;

    #endregion

    #region Unity Lifecycle

    private void Start()
    {
        // Cache original scale
        _originalScale = transform.localScale;
        
        // Get renderer for highlight effect
        _renderer = GetComponent<Renderer>();
        if (_renderer != null && _renderer.material != null)
        {
            // Create instance of material to avoid affecting other objects
            _material = _renderer.material;
            _originalColor = _material.color;
            
            // Check if material has emission
            if (_material.HasProperty(EmissionColorId))
            {
                _originalEmission = _material.GetColor(EmissionColorId);
            }
            else
            {
                _originalEmission = Color.black;
            }
        }

        // Ensure we have a collider
        Collider col = GetComponent<Collider>();
        if (col == null)
        {
            Debug.LogError($"GrabbableObject on '{gameObject.name}' requires a Collider component!");
        }
    }

    private void Update()
    {
        // Animate pulse effect when highlighted
        if (_isHighlighted && pulseHighlight && _material != null)
        {
            _pulseTimer += Time.deltaTime * pulseSpeed;
            float pulse = (Mathf.Sin(_pulseTimer) + 1f) * 0.5f; // 0 to 1
            
            // Pulse the emission intensity
            Color currentEmission = emissionColor * emissionIntensity * (0.5f + pulse * 0.5f);
            _material.SetColor(EmissionColorId, currentEmission);
            
            // Subtle scale pulse
            float scalePulse = 1f + (nearbyScaleMultiplier - 1f) * (0.7f + pulse * 0.3f);
            transform.localScale = _originalScale * scalePulse;
        }
    }

    private void OnDisable()
    {
        // Clean up highlight when disabled
        if (_isHighlighted)
        {
            RemoveHighlightImmediate();
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

        // Remove highlight when grabbed
        if (_isHighlighted)
        {
            RemoveHighlightImmediate();
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
    /// Called when hand is nearby and this is the closest grabbable object
    /// </summary>
    public void OnNearby()
    {
        if (!_canBeGrabbed) return;
        
        if (highlightWhenNearby && !_isGrabbed && !_isHighlighted)
        {
            ApplyHighlight();
            
            if (enableDebugLogs)
            {
                Debug.Log($"GrabbableObject '{gameObject.name}': Hand nearby - highlighting");
            }
        }
    }

    /// <summary>
    /// Called when hand moves away or another object becomes closest
    /// </summary>
    public void OnNotNearby()
    {
        if (_isHighlighted)
        {
            RemoveHighlight();
            
            if (enableDebugLogs)
            {
                Debug.Log($"GrabbableObject '{gameObject.name}': Hand left - removing highlight");
            }
        }
    }

    /// <summary>
    /// Enable or disable the ability to grab this object
    /// </summary>
    public void SetGrabbable(bool canGrab)
    {
        _canBeGrabbed = canGrab;
        
        if (!canGrab && _isHighlighted)
        {
            RemoveHighlightImmediate();
        }
        
        if (enableDebugLogs)
        {
            Debug.Log($"GrabbableObject '{gameObject.name}': Grabbable set to {canGrab}");
        }
    }

    #endregion

    #region Private Methods

    private void ApplyHighlight()
    {
        if (_material == null) return;
        
        _isHighlighted = true;
        _pulseTimer = 0f;
        
        // Apply highlight color
        _material.color = Color.Lerp(_originalColor, highlightColor, 0.3f);
        
        // Enable emission for glow effect
        _material.EnableKeyword("_EMISSION");
        _material.SetColor(EmissionColorId, emissionColor * emissionIntensity);
        
        // Initial scale bump
        transform.localScale = _originalScale * nearbyScaleMultiplier;
    }

    private void RemoveHighlight()
    {
        if (_material == null) return;
        
        _isHighlighted = false;
        
        // Restore original color
        _material.color = _originalColor;
        
        // Restore original emission
        _material.SetColor(EmissionColorId, _originalEmission);
        if (_originalEmission == Color.black)
        {
            _material.DisableKeyword("_EMISSION");
        }
        
        // Restore original scale
        transform.localScale = _originalScale;
    }
    
    private void RemoveHighlightImmediate()
    {
        // Same as RemoveHighlight but called when we need immediate cleanup
        RemoveHighlight();
    }

    #endregion
}