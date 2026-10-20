using System.Collections.Generic;
using UnityEngine;
using Mediapipe.Tasks.Vision.HandLandmarker;

public class HandTracker3D2 : MonoBehaviour
{
    [Header("Setup")]
    // 1. DRAG YOUR 'MAIN CAMERA' HERE
    [SerializeField] private Camera mainCamera; 
    [SerializeField] private GameObject[] landmarkPrefabs = new GameObject[21];

    [Header("Hand Settings")]
    [SerializeField] private bool mirrorX = true;

    [Header("Depth Settings")]
    // 2. THIS IS YOUR 'PUSH' DISTANCE
    [SerializeField] private float baseDepth = 5f; 
    
    // 3. THIS AMPLIFIES THE Z MOVEMENT
    [SerializeField] private float depthScale = 1500f; 

    private GameObject[] _landmarks = new GameObject[21];

    void Start()
    {
        for (int i = 0; i < landmarkPrefabs.Length; i++)
        {
            if (landmarkPrefabs[i] != null)
            {
                _landmarks[i] = Instantiate(landmarkPrefabs[i], this.transform);
                _landmarks[i].name = $"Landmark_{i}";
            }
        }
        ToggleLandmarks(false);
    }

    /// <summary>
    /// This is the public method hooked up to the HandLandmarkerRunner event.
    /// </summary>
    public void OnHandDataReceived(HandLandmarkerResult handDataResult)
    {
        // Check if we're using the WRONG data
        if (handDataResult.handWorldLandmarks != null && handDataResult.handWorldLandmarks.Count > 0)
        {
            // This is a safety check. This code MUST use handLandmarks, not handWorldLandmarks.
            Debug.LogWarning("HandTracker3D is receiving 'handWorldLandmarks'. It needs 'handLandmarks' (normalized) to function.");
            // We can try to fall back, but it's better to fix the HandLandmarkerRunner if this fires.
            if (handDataResult.handLandmarks == null || handDataResult.handLandmarks.Count == 0)
            {
                 ToggleLandmarks(false);
                 return;
            }
        }
        
        // Check for the CORRECT data
        if (handDataResult.handLandmarks == null || handDataResult.handLandmarks.Count == 0)
        {
            ToggleLandmarks(false);
            return;
        }

        ToggleLandmarks(true);

        // Get the list of 21 normalized landmarks
        var firstHandLandmarks = handDataResult.handLandmarks[0].landmarks;

        // --- THIS IS THE NEW DEPTH LOGIC ---
        // 1. Get a depth "proxy" value. We'll use the middle finger's Z.
        // This value gets *more negative* as your hand gets *closer* to the webcam.
        float depthProxy = firstHandLandmarks[12].z; // Landmark 12 is MIDDLE_FINGER_TIP

        // 2. Calculate the final Z distance.
        // We flip the negative proxy (-depthProxy) to make it positive.
        // As your hand gets closer (proxy = -0.1 -> -0.5), 
        // (-proxy) gets bigger (0.1 -> 0.5),
        // which pushes the 'targetDepth' farther away.
        // THIS IS THE "REVERSED" LOGIC YOU WANTED.
        float targetDepth = baseDepth + (-depthProxy * depthScale);
        // --- END NEW LOGIC ---

        for (int i = 0; i < firstHandLandmarks.Count; i++)
        {
            if (_landmarks[i] == null) continue;

            var landmark = firstHandLandmarks[i];

            // 3. Get Normalized (0-1) X and Y.
            // We flip Y because Viewport (0=bottom) is opposite of MediaPipe (0=top).
            float x = mirrorX ? (1.0f - landmark.x) : landmark.x;
            float y = 1.0f - landmark.y;

            // 4. Use ViewportToWorldPoint to project the 2D point into 3D space
            // at our calculated targetDepth.
            Vector3 viewportPos = new Vector3(x, y, targetDepth);
            Vector3 worldPos = mainCamera.ViewportToWorldPoint(viewportPos);

            // 5. Set the landmark's position.
            // We set world position because the parent is at (0,0,0) relative to the camera.
            _landmarks[i].transform.position = worldPos;
        }
    }

    private void ToggleLandmarks(bool show)
    {
        foreach (var landmark in _landmarks)
        {
            if (landmark != null && landmark.activeSelf != show)
            {
                landmark.SetActive(show);
            }
        }
    }
}