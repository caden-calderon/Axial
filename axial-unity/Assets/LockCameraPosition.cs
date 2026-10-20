using UnityEngine;

/// <summary>
/// DEBUG SCRIPT: Locks camera position to prevent unwanted movement.
/// Add this to your Camera to diagnose floating issues.
/// </summary>
public class LockCameraPosition : MonoBehaviour
{
    [SerializeField] private bool lockPosition = true;
    [SerializeField] private Vector3 lockedPosition = new Vector3(0, 0, -10);

    [SerializeField] private bool disableRigidbody = true;

    private void Start()
    {
        Debug.Log($"LockCameraPosition: Starting at {transform.position}");

        if (disableRigidbody)
        {
            Rigidbody rb = GetComponent<Rigidbody>();
            if (rb != null)
            {
                Debug.LogWarning($"LockCameraPosition: Found Rigidbody on camera! Disabling it.");
                rb.isKinematic = true;
                rb.useGravity = false;
            }
        }

        if (lockPosition)
        {
            transform.position = lockedPosition;
        }
    }

    private void LateUpdate()
    {
        if (lockPosition)
        {
            if (Vector3.Distance(transform.position, lockedPosition) > 0.01f)
            {
                Debug.LogWarning($"LockCameraPosition: Camera moved to {transform.position}, forcing back to {lockedPosition}");
                transform.position = lockedPosition;
            }
        }
    }
}
