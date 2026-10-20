# HandTracker3D Documentation

**Last Updated:** 2025-11-18
**Status:** Active Development - PalmMaxDimension Refinement

---

NOTE: This documentation is mostly outdated. Please refer to the HandTracker3D.cs file for the most up-to-date information. This is used for reference, history, progession, trial and error, etc purposes only. 

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Skeleton Bones Feature](#skeleton-bones-feature)
4. [How It Works](#how-it-works)
5. [Hand Size Methods](#hand-size-methods)
6. [Key Variables Explained](#key-variables-explained)
7. [Improvements Made](#improvements-made)
8. [Current Configuration](#current-configuration)
9. [Known Issues](#known-issues)
10. [Future Work](#future-work)
11. [Code Structure Reference](#code-structure-reference)

---

## Overview

**HandTracker3D.cs** is a Unity component that visualizes MediaPipe hand tracking data in 3D space. It receives hand landmark data from **HandLandmarkerRunner.cs** and positions 21 GameObject prefabs to represent hand joints in real-time.

### Primary Goals

- Visualize hand landmarks in 3D Unity space
- Calculate hand distance from camera (Z-axis) based on hand size
- Provide smooth, stable tracking with minimal jitter
- Handle hand gestures without affecting position calculations

### Key Challenge

**Inferring depth (Z) from 2D camera data** - MediaPipe provides normalized 2D coordinates (X, Y) and estimated depth (Z), but we need to convert hand "size" in the camera frame to actual distance from camera.

---

## Architecture

### Component Relationship

```
[Webcam]
    ↓
[HandLandmarkerRunner] ← Runs MediaPipe hand detection
    ↓ (UnityEvent)
[HandTracker3D] ← Receives landmark data, visualizes in 3D
    ↓
[21 Landmark Prefabs] ← Individual GameObjects for each joint
```

### Data Flow

1. **HandLandmarkerRunner** captures webcam frames
2. MediaPipe processes frames and detects hand landmarks (21 points)
3. Runner invokes `OnHandLandmarksResultOutput` UnityEvent
4. **HandTracker3D** subscribes to this event via `OnHandDataReceived()`
5. Data is cached in `_currentTarget` (thread-safe)
6. `Update()` processes cached data on main thread via `SyncNow()`
7. Hand position (X, Y, Z) is calculated
8. 21 landmark prefabs are positioned in 3D space

### Thread Safety

```csharp
// HandLandmarkerRunner may invoke event from background thread
public void OnHandDataReceived(HandLandmarkerResult handDataResult)
{
    lock (_currentTargetLock)  // Thread-safe caching
    {
        handDataResult.CloneTo(ref _currentTarget);
        _isResultReady = true;
    }
}

// Processing happens on main thread in Update()
private void Update()
{
    if (_isResultReady)
    {
        SyncNow();  // Main thread only
        _isResultReady = false;
    }
}
```

**Why:** Unity API calls (transform.localPosition) must happen on main thread.

---

## Skeleton Bones Feature

### Overview

**Added:** 2025-11-12

The skeleton bones system creates 3D cylinder GameObjects that dynamically stretch and rotate to connect hand landmarks, forming a visible "skeleton" structure. This makes the hand tracking visualization much more intuitive than just floating sphere landmarks.

### Implementation Details

**25 Bone Connections:**

```
Wrist connections (5 bones):
- Wrist → Thumb base (0 → 1)
- Wrist → Index base (0 → 5)
- Wrist → Middle base (0 → 9)
- Wrist → Ring base (0 → 13)
- Wrist → Pinky base (0 → 17)

Finger chains (20 bones):
- Thumb: 1→2→3→4 (3 segments)
- Index: 5→6→7→8 (3 segments)
- Middle: 9→10→11→12 (3 segments)
- Ring: 13→14→15→16 (3 segments)
- Pinky: 17→18→19→20 (3 segments)
```

### Configuration

**Inspector Settings (HandTracker3D.cs:64-67):**

```csharp
[SerializeField] private bool enableSkeletonBones = true;   // Toggle on/off
[SerializeField] private Material boneMaterial;              // Optional material
[SerializeField] private float boneThickness = 0.05f;        // Diameter of bones
```

**Usage:**

- `Enable Skeleton Bones` - Master toggle for the feature
- `Bone Material` - Assign a custom material (optional, uses Unity default if empty)
- `Bone Thickness` - Controls bone diameter (try 0.02 - 0.1 depending on landmark scale)

### How It Works

For each bone connection:

1. **Position:** Placed at midpoint between start and end landmarks
2. **Rotation:** Oriented to point from start → end using `Quaternion.FromToRotation`
3. **Scale:** X/Z = thickness (diameter), Y = distance/2 (cylinder height is 2 in Unity)

**Math:**

```csharp
midpoint = (startPos + endPos) * 0.5f
direction = endPos - startPos
distance = direction.magnitude
rotation = Quaternion.FromToRotation(Vector3.up, direction)
scale = Vector3(thickness, distance * 0.5f, thickness)
```

### Performance Optimizations

**Cached References:**

- Transform components cached during initialization
- Avoids repeated `.transform` calls in Update loop
- Reduces GC allocations

**Efficient Updates:**

- Early validation and `continue` statements
- Multiplication instead of division where possible (`* 0.5f` vs `/ 2f`)
- Zero-length bone check to avoid unnecessary calculations

**Rendering:**

- Shadow casting disabled (`ShadowCastingMode.Off`)
- Shadow receiving disabled
- Colliders removed (no physics needed)

### Why Cylinders Instead of LineRenderer

**Initial Implementation:** Used LineRenderer components
**Problem:**

- Rendering order issues (lines behind spheres)
- Width parameter ineffective even at high values
- Poor visibility in 3D space

**Solution:** 3D Cylinder primitives

- Proper depth rendering
- Naturally scale with distance
- Integrate seamlessly with landmark spheres
- More performant (no line width calculations)

---

## How It Works

### Coordinate System Conversion

**MediaPipe Output:**

- Normalized coordinates: `x, y ∈ [0, 1]` (percentage of screen)
- `x = 0.0` → left edge, `x = 1.0` → right edge
- `y = 0.0` → top edge, `y = 1.0` → bottom edge
- `z` → estimated depth (relative, not calibrated)

**HandTracker3D Conversion:**

```csharp
// Center at (0.5, 0.5) and scale to Unity units
float x = (landmark.x - 0.5f) * screenWidth * (mirrorX ? -1 : 1);
float y = -(landmark.y - 0.5f) * screenHeight;  // Inverted Y
float z = landmark.z * depthScale * (mirrorZ ? -1 : 1);
```

### Two Z-Axis Systems

This is crucial to understand:

#### 1. **Overall Hand Distance** (Parent GameObject Z)

- Calculated from **hand size in camera frame**
- Theory: Larger hand in frame = closer to camera
- Updates `transform.localPosition.z`
- Range: `minZ` (far) to `maxZ` (close)

#### 2. **Individual Finger Depth** (Landmark Local Z)

- Uses MediaPipe's per-landmark `z` value
- Relative to the hand's "palm plane"
- Shows finger curling/extension
- Scaled by `depthScale` and `dynamicDepthScale`

**Combined Effect:**

```
Final Landmark World Position = Parent Position + (Landmark Local Position)
                               = (X, Y, handDistanceZ) + (localX, localY, fingerDepthZ)
```

### Distance Calculation Pipeline

```
1. Calculate Raw Hand Size
   ↓ (method-dependent: bounding box, landmark distance, etc.)

2. Smooth Hand Size (handSizeSmoothing = 0.92)
   ↓ (aggressive Lerp to reduce measurement jitter)

3. Apply Dead Zone (deadZoneThreshold = 0.02)
   ↓ (ignore changes smaller than threshold)

4. Normalize to [0, 1]
   ↓ (InverseLerp between minHandSize and maxHandSize)

5. Map to Z Range
   ↓ (Lerp from minZ to maxZ)

6. Apply Mirror (optional)
   ↓ (invert if mirrorZ enabled)

7. Smooth Z Position (zSmoothing = 0.92)
   ↓ (separate, extra aggressive smoothing for Z)

8. Update Parent Transform
```

---

## Hand Size Methods

### Method Comparison Table

| Method                  | Stability  | Gesture Resistance | Value Range  | Current Rank        |
| ----------------------- | ---------- | ------------------ | ------------ | ------------------- |
| **PalmMaxDimension** ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐         | 0.0 - 1.0+   | 🥇 **BEST**         |
| StableLandmarksOnly     | ⭐⭐⭐⭐   | ⭐⭐⭐⭐⭐         | 0.10 - 0.30  | 🥈 Good Alternative |
| AverageMultiplePairs    | ⭐⭐⭐⭐   | ⭐⭐⭐             | 0.12 - 0.25  | 🥉 Decent           |
| BoundingBoxDiagonal     | ⭐⭐⭐     | ⭐⭐⭐             | 0.15 - 0.40  | Decent              |
| IndexToPinkyBase        | ⭐⭐       | ⭐⭐               | 0.08 - 0.25  | Basic               |
| PalmWidth               | ⭐⭐       | ⭐⭐               | 0.05 - 0.18  | Rotation-sensitive  |
| WristToMiddleFinger     | ⭐⭐       | ⭐                 | 0.10 - 0.30  | Fist-sensitive      |
| BoundingBoxArea         | ⭐⭐       | ⭐⭐⭐             | 0.02 - 0.16  | Non-linear          |
| MediaPipeZAverage       | ❌         | ⭐⭐⭐⭐⭐         | -0.10 - 0.05 | Broken              |

---

### 1. PalmMaxDimension ⭐ (CURRENT DEFAULT)

**Code Location:** HandTracker3D.cs

**Algorithm:**

```csharp
// 1. Normalize three key measurements to 0-1 range based on neutral calibration
float normWidthX = InverseLerp(widthXMin, widthXMax, palmWidthX);
float normWidthY = InverseLerp(widthYMin, widthYMax, palmWidthY);
float normHeight = InverseLerp(heightMin, heightMax, palmHeight2D);

// 2. Take the MAX of the three
return Mathf.Max(normWidthX, normWidthY, normHeight);
```

**How It Works:**

- Calculates three separate "competitors" for the Z-value.
- **normWidthX**: Horizontal width (Index to Pinky). Handles neutral pose.
- **normWidthY**: Vertical width (Index to Pinky). Handles "waving" gestures where X collapses but Y grows.
- **normHeight**: Vertical height (Wrist to Middle Base). Handles hand rotation.
- The "winner-takes-all" approach ensures that whichever dimension is currently facing the camera drives the Z-depth.

**Pros:**

- ✅ **Rotation Resistant**: Switches to height when hand rotates.
- ✅ **Wave Resistant**: Switches to Y-width when hand waves.
- ✅ **Bend Resistant**: Switches to X-width when wrist bends.
- ✅ **Full Range**: Normalized value can exceed 1.0 for close-up interaction.

**Cons:**

- ⚠️ Requires careful calibration of min/max ranges for all 3 dimensions.

**Use Case:** ✅ **DEFAULT - Best for all-around interaction.**

---

### 2. IndexToPinkyBase

**Code Location:** HandTracker3D.cs:209-214

**Algorithm:**

```csharp
Vector3.Distance(
    landmarks[5],  // Index finger base
    landmarks[17]  // Pinky finger base
)
```

**How It Works:**

- Measures 3D distance across palm at knuckle line
- Uses all 3 axes (X, Y, Z) in calculation
- Hand closer → fingers spread wider in normalized coords → larger distance

**Pros:**

- ✅ Simple and intuitive
- ✅ Decent value range (0.08 - 0.25)
- ✅ Works for neutral hand pose

**Cons:**

- ❌ **Affected by hand rotation** - flipping hand changes index/pinky positions dramatically
- ❌ **Affected by spreading fingers** - spreading increases distance at same depth
- ❌ **3D distance includes Y** - vertical movement changes measurement
- ❌ **Pinky movement** - moving just pinky affects value

**Use Case:** Basic testing only, not production

---

### 2. WristToMiddleFinger

**Code Location:** HandTracker3D.cs:216-221

**Algorithm:**

```csharp
Vector3.Distance(
    landmarks[0],   // Wrist
    landmarks[12]   // Middle finger tip
)
```

**How It Works:**

- Measures hand "length" from wrist to longest finger
- Uses vertical axis rather than horizontal width
- Hand closer → appears longer in frame → larger distance

**Pros:**

- ✅ Less affected by rotation than IndexToPinky
- ✅ Uses stable wrist landmark
- ✅ Good range of motion

**Cons:**

- ❌ **Severely affected by fist** - curling middle finger makes it think hand is far
- ❌ **Pointing gestures** - extending middle finger changes measurement
- ❌ **Orientation dependent** - tilted hand changes measurement
- ❌ **3D distance includes X/Y** - side movement affects it

**Use Case:** Only when hand is always open/flat, never making fists

---

### 3. AverageMultiplePairs

**Code Location:** HandTracker3D.cs:223-233

**Algorithm:**

```csharp
dist1 = Vector3.Distance(landmarks[5], landmarks[17])  // Index to pinky
dist2 = Vector3.Distance(landmarks[0], landmarks[12])  // Wrist to middle finger
return (dist1 + dist2) / 2.0f
```

**How It Works:**

- Combines horizontal width AND vertical length
- Averages to smooth out errors from individual measurements
- If one measurement is affected by gesture, other might compensate

**Theory:**

- Averaging reduces variance
- Two independent measurements → statistical stability

**Pros:**

- ✅ **More stable than individual methods** - errors cancel out
- ✅ **User reported as one of best** ⭐
- ✅ Balances width and length measurements

**Cons:**

- ⚠️ **Still affected by fists** (middle finger component)
- ⚠️ **Still affected by rotation** (index/pinky component)
- ⚠️ Complex to tune - balancing two measurement types
- ⚠️ Still uses 3D distance with X/Y/Z

**Use Case:** Good middle-ground when hand pose varies moderately

---

### 4. PalmWidth

**Code Location:** HandTracker3D.cs:235-237

**Algorithm:**

```csharp
Mathf.Abs(landmarks[5].x - landmarks[17].x)  // Only X-axis
```

**How It Works:**

- **2D measurement** - only horizontal (X) screen space
- Completely ignores Y (vertical) and Z (MediaPipe depth)
- Hand closer → fingers wider horizontally → larger X distance

**Theory:**

- Y and Z interference eliminated
- Pure horizontal width measurement
- Inverse perspective projection

**Pros:**

- ✅ **Unaffected by vertical movement** - Y doesn't change it
- ✅ Simple 2D calculation
- ✅ Immune to MediaPipe Z errors

**Cons:**

- ❌ **Severely affected by rotation** - rotating hand changes X dramatically
- ❌ **Affected by spreading fingers**
- ❌ **Smaller value range** (0.05 - 0.18) - less resolution
- ❌ **Only works facing camera** - tilting makes it useless

**Use Case:** When hand always faces camera and stays upright

---

### 5. BoundingBoxDiagonal

**Code Location:** HandTracker3D.cs:239-255

**Algorithm:**

```csharp
// Find min/max X and Y across ALL 21 landmarks
minX, maxX, minY, maxY = findBounds(landmarks)
width = maxX - minX
height = maxY - minY
return sqrt(width² + height²)  // Diagonal
```

**How It Works:**

- Creates 2D rectangle encompassing entire hand
- Measures diagonal of that rectangle
- Like measuring "footprint" of hand on camera sensor

**Theory:**

- Hand closer → larger bounding box → larger diagonal
- Uses **all landmarks** → individual finger movements average out

**Visual:**

```
       Far Hand                 Close Hand
    ┌─────────┐              ┌───────────────┐
    │    ✋   │              │               │
    └─────────┘              │      ✋       │
    Small box                │               │
                            └───────────────┘
                            Large box
```

**Pros:**

- ✅ **Uses all 21 landmarks** - gesture-resistant
- ✅ **2D only** - immune to MediaPipe Z errors
- ✅ Measures overall hand size in screen space
- ✅ Good value range (0.15 - 0.40)

**Cons:**

- ⚠️ **User reported: affected by fists** - curled fingers shrink box
- ⚠️ Extreme finger extensions expand box artificially
- ⚠️ Doesn't isolate stable vs moving parts

**Use Case:** When hand shape varies but need overall size measurement

---

### 6. BoundingBoxArea

**Code Location:** HandTracker3D.cs:257-272

**Algorithm:**

```csharp
// Same as BoundingBoxDiagonal but:
return width * height  // Area instead of diagonal
```

**How It Works:**

- Calculates rectangular area of hand footprint
- Area scales **quadratically** with distance (inverse square law)

**Theory:**

- Hand 2x closer → 4x larger area (width × 2, height × 2 = 4x area)
- More sensitive to distance changes than linear measurements

**Pros:**

- ✅ Same as BoundingBoxDiagonal
- ✅ **More sensitive to distance** - larger value changes

**Cons:**

- ❌ Same as BoundingBoxDiagonal
- ❌ **Non-linear scaling** - hard to tune min/max values
- ❌ Small distances have huge value changes

**Use Case:** When very sensitive distance detection needed (rare)

---

### 7. StableLandmarksOnly

**Code Location:** HandTracker3D.cs:274-291

**Algorithm:**

```csharp
// Only use landmarks: 0, 5, 9, 13, 17
// (Wrist, Index base, Middle base, Ring base, Pinky base)
STABLE_LANDMARKS = [0, 5, 9, 13, 17]

// Calculate bounding box of ONLY these 5 points
minX, maxX, minY, maxY = findBounds(landmarks[STABLE_LANDMARKS])
width = maxX - minX
height = maxY - minY
return sqrt(width² + height²)
```

**Landmark Map:**

```
        12 (Middle tip) ← IGNORED
       /
      9 (Middle base) ← STABLE ✓
     /
    5 (Index base) ← STABLE ✓
   /
  0 (Wrist) ← STABLE ✓
   \
    13 (Ring base) ← STABLE ✓
     \
      17 (Pinky base) ← STABLE ✓

Tips and joints: IGNORED (1-4, 6-8, 10-12, 14-16, 18-20)
```

**How It Works:**

- Ignores all finger tips and middle joints
- Only measures stable "palm skeleton" structure
- These landmarks don't move when fingers curl/extend

**Theory:**

- **Palm structure is rigid** - doesn't deform with gestures
- Finger movements (fist, pointing, spreading) don't affect knuckle positions
- Hand closer → palm knuckles spread wider → larger bounding box

**Pros:**

- ✅ **USER CONFIRMED BEST** ⭐⭐⭐⭐⭐
- ✅ **Immune to fist-making** - fingers curl independently
- ✅ **Immune to finger gestures** - pointing, spreading irrelevant
- ✅ **Only stable anatomy** - skeletal structure doesn't deform
- ✅ 2D measurement - no MediaPipe Z interference
- ✅ Moderate value range (0.10 - 0.30)

**Cons:**

- ⚠️ **Still affected by severe rotation** - 90° tilt repositions bases
- ⚠️ Smaller measurement area than full hand
- ⚠️ **User reports Z still jumps** - MediaPipe detection noise on stable landmarks

**Use Case:** Good alternative if PalmMaxDimension calibration proves difficult.

---

### 8. MediaPipeZAverage

**Code Location:** HandTracker3D.cs:309-321

**Algorithm:**

```csharp
// Average MediaPipe's Z values from stable landmarks
zSum = 0
for idx in STABLE_LANDMARKS:
    zSum += landmarks[idx].z

// Return negated (MediaPipe Z is inverted)
return -zSum / STABLE_LANDMARKS.Length
```

**How It Works:**

- MediaPipe already estimates depth for each landmark
- Instead of inferring from size, **directly use depth data**
- Averages Z from stable landmarks only

**Theory:**

- MediaPipe's neural network estimates depth from:
  - Perspective distortion
  - Shading/lighting
  - Known hand anatomy
- This is "real" depth, not inferred from apparent size
- Negative because MediaPipe: negative = close, positive = far

**Pros:**

- ✅ **Uses actual depth estimation** - not size inference
- ✅ **Most accurate in theory** - AI does heavy lifting
- ✅ Should be immune to hand size variations

**Cons:**

- ❌ **USER REPORTS: LOCKED AT MINIMUM** - values not changing
- ❌ **Inverted scale** - needs negative min/max or mirrorZ
- ❌ **MediaPipe Z unreliable** - not calibrated for absolute distance
- ❌ **Needs special tuning:**
  - `minHandSize = -0.10` (close)
  - `maxHandSize = 0.05` (far)
  - `mirrorZ = true`
- ❌ MediaPipe Z might be noisy/inconsistent

**Use Case:** Experimental - might work with proper calibration

**Debug Notes:**

- If rawHandSize changes but Z stays at minZ, check:
  - Are min/max inverted? (should be negative)
  - Is mirrorZ enabled?
  - What's the actual range of MediaPipe Z values? (log them)

---

## Why ALL Methods Still Have Z Jumps

Even **StableLandmarksOnly** (the best method) has residual Z jumping because:

### Root Causes

1. **MediaPipe Detection Noise**

   - Even stable landmarks jitter slightly in X/Y positions frame-to-frame
   - Neural network inference has inherent uncertainty
   - Small position changes → hand size changes → Z jumps

2. **Perspective Distortion**

   - Small hand angle changes alter apparent size
   - Hand rotating even 5° changes bounding box dimensions
   - Camera FOV affects perspective scaling

3. **Camera Auto-Adjustments**

   - Webcam exposure changes brightness → affects edge detection
   - Auto-focus adjusts focal length → changes magnification
   - White balance affects contrast

4. **Quantization**

   - Normalized coordinates have limited precision
   - MediaPipe outputs floats, but with limited decimal precision
   - Small rounding errors accumulate

5. **Fundamental Limitation: Size ≠ Distance**
   - Inferring depth from apparent size is imperfect
   - Individual hand size differences
   - Perspective projection is non-linear
   - No ground truth calibration

### Mitigation Strategies (Implemented)

✅ **Aggressive Smoothing** - `handSizeSmoothing = 0.92`, `zSmoothing = 0.92`
✅ **Dead Zone** - `deadZoneThreshold = 0.02` ignores micro-changes
✅ **Stable Landmarks Only** - reduces gesture interference
✅ **Separate Z Smoothing** - Z gets extra smoothing vs X/Y
✅ **Increased minZ** - stays away from unstable near-zero zone

**Trade-off:** More smoothing = more lag when actually moving hand

---

## Key Variables Explained

### Serialized Fields (Inspector)

#### **Landmark Prefabs**

```csharp
[SerializeField] private GameObject[] landmarkPrefabs = new GameObject[21];
```

- Array of 21 GameObjects representing hand joints
- Index corresponds to MediaPipe landmark index:
  - 0: Wrist
  - 1-4: Thumb (base to tip)
  - 5-8: Index finger
  - 9-12: Middle finger
  - 13-16: Ring finger
  - 17-20: Pinky
- Instantiated at `Start()` and positioned every frame

#### **Screen Mapping**

```csharp
[SerializeField] private float screenWidth = 10.0f;
[SerializeField] private float screenHeight = 10.0f;
```

- Defines virtual screen size in Unity units
- Controls horizontal/vertical spread of landmarks
- Larger values = wider hand spread
- Landmark X/Y scaled: `(normalized - 0.5) * screenWidth`

```csharp
[SerializeField] private float depthScale = 5.0f;
```

- Multiplier for individual finger depth (MediaPipe's Z)
- Controls relative depth between fingers
- Applied to landmark local Z: `landmark.z * depthScale`
- **Note:** Now scaled dynamically with hand distance

#### **Camera Distance Settings**

```csharp
[SerializeField] private HandSizeMethod handSizeMethod = HandSizeMethod.PalmMaxDimension;
```

- **Current:** PalmMaxDimension (most robust)
- Dropdown selector for hand size calculation method
- See [Hand Size Methods](#hand-size-methods) for details

```csharp
[SerializeField] private float minHandSize = 0.10f;
[SerializeField] private float maxHandSize = 0.30f;
```

- **Expected hand size range** for chosen method
- Used for normalization: `InverseLerp(minHandSize, maxHandSize, measuredSize)`
- **Method-specific values:**
  - StableLandmarksOnly: 0.10 - 0.30
  - BoundingBoxDiagonal: 0.15 - 0.40
  - PalmWidth: 0.05 - 0.18
  - MediaPipeZAverage: -0.10 - 0.05 (inverted!)
- **Calibration:** Watch debug logs and adjust to match your camera/hand

```csharp
[SerializeField] private float smoothing = 0.7f;
```

- **X/Y position smoothing** (0-1, higher = smoother but laggier)
- Applied via: `Lerp(current, target, 1.0 - smoothing)`
- Current: 0.7 (70% previous, 30% new)
- Trade-off: responsiveness vs stability

```csharp
[SerializeField] private float zSmoothing = 0.92f;
```

- **Z-axis EXTRA smoothing** (separate from X/Y)
- Current: 0.92 (92% previous, 8% new)
- **Why separate:** Z jumps more than X/Y, needs more aggressive smoothing
- Higher than regular smoothing to prioritize stability over responsiveness

```csharp
[SerializeField] private float handSizeSmoothing = 0.92f;
```

- **Hand size measurement smoothing** (applied BEFORE Z calculation)
- Smooths raw hand size → reduces jitter propagation
- Current: 0.92 (very aggressive)
- Pipeline: raw size → smooth → dead zone → normalize → Z

```csharp
[SerializeField] private float minZ = 2.0f;
[SerializeField] private float maxZ = 50.0f;
```

- **Unity Z-axis range** (always positive)
- `minZ = 2.0`: Hand far from camera (small in frame)
- `maxZ = 50.0`: Hand close to camera (large in frame)
- **Why minZ = 2.0 not 0.1:** User reported instability near zero
- Mapping: normalized size → Lerp(minZ, maxZ, normalized)

```csharp
[SerializeField] private float deadZoneThreshold = 0.02f;
```

- **Ignore hand size changes smaller than this**
- Reduces micro-jitter from detection noise
- Current: 0.02 (2% of normalized range)
- Applied after hand size smoothing
- Higher values = more stable but less responsive

```csharp
[SerializeField] private float depthScaleMultiplier = 0.5f;
```

- **Controls dynamic finger depth scaling**
- How much finger depth changes with hand distance
- Formula: `dynamicDepthScale = depthScale * (1.0 + (normalized - 0.5) * multiplier)`
- Current: 0.5 (moderate scaling)
- 0 = no scaling, 1 = full scaling
- **Purpose:** Fingers should look "deeper" when hand is close

#### **Mirroring**

```csharp
[SerializeField] private bool mirrorX = true;
```

- Flips hand horizontally (typical for "selfie" camera view)
- Applied to landmark X: `x * (mirrorX ? -1 : 1)`
- **Current:** true (mirror mode)

```csharp
[SerializeField] private bool mirrorZ = false;
```

- Inverts Z relationship
- **Current:** false (closer hand = larger Z)
- When true: closer hand = smaller Z, further = larger Z
- **Use case:** Depends on desired depth direction

#### **Debug**

```csharp
[SerializeField] private bool enableDebugLogs = true;
```

- Toggles console logging every frame
- Logs: method, raw size, smoothed size, normalized, targetZ, smoothedZ, position
- **Critical for tuning** min/max hand size values

### Private Fields

```csharp
private readonly object _currentTargetLock = new();
private HandLandmarkerResult _currentTarget;
private bool _isResultReady = false;
```

- **Thread-safe result caching**
- `_currentTargetLock`: Mutex for cross-thread access
- `_currentTarget`: Latest hand data from HandLandmarkerRunner
- `_isResultReady`: Flag for main thread processing

```csharp
private Vector3 _smoothedPosition = Vector3.zero;
```

- **Smoothed parent GameObject position**
- Updated every frame with Lerp
- Prevents jittery movement

```csharp
private float _rawHandSize = 0f;
private float _smoothedHandSize = 0f;
```

- **Hand size measurement caching**
- `_rawHandSize`: Current frame's measurement
- `_smoothedHandSize`: Smoothed value used for Z calculation
- Smoothing applied: `Lerp(_smoothedHandSize, _rawHandSize, 1.0 - handSizeSmoothing)`

```csharp
private float _currentHandDistanceOffset = 0f;
```

- **Stores current Z offset** for dynamic depth scaling
- Used to scale finger depth proportionally with hand distance
- Range: minZ to maxZ

```csharp
private bool _landmarksVisible = false;
```

- **Tracks landmark GameObject visibility**
- Prevents redundant SetActive() calls
- Show/hide based on hand detection

---

## Improvements Made

### Session History (2025-10-28)

#### **Phase 1: Understanding the System**

- Analyzed HandTracker3D and HandLandmarkerRunner integration
- Explained MediaPipe coordinate normalization (0-1 range)
- Clarified two separate Z-axis systems (hand distance vs finger depth)
- Documented all variable purposes

#### **Phase 2: Initial Stability Improvements**

1. **Added named constants** (INDEX_FINGER_BASE, PINKY_FINGER_BASE)
2. **Implemented XYZ smoothing** (was only Z before)
3. **Added dead zone threshold** (0.005 → 0.015 → 0.01 → 0.02)
4. **Dynamic depth scaling** - fingers scale with hand distance
5. **Reduced distanceScale** (100 → 50) - less sensitivity
6. **Added landmark validation** - prevents crashes

#### **Phase 3: Z-Axis Correction**

- **Fixed Z to always be positive**
- Changed from offset-based (-20 to +20) to range-based (minZ to maxZ)
- Implemented normalized mapping: handSize → [0,1] → [minZ, maxZ]
- Added minHandSize/maxHandSize calibration points

#### **Phase 4: Advanced Hand Size Methods**

Implemented 8 different calculation methods:

1. IndexToPinkyBase (original)
2. WristToMiddleFinger
3. AverageMultiplePairs
4. PalmWidth (2D only)
5. **BoundingBoxDiagonal** (full hand footprint)
6. BoundingBoxArea (quadratic scaling)
7. **StableLandmarksOnly** (palm skeleton only) ⭐
8. MediaPipeZAverage (native depth)

#### **Phase 5: User Testing Feedback**

- **Tested all methods** - user feedback identified best performers
- **StableLandmarksOnly** ranked #1 (immune to fist/gestures)
- **AverageMultiplePairs** ranked #2
- Identified Z jumping issue persists across all methods
- Found instability near Z=0

#### **Phase 6: Final Stability Optimizations**

1. **Separate Z smoothing** - `zSmoothing = 0.92` (extra aggressive)
2. **Increased minZ** - 0.1 → 2.0 (avoid instability zone)
3. **Increased hand size smoothing** - 0.85 → 0.92
4. **Increased dead zone** - 0.01 → 0.02
5. **Set StableLandmarksOnly as default**
6. **Enhanced debug logging** - shows TargetZ, SmoothedZ, ZDiff

### Performance Characteristics

**Current Configuration:**

- **Method:** StableLandmarksOnly
- **X/Y Responsiveness:** Moderate (smoothing = 0.7)
- **Z Responsiveness:** Slow (zSmoothing = 0.92)
- **Stability:** High (dead zone = 0.02, aggressive smoothing)
- **Gesture Immunity:** Very High (stable landmarks only)

**Trade-offs:**

- ✅ Z is very stable, minimal jumping
- ✅ Fist/gestures don't affect position
- ⚠️ Z has noticeable lag when moving hand closer/further
- ⚠️ Z still has residual jumps from MediaPipe noise

---

## Current Configuration

### Recommended Settings (As of 2025-10-28)

```csharp
// METHOD
handSizeMethod = PalmMaxDimension

// HAND SIZE CALIBRATION (for PalmMaxDimension)
// Neutral-centered calibration
widthXMin = 0.03f; widthXMax = 0.09f;
widthYMin = 0.01f; widthYMax = 0.12f;
heightMin = 0.09f; heightMax = 0.16f;

// SMOOTHING
smoothing = 0.7f           // X/Y position (moderate)
zSmoothing = 0.92f         // Z position (very aggressive)
handSizeSmoothing = 0.92f  // Hand size measurement (very aggressive)

// Z RANGE
minZ = 2.0f   // Far from camera (stays away from 0)
maxZ = 50.0f  // Close to camera

// STABILITY
deadZoneThreshold = 0.02f  // Ignore changes < 2%

// DEPTH SCALING
depthScale = 5.0f              // Base finger depth
depthScaleMultiplier = 0.5f    // Dynamic scaling amount

// MIRRORING
mirrorX = true   // Selfie mode
mirrorZ = false  // Closer = larger Z

// DEBUG
enableDebugLogs = true  // Watch console for tuning
```

### Method-Specific Calibration Values

If changing methods, update min/max hand size:

| Method               | minHandSize | maxHandSize | Notes                              |
| -------------------- | ----------- | ----------- | ---------------------------------- |
| PalmMaxDimension     | N/A         | N/A         | Uses 3 separate ranges (see above) |
| StableLandmarksOnly  | 0.10        | 0.30        | Good alternative                   |
| AverageMultiplePairs | 0.12        | 0.25        | Alternative                        |
| BoundingBoxDiagonal  | 0.15        | 0.40        | Larger range                       |
| PalmWidth            | 0.05        | 0.18        | 2D only                            |
| MediaPipeZAverage    | -0.10       | 0.05        | INVERTED + enable mirrorZ          |

### Tuning Guide

**If Z jumps too much:**

- Increase `zSmoothing` to 0.95
- Increase `handSizeSmoothing` to 0.95
- Increase `deadZoneThreshold` to 0.03
- Increase `minZ` to 5.0

**If Z is too laggy:**

- Decrease `zSmoothing` to 0.85
- Decrease `handSizeSmoothing` to 0.85
- Accept some jumping for responsiveness

**If hand size range is wrong:**

- Watch debug logs: `RawHandSize`, `SmoothedHandSize`
- Move hand far away → note min value → set `minHandSize`
- Move hand close → note max value → set `maxHandSize`
- Ensure range covers 90% of use cases

---

## Known Issues

### 1. Z-Axis Jumping (Moderate - Partially Mitigated)

**Description:**

- Z position still jumps 1-2 units even with aggressive smoothing
- Affects all hand size methods
- More pronounced at low Z values (close to minZ)

**Root Cause:**

- MediaPipe landmark detection has inherent frame-to-frame noise
- Even stable landmarks jitter slightly in X/Y positions
- Hand size calculation amplifies this noise into Z jumps

**Current Mitigation:**

- ✅ Separate Z smoothing (0.92)
- ✅ Hand size smoothing (0.92)
- ✅ Dead zone (0.02)
- ✅ Increased minZ (2.0) to avoid unstable zone
- ✅ Using StableLandmarksOnly method

**Workarounds:**

- Accept the lag trade-off
- Could increase smoothing to 0.95+ (more lag)
- Consider post-processing filter (Kalman, exponential moving average)

**Future Fix:**

- Implement Kalman filter for Z prediction
- Use temporal coherence across multiple frames
- Calibrate per-camera/environment

---

### 2. MediaPipeZAverage Method Not Working

**Description:**

- Z value locks at minZ
- rawHandSize changes but Z doesn't respond

**Root Cause:**

- Likely inverted value range
- MediaPipe Z returns negative values when close, positive when far
- Current min/max (0.10, 0.30) doesn't match

**Attempted Fix:**

- Added documentation for proper values
- Needs: minHandSize = -0.10, maxHandSize = 0.05, mirrorZ = true

**Status:** Not tested with correct settings

---

### 3. Hand Rotation Still Affects Some Methods

**Description:**

- Flipping hand or rotating 90° changes Z in most methods
- Only partially resolved with StableLandmarksOnly

**Root Cause:**

- Hand rotation changes landmark positions in camera frame
- Even stable landmarks move when hand rotates
- 2D bounding box changes with orientation

**Current Mitigation:**

- ✅ StableLandmarksOnly is most rotation-resistant
- ✅ Smoothing helps dampen rotation effects

**Future Fix:**

- Could detect hand orientation and compensate
- Use MediaPipe's handedness data
- Apply rotation-invariant features

---

### 4. Individual Hand Size Variation

**Description:**

- minHandSize/maxHandSize calibrated for one user
- Different hand sizes need different calibration

**Root Cause:**

- Fundamental limitation of size-based depth inference
- Larger hands appear closer than they are
- Smaller hands appear further

**Current Mitigation:**

- None - hardcoded values

**Future Fix:**

- Calibration step at startup
- User holds hand at known distance
- Auto-calibrate min/max values

---

### 5. Camera-Dependent Behavior

**Description:**

- Different webcams produce different hand size ranges
- FOV, resolution, focal length all affect apparent size

**Root Cause:**

- No camera intrinsics compensation
- MediaPipe normalizes to [0,1] but doesn't account for camera properties

**Current Mitigation:**

- None - must manually tune per camera

**Future Fix:**

- Detect camera FOV
- Adjust min/max automatically
- Use camera calibration matrix

---

## Future Work

### High Priority

1. **Implement Kalman Filter for Z**

   - Predict Z trajectory
   - Smooth outliers
   - Reduce jumping without lag
   - Reference: OpenCV KalmanFilter

2. **Per-Camera Calibration System**

   - Auto-detect hand size range
   - Store calibration per device
   - UI for calibration step

3. **Test MediaPipeZAverage Properly**
   - Use correct negative value range
   - Enable mirrorZ
   - Compare accuracy vs size-based methods

### Medium Priority

4. **Exponential Moving Average**

   - Alternative to Lerp smoothing
   - Better handling of sudden movements
   - Configurable alpha parameter

5. **Rotation Compensation**

   - Detect hand orientation
   - Apply inverse rotation to size calculation
   - Make measurements rotation-invariant

6. **Multi-Frame Temporal Filtering**
   - Use last N frames for averaging
   - Outlier rejection
   - More stable than single-frame smoothing

### Low Priority

7. **Gesture Recognition Integration**

   - Detect fist, open hand, pointing
   - Adjust hand size method dynamically
   - Use different methods per gesture

8. **Performance Profiling**

   - Optimize bounding box calculations
   - Cache intermediate results
   - Reduce GC allocations

9. **Alternative Distance Methods**
   - Stereo depth (if dual cameras available)
   - Structured light depth sensors
   - Time-of-flight cameras

---

## Code Structure Reference

### File Organization

```
HandTracker3D.cs
├── Enums
│   └── HandSizeMethod (8 methods)
├── Constants
│   ├── Landmark indices (WRIST, INDEX_FINGER_BASE, etc.)
│   ├── STABLE_LANDMARKS array
│   └── HAND_CONNECTIONS [25 bone pairs]
├── Serialized Fields (Inspector)
│   ├── Landmark Prefabs [21]
│   ├── Skeleton Bones (enableSkeletonBones, boneMaterial, boneThickness)
│   ├── Screen Mapping (width, height, depthScale)
│   ├── Camera Distance Settings (method, zScaleMultiplier, min/max Z)
│   ├── Mirroring (mirrorX, mirrorZ)
│   └── Debug (enableDebugLogs)
├── Private Fields
│   ├── Thread safety (_currentTargetLock, _currentTarget, _isResultReady)
│   ├── State (_landmarksVisible)
│   └── Skeleton bones (_boneObjects, _boneTransforms)
├── Unity Lifecycle
│   ├── Start() - Initialize prefabs and bones
│   └── Update() - Process cached results
├── Public API
│   └── OnHandDataReceived() - Event handler from HandLandmarkerRunner
└── Private Methods
    ├── Initialization
    │   ├── InitializeLandmarkPrefabs()
    │   └── InitializeSkeletonBones()
    ├── Update Logic
    │   ├── SyncNow() - Main thread processing
    │   ├── ProcessHandData() - Orchestrates calculation
    │   ├── ValidateLandmarks() - Safety checks
    │   ├── CalculateHandSize() - Method switcher
    │   ├── UpdateHandPosition() - X/Y/Z calculation
    │   ├── UpdateLandmarkPositions() - Individual landmark placement
    │   └── UpdateSkeletonBones() - Bone positioning/rotation/scaling
    └── Visibility
        ├── ShowHand()
        ├── HideHand()
        └── ToggleLandmarks() - Landmarks + bones
```

### Key Method Flow

```
OnHandDataReceived (any thread)
    ↓ (locks, clones data)
_isResultReady = true
    ↓
Update() (main thread)
    ↓ (if flag set)
SyncNow()
    ↓ (locks, validates)
ProcessHandData()
    ├── ValidateLandmarks() → Check if data valid
    ├── UpdateHandPosition()
    │   ├── Calculate hand center (avg X/Y)
    │   ├── CalculateHandSize() → PalmMaxDimension calculation
    │   ├── Scale rawHandSize → scaledZ
    │   ├── Apply mirrorZ if enabled
    │   ├── Clamp to Z range → Clamp(scaledZ, minZ, maxZ)
    │   └── Update transform.localPosition
    ├── UpdateLandmarkPositions()
    │   └── Position each landmark prefab (relative to parent)
    └── UpdateSkeletonBones()
        ├── For each bone connection:
        │   ├── Get start/end landmark positions
        │   ├── Calculate midpoint and direction
        │   ├── Position bone at midpoint
        │   ├── Rotate bone to align with direction
        │   └── Scale bone to match distance
        └── (uses cached transforms for performance)
```

### Dependencies

**HandLandmarkerRunner.cs**

- Provides: `OnHandLandmarksResultOutput` UnityEvent
- Data type: `HandLandmarkerResult`
- Contains: `handLandmarks[0].landmarks` (21 points)

**MediaPipe Hand Landmark Format**

```csharp
class NormalizedLandmark
{
    float x;  // 0-1, percentage of screen width
    float y;  // 0-1, percentage of screen height
    float z;  // Relative depth (negative = close, positive = far)
}
```

**Landmark Index Reference**

```
0: Wrist
1-4: Thumb (base → tip)
5-8: Index (base → tip)
9-12: Middle (base → tip)
13-16: Ring (base → tip)
17-20: Pinky (base → tip)

STABLE_LANDMARKS = [0, 5, 9, 13, 17] (bases only)
```

---

## Testing Checklist

When modifying or debugging:

- [ ] Test with **fist gesture** - Z should stay stable
- [ ] Test with **finger spreading** - Z should stay stable
- [ ] Test **hand rotation/flipping** - Z should minimally change
- [ ] Test **vertical movement** (Y) - Z should not correlate
- [ ] Test **horizontal movement** (X) - Z should not correlate
- [ ] Test **actual depth movement** - Z should smoothly follow
- [ ] Check **debug logs** - verify hand size values are in expected range
- [ ] Verify **no console errors** - especially with invalid landmarks
- [ ] Test **hand disappearing** - landmarks should hide gracefully
- [ ] Test **re-entry** - hand reappears smoothly without jumps

---

## Debug Log Interpretation

### Example Output

```
Method: StableLandmarksOnly, RawHandSize: 0.1823, SmoothedHandSize: 0.1801,
Normalized: 0.401, TargetZ: 21.25, SmoothedZ: 21.18,
FinalPos: (1.08, -1.38, 21.18), ZDiff: 0.07
```

**Analysis:**

- `RawHandSize: 0.1823` - Current frame measurement

  - Between min (0.10) and max (0.30) ✓
  - Closer to max → hand is relatively close

- `SmoothedHandSize: 0.1801` - After smoothing

  - Difference from raw: 0.0022 (small, smoothing working)

- `Normalized: 0.401` - Mapped to [0, 1]

  - 40% of the way from min to max hand size

- `TargetZ: 21.25` - Calculated Z before smoothing

  - 40% of the way from minZ (2.0) to maxZ (50.0)
  - 2.0 + 0.401 \* (50 - 2) = 21.25 ✓

- `SmoothedZ: 21.18` - After Z smoothing

  - Difference: 0.07 (smoothing active)

- `ZDiff: 0.07` - How much smoothing is dampening
  - Small value = close to target (stable)
  - Large value = lots of smoothing lag

**Red Flags:**

- RawHandSize outside min/max → recalibrate range
- ZDiff > 5.0 consistently → too much smoothing lag
- SmoothedHandSize not changing → dead zone too large or frozen
- TargetZ at exactly minZ or maxZ → clamping, adjust range

---

## Handoff Notes for Next AI

### Context Summary

This is a Unity component for visualizing MediaPipe hand tracking in 3D. The core challenge is **inferring depth (Z) from 2D camera data** based on apparent hand size. We've implemented and tested 8 different hand size calculation methods, with **StableLandmarksOnly** being the best performer (uses only palm skeleton, immune to gestures).

### Current State

- ✅ Functional and stable
- ✅ Best method identified through user testing
- ⚠️ Z still has residual jumping (1-2 units)
- ⚠️ Heavy smoothing creates lag trade-off
- ❌ MediaPipeZAverage method not working (needs inverted values)

### If User Reports Issues

**"Z is jumping too much"**

1. Check debug logs - is RawHandSize changing drastically?
2. Increase `zSmoothing` to 0.95
3. Increase `deadZoneThreshold` to 0.03
4. Ask: Is it jumping at specific Z values? (might need higher minZ)

**"Z is too slow/laggy"**

1. Reduce `zSmoothing` to 0.80-0.85
2. Reduce `handSizeSmoothing` to 0.80-0.85
3. Accept some jumping for responsiveness

**"Gestures affect Z"**

1. Verify `handSizeMethod = PalmMaxDimension`
2. Check which gestures - fist should be immune
3. If rotation affects it, this is expected (unavoidable with 2D methods)

**"Hand size values are wrong"**

1. Enable debug logs
2. Have user move hand far away, note RawHandSize
3. Have user move hand close, note RawHandSize
4. Set minHandSize and maxHandSize to observed values
5. Add 10% padding on both ends

**"Z is backwards"**

1. Toggle `mirrorZ` in Inspector
2. Check method - MediaPipeZAverage needs mirrorZ=true

### Recommended Next Steps

1. **Implement Kalman filter** - Will significantly reduce jumping without lag
2. **Fix MediaPipeZAverage** - Might be more accurate than size-based methods
3. **Add calibration UI** - Auto-detect hand size range per user/camera

### Code Modification Tips

- All hand size methods are in `CalculateHandSize()` - easy to add new methods
- Smoothing pipeline is in `UpdateHandPosition()` - modify for different algorithms
- Constants at top define landmark indices - don't hardcode numbers elsewhere
- Thread safety is already handled - don't remove locks
- Debug logs are critical for tuning - keep them or make toggleable

### Critical Concepts to Understand

1. **Two Z systems:** Parent GameObject Z (hand distance) vs Landmark local Z (finger depth)
2. **Normalized coords:** MediaPipe outputs [0, 1], we scale to Unity units
3. **Smoothing pipeline:** Raw size → smooth → dead zone → normalize → map to Z → smooth Z
4. **Why jumping persists:** Inherent noise in ML-based landmark detection
5. **Trade-off:** Stability vs responsiveness (can't eliminate both lag and jumping)

---

## Removed Methods Archive

**Date Removed:** 2025-11-05
**Reason:** Simplification - reducing complexity to test methods scientifically one at a time

The following methods were removed to clean up the codebase. They are preserved here for reference.

### Removed: IndexToPinkyBase

```csharp
case HandSizeMethod.IndexToPinkyBase:
    // Distance between finger bases (original method)
    return Vector3.Distance(
        new Vector3(landmarks[INDEX_FINGER_BASE].x, landmarks[INDEX_FINGER_BASE].y, landmarks[INDEX_FINGER_BASE].z),
        new Vector3(landmarks[PINKY_FINGER_BASE].x, landmarks[PINKY_FINGER_BASE].y, landmarks[PINKY_FINGER_BASE].z)
    );
```

**Issues:** Affected by hand rotation, finger spreading, 3D distance includes Y, pinky movement

---

### Removed: WristToMiddleFinger

```csharp
case HandSizeMethod.WristToMiddleFinger:
    // Wrist to middle finger tip - more stable as it doesn't change with hand rotation
    return Vector3.Distance(
        new Vector3(landmarks[WRIST].x, landmarks[WRIST].y, landmarks[WRIST].z),
        new Vector3(landmarks[MIDDLE_FINGER_TIP].x, landmarks[MIDDLE_FINGER_TIP].y, landmarks[MIDDLE_FINGER_TIP].z)
    );
```

**Issues:** Severely affected by fist, pointing gestures, orientation dependent, 3D distance includes X/Y

---

### Removed: BoundingBoxDiagonal

```csharp
case HandSizeMethod.BoundingBoxDiagonal:
    // Calculate 2D bounding box of ALL landmarks (most stable)
    // This measures overall hand size in screen space
    float minX = float.MaxValue, maxX = float.MinValue;
    float minY = float.MaxValue, maxY = float.MinValue;

    foreach (var landmark in landmarks)
    {
        if (landmark.x < minX) minX = landmark.x;
        if (landmark.x > maxX) maxX = landmark.x;
        if (landmark.y < minY) minY = landmark.y;
        if (landmark.y > maxY) maxY = landmark.y;
    }

    float width = maxX - minX;
    float height = maxY - minY;
    return Mathf.Sqrt(width * width + height * height); // Diagonal
```

**Issues:** Affected by fists (curled fingers shrink box), extreme finger extensions expand box

---

### Removed: BoundingBoxArea

```csharp
case HandSizeMethod.BoundingBoxArea:
    // Calculate 2D bounding box area
    float minX2 = float.MaxValue, maxX2 = float.MinValue;
    float minY2 = float.MaxValue, maxY2 = float.MinValue;

    foreach (var landmark in landmarks)
    {
        if (landmark.x < minX2) minX2 = landmark.x;
        if (landmark.x > maxX2) maxX2 = landmark.x;
        if (landmark.y < minY2) minY2 = landmark.y;
        if (landmark.y > maxY2) maxY2 = landmark.y;
    }

    float width2 = maxX2 - minX2;
    float height2 = maxY2 - minY2;
    return width2 * height2; // Area
```

**Issues:** Non-linear scaling, hard to tune min/max values, same issues as BoundingBoxDiagonal

---

## Removed Features Archive

**Date Removed:** 2025-11-05
**Reason:** Starting with raw measurements to scientifically validate each feature's contribution

### Removed: Smoothing System

The following smoothing variables and code were removed:

```csharp
// Removed Variables
[SerializeField] private float smoothing = 0.7f; // X/Y smoothing
[SerializeField] private float zSmoothing = 0.92f; // Z extra smoothing
[SerializeField] private float handSizeSmoothing = 0.92f; // Hand size smoothing

// Removed from UpdateHandPosition():
// Hand size smoothing
float targetHandSize = Mathf.Lerp(_smoothedHandSize, _rawHandSize, 1.0f - handSizeSmoothing);

// X/Y smoothing
float smoothedX = Mathf.Lerp(_smoothedPosition.x, targetX, 1.0f - smoothing);
float smoothedY = Mathf.Lerp(_smoothedPosition.y, targetY, 1.0f - smoothing);

// Z extra smoothing
float smoothedZ = Mathf.Lerp(_smoothedPosition.z, targetZ, 1.0f - zSmoothing);
```

**Reason for removal:** Need to see raw measurement stability before adding smoothing

---

### Removed: Dead Zone Threshold

```csharp
// Removed Variable
[SerializeField] private float deadZoneThreshold = 0.02f;

// Removed from UpdateHandPosition():
if (Mathf.Abs(targetHandSize - _smoothedHandSize) < deadZoneThreshold)
{
    targetHandSize = _smoothedHandSize; // Keep previous value
}
```

**Reason for removal:** Dead zone masks the true behavior of measurements

---

### Removed: Dynamic Depth Scale

```csharp
// Removed Variable
[SerializeField] private float depthScaleMultiplier = 0.5f;

// Removed from UpdateLandmarkPositions():
float normalizedDistance = Mathf.InverseLerp(minZ, maxZ, _currentHandDistanceOffset);
float dynamicDepthScale = depthScale * (1.0f + (normalizedDistance - 0.5f) * depthScaleMultiplier);
```

**Reason for removal:** Focus on hand distance accuracy first, finger depth scaling is secondary

---

### Removed: Complex Distance Calculation Pipeline

The multi-stage pipeline was simplified from:

```
1. Calculate Raw Hand Size
2. Smooth Hand Size (handSizeSmoothing = 0.92)
3. Apply Dead Zone (deadZoneThreshold = 0.02)
4. Normalize to [0, 1]
5. Map to Z Range
6. Apply Mirror (optional)
7. Smooth Z Position (zSmoothing = 0.92)
8. Update Parent Transform
```

To a simple direct approach for testing raw measurements.

---

## Phase 3: Scientific Testing & PalmMaxDimension Development

**Date:** 2025-11-05
**Approach:** Test each method scientifically, identify issues, iterate solutions

---

### Testing Session 1: MediaPipe Native Z

**Method:** MediaPipeZAverage - directly use MediaPipe's built-in Z depth estimation

**Implementation:**

```csharp
// Average Z from stable landmarks (wrist + finger bases)
float zSum = 0f;
foreach (int idx in STABLE_LANDMARKS) {
    zSum += landmarks[idx].z;
}
return -zSum / STABLE_LANDMARKS.Length; // Negate: MediaPipe larger Z = further
```

**Scale:** zScaleMultiplier = 300 (MediaPipe Z values are tiny ~0.01)

**Results:**

- ✅ Logic correct: closer hand = larger Z value
- ❌ **Very shaky** even when hand held still
- ❌ **Flipping hand affects Z** - shouldn't happen for pure distance
- ❌ **Curling fingers affects Z** slightly

**Conclusion:** MediaPipe's Z is influenced by hand pose/orientation, not just distance. ML model has inherent noise. **Method abandoned.**

---

### Testing Session 2: PalmWidth (X-only)

**Method:** Horizontal distance between index and pinky finger bases

**Implementation:**

```csharp
return Mathf.Abs(landmarks[INDEX_FINGER_BASE].x - landmarks[PINKY_FINGER_BASE].x);
```

**Scale:** zScaleMultiplier = 100 (better than 300)

**Results:**

- ✅ **Very smooth** when hand faces camera
- ✅ Pure 2D geometry - no ML noise
- ❌ **Vulnerable to tilting** - rotating hand makes X-distance shrink even though depth unchanged

**Conclusion:** Good baseline but rotation-sensitive. Need rotation resistance.

---

### Testing Session 3: PalmMaxDimension Evolution

**Goal:** Create rotation-resistant method by using max of multiple measurements

#### Iteration 1: Max(Width2D, Height2D)

```csharp
// Palm width: 2D distance between index and pinky bases
Vector2 indexBase2D = new Vector2(landmarks[INDEX_FINGER_BASE].x, landmarks[INDEX_FINGER_BASE].y);
Vector2 pinkyBase2D = new Vector2(landmarks[PINKY_FINGER_BASE].x, landmarks[PINKY_FINGER_BASE].y);
float palmWidth2D = Vector2.Distance(indexBase2D, pinkyBase2D);

// Palm height: 2D distance from wrist to middle finger base
Vector2 wrist2D = new Vector2(landmarks[WRIST].x, landmarks[WRIST].y);
Vector2 middleBase2D = new Vector2(landmarks[MIDDLE_FINGER_BASE].x, landmarks[MIDDLE_FINGER_BASE].y);
float palmHeight2D = Vector2.Distance(wrist2D, middleBase2D);

return Mathf.Max(palmWidth2D, palmHeight2D);
```

**Problem Discovered:** Index and pinky bases are at same knuckle level, so Y distance ≈ 0. PalmWidth2D was essentially just X distance. **Waving still broken.**

#### Iteration 2: Fix Height Measurement

```csharp
// Changed to proper height: wrist to middle finger BASE (not tip)
float palmHeight2D = Vector2.Distance(wrist, middleFingerBase);
```

**Results:**

- ✅ Flipping/rotation solved
- ❌ **Waving problem fixed** BUT **wrist bending problem introduced**

**Wrist Bending Issue:**

- When bending wrist forward, both index and pinky shift vertically in screen space
- PalmWidth2D includes Y component → value changes → Z changes incorrectly
- User reports: "bending my wrist makes Z change even though distance is same"

#### Iteration 3: Three Separate Measurements

```csharp
// Separate X and Y components
float palmWidthX = Mathf.Abs(landmarks[INDEX_FINGER_BASE].x - landmarks[PINKY_FINGER_BASE].x);
float palmWidthY = Mathf.Abs(landmarks[INDEX_FINGER_BASE].y - landmarks[PINKY_FINGER_BASE].y);
float palmHeight2D = Vector2.Distance(wrist2D, middleBase2D);

return Mathf.Max(palmWidthX, palmWidthY, palmHeight2D);
```

**Theory:**

- **Normal/Bent wrist:** PalmWidthX wins (stable, ignores vertical shift)
- **Waving:** PalmWidthY wins (when X collapses, Y grows)
- **Rotation:** PalmHeight2D wins (vertical orientation)

**Problem Discovered:** **PalmHeight2D dominates unfairly!**

**Root Cause:**

- PalmHeight2D has larger raw values (~0.12-0.15)
- PalmWidthX has smaller raw values (~0.05-0.09)
- `max(0.06, 0.03, 0.14) = 0.14` → Height always wins
- Doesn't switch to WidthX when bending wrist

**User observation:** "PalmHeight2D favored most of the time, only switches when hand completely flat"

---

### Solution: Normalization

**Concept:** Normalize each measurement to its own 0-1 range BEFORE taking max

**Why it works:** Fair comparison - each measurement competes relative to its own range, not absolute values

#### Implementation:

```csharp
// Define expected ranges for each measurement
float widthXMin = 0.03f, widthXMax = 0.09f;
float widthYMin = 0.01f, widthYMax = 0.12f;
float heightMin = 0.09f, heightMax = 0.16f;

// Normalize to 0-1
float normWidthX = Mathf.InverseLerp(widthXMin, widthXMax, palmWidthX);
float normWidthY = Mathf.InverseLerp(widthYMin, widthYMax, palmWidthY);
float normHeight = Mathf.InverseLerp(heightMin, heightMax, palmHeight2D);

// Fair competition!
float maxNormalized = Mathf.Max(normWidthX, normWidthY, normHeight);

return maxNormalized; // Returns 0-1 value
```

---

### Calibration Strategy Discovery

**Two Approaches Tested:**

#### Approach 1: Distance-Based Calibration (FAILED)

```csharp
// Min = hand FAR, Max = hand CLOSE
widthXMin = 0.02f, widthXMax = 0.20f;
heightMin = 0.06f, heightMax = 0.36f;
```

**Problems:**

- ❌ Normalized values exceed 1.0 when very close → clamping issues
- ❌ Rotation stability lost
- ❌ Z range limited (3-9 instead of 2-50)

#### Approach 2: Neutral-Centered Calibration (SUCCESS) ⭐

```csharp
// Center ranges on NEUTRAL hand position
// Neutral: widthX=0.0585, height=0.1241
widthXMin = 0.03f, widthXMax = 0.09f;   // Centers at 0.06
heightMin = 0.09f, heightMax = 0.16f;   // Centers at 0.125
```

**Key Insight (User discovered):**

> "In neutral position, width and height should both normalize to ~0.5 after calibration.
> When I tilt/bend, THEN they separate. But in default position they should be equal."

**Why it works:**

- Neutral position: normWidthX ≈ 0.48, normHeight ≈ 0.49 (both ~0.5)
- Bending wrist: normWidthX stays 0.48, normHeight drops to 0.2 → WidthX wins!
- Waving: normWidthX drops, normWidthY rises → WidthY wins!
- Normalized value can EXCEED 1.0 when very close (allows full depth range)

**Results:**

- ✅ Bending wrist: Z stable
- ✅ Fist: Z stable
- ✅ Tilting: Z stable
- ✅ Switches measurements appropriately
- ⚠️ Z range still limited (need to fix scale)

---

### Current Issues & Solutions

#### Issue 1: Limited Z Range

**Problem:** User stuck at Z=3-9 even with minZ=2, maxZ=25

**Root Cause:**

```csharp
// OLD (broken):
float result = Mathf.Lerp(widthXMin, widthXMax, maxNormalized); // Maps back to 0.03-0.09
scaledZ = result * 100; // 3-9 only!

// NEW (fixed):
return maxNormalized; // Returns 0-1 directly
scaledZ = maxNormalized * zScaleMultiplier; // Full range!
```

**Solution:** Return normalized value (0-1), scale later

- Hand far: norm=0.2 × 25 = 5.0
- Hand neutral: norm=0.5 × 25 = 12.5
- Hand close: norm=2.0 × 25 = 50 (can exceed 1.0!)

**Recommended:** `zScaleMultiplier = 25` (adjust to taste)

---

### Visual Depth Perception Issues

**User observation:** "Landmarks get smaller/larger but don't FEEL like depth movement"

**Attempted Fix 1: Perspective Scaling**

```csharp
float perspectiveScale = z / referenceZ;
float x = (landmark.x - 0.5f) * screenWidth * perspectiveScale;
```

**Result:** ❌ Made it worse - double-scaling effect

**User correction (100% right):**

> "X/Y are 2D screen-space coordinates. Camera handles perspective automatically based on Z.
> We don't need to scale them manually."

**Final Fix:** Removed all manual perspective scaling

- Let perspective camera handle depth compression naturally
- Landmarks positioned at correct world-space coords
- Camera projects them correctly

---

### Removed Features (For Simplicity)

**Removed Variables:**

- `smoothing` (X/Y smoothing)
- `zSmoothing` (Z extra smoothing)
- `handSizeSmoothing` (hand size measurement smoothing)
- `deadZoneThreshold` (ignore small changes)
- `depthScaleMultiplier` (dynamic finger depth scaling)
- `referenceZ` (perspective scaling reference)

**Reason:** Test raw measurements first, add complexity only if needed

**Current State:** NO smoothing - pure raw values

---

## Current Configuration (Working State)

**Date:** 2025-11-05 End of Session

### Method: PalmMaxDimension

```csharp
handSizeMethod = PalmMaxDimension
```

### Scale Settings:

```csharp
zScaleMultiplier = 25.0f  // Recommended (adjust 10-50 range)
minZ = 2.0f
maxZ = 50.0f
```

### Calibration Ranges (Neutral-Centered):

```csharp
// Based on neutral position: widthX=0.0585, height=0.1241
widthXMin = 0.03f, widthXMax = 0.09f;   // Center: 0.06
widthYMin = 0.01f, widthYMax = 0.12f;   // For waving
heightMin = 0.09f, heightMax = 0.16f;   // Center: 0.125
```

### How to Re-calibrate for Different Camera/Hand:

1. **Find neutral values:** Hold hand flat facing camera at comfortable distance
2. **Watch debug logs:**
   ```
   PalmWidthX: 0.0??? (norm: ???)
   PalmHeight2D: 0.1??? (norm: ???)
   ```
3. **Adjust ranges** so both normalize to ~0.5:

   ```csharp
   widthXMin = neutralWidthX - 0.03f
   widthXMax = neutralWidthX + 0.03f

   heightMin = neutralHeight - 0.03f
   heightMax = neutralHeight + 0.03f
   ```

---

## What Works ✅

- ✅ **Wrist bending:** Z stable (PalmWidthX ignores vertical shift)
- ✅ **Fist/finger curling:** Z stable (uses finger bases only)
- ✅ **Hand rotation/tilting:** Z stable (max picks best measurement)
- ✅ **Waving (X-axis tilt):** Z stable (PalmWidthY captures this)
- ✅ Smooth tracking when facing camera
- ✅ Geometry-based (no ML noise like MediaPipe Z)

## What Doesn't Work ❌

- ❌ **Z range may feel limited** - need to tune zScaleMultiplier for camera distance
- ⚠️ **No smoothing** - raw jitter visible (trade-off for responsiveness)
- ⚠️ **PalmWidthY rarely used** - might not be necessary (waving uncommon use case)

---

## Next Steps / To-Do

### High Priority:

1. **Test zScaleMultiplier values** (10, 25, 50) - find sweet spot for depth range
2. **Verify Z range issue resolved** - can user reach minZ and maxZ?
3. **Consider adding light smoothing** - if raw jitter too distracting
   - Start with simple exponential smoothing: `z = lerp(prevZ, currentZ, 0.3)`
   - Add only if necessary

### Medium Priority:

4. **Test edge cases:**
   - Very close hand (almost touching camera)
   - Very far hand (at edge of tracking range)
   - Rapid movements
5. **Optimize calibration ranges** for different users/cameras
6. **Consider making calibration ranges Inspector fields** for easy tuning

### Low Priority:

7. **Evaluate if PalmWidthY needed** - rarely used, might simplify to just 2 measurements
8. **Document final "production-ready" settings** once stable

---

## Key Learnings

### 1. Normalization is Critical for Multi-Measurement Systems

Raw values have different scales → one always dominates → normalize first!

### 2. Calibration Strategy Matters More Than Implementation

- Distance-based: Good for range, bad for rotation stability
- Neutral-centered: Good for rotation stability, can still achieve full range

### 3. User Testing Reveals Subtle Issues

- "Wrist bending problem" - impossible to predict without testing
- "Y shift in palmWidth2D" - required deep understanding of coordinate system

### 4. Simpler is Better (Usually)

- Started with 8 methods + aggressive smoothing
- Current: 1 method, no smoothing, better results

### 5. MediaPipe's Built-in Z is Unreliable

Despite ML sophistication, simple geometry (PalmMaxDimension) outperforms

---

## Conclusion

This documentation provides a complete picture of HandTracker3D's functionality, evolution, and current state.

**Phase 1 (2025-10-28):** Built complex system with 8 methods and aggressive smoothing
**Phase 2 (2025-11-05 Morning):** Simplified to test raw measurements scientifically
**Phase 3 (2025-11-05 Afternoon):** Developed PalmMaxDimension with normalized multi-measurement approach

**Current Status:** PalmMaxDimension method working well for rotation resistance

**Last updated:** 2025-11-12
**Status:** Active development - player movement and physics collision setup
**Current State:** Hand tracking, skeleton rendering, pinch-to-grab, and WASD movement implemented
**Next Session:** Two-handed tracking, then transition to hands-only locomotion (no keyboard/mouse)

---

## Phase 4: Skeleton Bones Implementation & Optimization

**Date:** 2025-11-12
**Goal:** Add visual skeleton structure connecting landmarks, optimize performance

### Session Log

#### Initial Implementation: LineRenderer Approach (FAILED)

**Attempt:** Used Unity LineRenderer components to draw lines between landmarks
**Implementation:**

- 25 LineRenderer components created (one per bone connection)
- Configured with startWidth/endWidth, material, color
- Updated positions each frame

**Problems Discovered:**

- Lines rendered **behind sphere landmarks** (rendering order issues)
- Line width parameter ineffective - even `lineWidth = 50` produced invisible lines
- Poor depth perception in 3D space

**User Feedback:** "Lines are behind the sphere prefabs and super thin"

#### Solution: 3D Cylinder Primitives (SUCCESS) ✅

**Approach:** Replace LineRenderers with actual 3D cylinder GameObjects

**Implementation:**

1. Create 25 cylinder primitives via `GameObject.CreatePrimitive(PrimitiveType.Cylinder)`
2. Position each at midpoint between connected landmarks
3. Rotate using `Quaternion.FromToRotation(Vector3.up, direction)`
4. Scale to match distance: `Vector3(thickness, distance * 0.5f, thickness)`

**Results:**

- ✅ Proper depth rendering
- ✅ Bones visible through and around spheres
- ✅ Thickness parameter works as expected
- ✅ Natural 3D integration with scene

### Performance Optimizations Applied

#### 1. Transform Caching

**Before:**

```csharp
_boneObjects[i].transform.localPosition = midpoint;
_boneObjects[i].transform.localRotation = rotation;
_boneObjects[i].transform.localScale = scale;
```

**After:**

```csharp
// Cache during initialization
_boneTransforms[i] = boneObj.transform;

// Use cached reference in update
Transform boneTransform = _boneTransforms[i];
boneTransform.localPosition = midpoint;
boneTransform.localRotation = rotation;
boneTransform.localScale = scale;
```

**Impact:** Eliminates 75 transform lookups per frame (25 bones × 3 accesses)

#### 2. Efficient Math Operations

**Optimizations:**

- `(startPos + endPos) * 0.5f` instead of `(startPos + endPos) / 2f`
- `distance * 0.5f` instead of `distance / 2f`
- Cached landmark GameObject references before position access

#### 3. Early Validation

**Flow:**

```csharp
// Validate indices first
if (startIdx >= landmarkPrefabs.Length || endIdx >= landmarkPrefabs.Length)
    continue;

// Cache references
GameObject startLandmark = landmarkPrefabs[startIdx];
GameObject endLandmark = landmarkPrefabs[endIdx];

// Null checks
if (startLandmark == null || endLandmark == null)
    continue;

// Zero-length check
if (distance < 0.001f)
    continue;
```

**Impact:** Skips unnecessary calculations for invalid/missing landmarks

#### 4. Rendering Optimizations

**Settings Applied:**

- `shadowCastingMode = ShadowCastingMode.Off` (no shadow rendering)
- `receiveShadows = false` (no shadow calculations)
- Collider components destroyed (no physics overhead)

**Impact:** Reduced per-bone rendering cost

### Code Structure Changes

**New Constants:**

```csharp
private static readonly int[,] HAND_CONNECTIONS = new int[,] { ... }; // 25 connections
```

**New Fields:**

```csharp
[SerializeField] private bool enableSkeletonBones = true;
[SerializeField] private Material boneMaterial;
[SerializeField] private float boneThickness = 0.05f;

private GameObject[] _boneObjects;
private Transform[] _boneTransforms; // Cached for performance
```

**New Methods:**

- `InitializeSkeletonBones()` - Called in Start()
- `UpdateSkeletonBones()` - Called in ProcessHandData()
- Updated `ToggleLandmarks()` to include bone visibility

### Testing Results

**Visual Quality:**

- Bones clearly visible in 3D space
- Proper depth perception with perspective camera
- Clean connections between all landmarks

**Performance:**

- No noticeable FPS impact (25 cylinders + 21 spheres = 46 objects)
- Smooth updates with hand movement
- Transform caching eliminated GC allocations

**Functionality:**

- Bones show/hide automatically with hand detection
- Thickness adjustable in Inspector
- Optional material override supported

### Lessons Learned

1. **LineRenderer Limitations:** Not suitable for 3D spatial connections, better for UI/2D effects
2. **Primitive Advantage:** Unity primitives integrate naturally with 3D rendering pipeline
3. **Caching Impact:** Transform caching reduced repeated property lookups significantly
4. **Early Validation:** Continue statements prevent wasteful calculations on invalid data

### Current Configuration

**Recommended Settings:**

```csharp
enableSkeletonBones = true
boneMaterial = null (uses Unity default)
boneThickness = 0.05f (adjust based on landmark scale)
```

**Adjustments Needed:**

- If bones too thick: reduce `boneThickness` to 0.02-0.03
- If bones too thin: increase `boneThickness` to 0.08-0.10
- For custom color: assign material with desired color/shader

---

## Phase 5: Pinch-to-Grab Interaction System

**Date:** 2025-11-12
**Goal:** Implement intuitive hand-object interaction using pinch gestures

### Overview

A complete grab system that allows users to pick up and manipulate 3D objects using natural pinch gestures (thumb tip to index finger tip). The system uses Unity's layer-based collision detection to separate hand landmarks from grabbable objects, enabling realistic physics while preventing self-grabbing.

---

### Architecture: Three-Component System

#### **1. PinchDetector.cs**

**Purpose:** Detects pinch gestures and provides pinch state/position

**Functionality:**

- Monitors distance between thumb tip (landmark 4) and index finger tip (landmark 8)
- Implements hysteresis (different grab/release thresholds) to prevent flickering
- Emits UnityEvents for pinch start/release
- Provides real-time pinch point (midpoint between fingers)

**Configuration:**

```csharp
[SerializeField] private float pinchThreshold = 0.8f;      // Distance to trigger pinch
[SerializeField] private float releaseThreshold = 1.2f;    // Distance to release (prevents flicker)
[SerializeField] private bool enableDebugVisualization = true;
[SerializeField] private bool enableDebugLogs = false;
```

**Public API:**

```csharp
bool IsPinching { get; }              // Current pinch state
Vector3 PinchPoint { get; }           // World position of pinch midpoint
float CurrentPinchDistance { get; }   // Real-time finger distance
UnityEvent OnPinchStart               // Fired when pinch begins
UnityEvent OnPinchRelease             // Fired when pinch ends
```

**Debug Visualization:**

- Yellow/green line between thumb and index tips
- Cyan/green sphere at pinch point
- Red wireframe sphere showing threshold radius

---

#### **2. GrabController.cs**

**Purpose:** Handles grabbing/releasing objects based on pinch events

**Functionality:**

- Listens to PinchDetector events (OnPinchStart/Release)
- Finds nearest grabbable object using `Physics.OverlapSphere`
- Maintains grab offset (object doesn't snap to fingers)
- Handles Rigidbody physics (kinematic toggling)
- Optional throw velocity on release

**Configuration:**

```csharp
[Header("Grab Settings")]
[SerializeField] private float grabRadius = 1.0f;
[SerializeField] private LayerMask grabbableLayer;        // Set to "Grabbable" layer only
[SerializeField] private bool useClosestObject = true;

[Header("Physics")]
[SerializeField] private bool maintainPhysics = false;    // Keep physics active while grabbed
[SerializeField] private bool applyThrowVelocity = false; // Apply velocity on release
```

**Grab Flow:**

```
OnPinchStart → FindNearestGrabbableObject() → GrabObject()
    ↓
UpdateGrabbedObjectPosition() (every frame while pinching)
    ↓
OnPinchRelease → ReleaseObject() → (optional) Apply throw velocity
```

**Debug Visualization:**

- Yellow/green wire sphere = grab radius around pinch point
- Cyan line = connection to grabbed object

---

#### **3. GrabbableObject.cs**

**Purpose:** Marks objects as grabbable, provides hooks for custom behavior

**Functionality:**

- Component-based tagging for grabbable objects
- Custom grab offset support
- OnGrabbed/OnReleased event callbacks
- Optional highlight effect (future feature)

**Configuration:**

```csharp
[SerializeField] private bool customGrabOffset = false;
[SerializeField] private Vector3 grabOffsetOverride = Vector3.zero;
[SerializeField] private bool highlightWhenNearby = false;  // Future: proximity highlight
```

**Public API:**

```csharp
bool IsGrabbed { get; }
Vector3 CustomGrabOffset { get; }
void OnGrabbed()      // Called when grabbed
void OnReleased()     // Called when released
```

---

### Layer System: Preventing Self-Grabbing

**Problem Encountered:**
Initial implementation allowed GrabController to grab hand landmark spheres (landmarks have colliders for physics). When pinching, index finger landmark (landmark 8) was closest to pinch point → system grabbed user's own finger → glitchy behavior.

**Solution: Unity Layers**

Created two separate layers with different purposes:

#### **Layer: HandLandmarks**

- **Purpose:** Enable hand-object collision without being grabbable
- **Applied to:** All 21 landmark GameObjects
- **Components:**
  - SphereCollider (for physics interaction)
  - Rigidbody (kinematic, no gravity)
- **Behavior:** Can push/collide with objects, but GrabController ignores them

#### **Layer: Grabbable**

- **Purpose:** Mark objects that can be grabbed with pinch
- **Applied to:** User-created objects (cubes, props, etc.)
- **Components:**
  - Collider (any type: box, sphere, mesh)
  - Rigidbody (optional, for physics/throwing)
- **Behavior:** Detected by GrabController, can be grabbed

**GrabController Configuration:**

```csharp
grabbableLayer = LayerMask for "Grabbable" only
```

Only searches "Grabbable" layer in `Physics.OverlapSphere`, completely ignoring hand landmarks.

---

### Physics Implementation

#### **Hand Landmarks (Kinematic Rigidbodies)**

**Code (HandTracker3D.cs:153-183):**

```csharp
// Set to HandLandmarks layer
landmarkPrefabs[i].layer = LayerMask.NameToLayer("HandLandmarks");

// Add/ensure collider exists
Collider col = landmarkPrefabs[i].GetComponent<Collider>();
if (col == null)
{
    col = landmarkPrefabs[i].AddComponent<SphereCollider>();
}

// Add kinematic rigidbody
Rigidbody rb = landmarkPrefabs[i].AddComponent<Rigidbody>();
rb.isKinematic = true;  // Position controlled by script, not physics
rb.useGravity = false;
```

**Why Kinematic:**

- Landmarks move via `transform.position` (updated every frame from MediaPipe data)
- Kinematic rigidbodies can push other objects without being affected by forces
- No gravity, no velocity - pure position control

#### **Grabbable Objects (Dynamic Rigidbodies)**

**Recommended Setup:**

```csharp
Rigidbody (on grabbable object):
- Use Gravity = false (prevents falling before grabbed)
- Is Kinematic = false (allows physics)
- Mass = 1 (adjust for feel)
```

**During Grab:**

```csharp
// GrabController temporarily disables physics
_grabbedRigidbody.isKinematic = true;  // Disable physics forces
// Position updated directly: transform.position = pinchPoint + offset
```

**On Release:**

```csharp
// Restore physics
_grabbedRigidbody.isKinematic = _wasKinematic;  // Restore original state

// Optional: Apply throw velocity
if (applyThrowVelocity)
{
    Vector3 velocity = (currentPinchPoint - previousPinchPoint) / Time.deltaTime;
    _grabbedRigidbody.linearVelocity = velocity;
}
```

---

### Implementation Details

#### **Pinch Detection Algorithm**

**Hysteresis State Machine:**

```csharp
// State: Not Pinching
if (!IsPinching)
{
    if (CurrentPinchDistance <= pinchThreshold)  // 0.8 units
    {
        StartPinch();  // Transition to Pinching
    }
}

// State: Pinching
else
{
    if (CurrentPinchDistance >= releaseThreshold)  // 1.2 units
    {
        ReleasePinch();  // Transition to Not Pinching
    }
}
```

**Why Hysteresis:**

- Single threshold (0.8) would flicker: 0.79 → pinch, 0.81 → release, 0.79 → pinch...
- Two thresholds create "dead zone": must reach 0.8 to grab, must reach 1.2 to release
- Prevents rapid on/off toggling from hand tracking noise

**Pinch Point Calculation:**

```csharp
Vector3 thumbPos = _thumbTipLandmark.transform.position;
Vector3 indexPos = _indexTipLandmark.transform.position;
PinchPoint = (thumbPos + indexPos) * 0.5f;  // Midpoint
```

---

#### **Object Search & Grab**

**Finding Grabbable Objects:**

```csharp
Vector3 pinchPoint = _pinchDetector.PinchPoint;
Collider[] colliders = Physics.OverlapSphere(pinchPoint, grabRadius, grabbableLayer);

// Find closest if multiple found
GameObject closestObject = null;
float closestDistance = float.MaxValue;

foreach (Collider col in colliders)
{
    float distance = Vector3.Distance(pinchPoint, col.transform.position);
    if (distance < closestDistance)
    {
        closestDistance = distance;
        closestObject = col.gameObject;
    }
}
```

**Maintaining Grab Offset:**

```csharp
// On grab: calculate offset from pinch point to object center
_grabOffset = obj.transform.position - _pinchDetector.PinchPoint;

// Every frame: maintain offset
Vector3 targetPosition = _pinchDetector.PinchPoint + _grabOffset;
_currentlyGrabbedObject.transform.position = targetPosition;
```

**Why Offset Matters:**

- Without offset: object snaps to pinch point (jarring, unnatural)
- With offset: object stays exactly where you grabbed it (smooth, intuitive)

---

### Testing & Debugging

#### **Issue 1: Scene Corruption (Floating Bug)**

**Symptom:** Scene starts with "floating upward" even with all scripts disabled

**Diagnosis:**

- Created new empty scene → no floating (confirmed not global Unity issue)
- Checked recovery scenes → worked correctly
- Conclusion: Scene file corrupted

**Solution:**

- Restored from `Assets/_Recovery/0 (1).unity` (Oct 25 backup)
- Re-added new components (PinchDetector, GrabController)
- Scene stable again

**Lesson:** Keep regular scene backups, especially during rapid development

---

#### **Issue 2: Self-Grabbing Landmarks**

**Symptom:** Pinching caused landmark 8 (index tip) to glitch and disappear

**Root Cause:**

- Landmark spheres had SphereColliders
- GrabController used `grabbableLayer = -1` (everything)
- When pinching, index finger landmark was closest object in radius
- System grabbed user's own finger → parented to GrabPoint → chaos

**Debug Process:**

```
1. User: "landmark 8 gets stuck to midpoint then glitches out"
2. Hypothesis: GrabController detecting landmark spheres
3. Verification: Checked landmark prefabs → had SphereColliders
4. Verification: Checked GrabController → grabbableLayer = -1 (everything)
5. Conclusion: System grabbing its own landmarks
```

**Solution (Attempt 1 - WRONG):**

```csharp
// Remove colliders from landmarks
Destroy(landmarkPrefabs[i].GetComponent<Collider>());
```

- Fixed self-grabbing ✓
- Broke hand-object collision ✗ (hand passes through objects)

**Solution (Attempt 2 - CORRECT):**

```csharp
// Layer separation
landmarkPrefabs[i].layer = LayerMask.NameToLayer("HandLandmarks");  // Keep colliders
grabbableLayer = LayerMask for "Grabbable" only;  // GrabController ignores HandLandmarks
```

- Fixed self-grabbing ✓
- Hand-object collision works ✓
- Clean separation of concerns ✓

---

### Current Configuration (Working State)

#### **Setup Steps:**

**1. Unity Layers:**

```
Layer 6: HandLandmarks
Layer 7: Grabbable
```

**2. HandTracker3D GameObject:**

```
Components:
- HandTracker3D (existing)
- PinchDetector
- GrabController
  - Grabbable Layer: "Grabbable" only
  - Grab Radius: 1.0
  - Use Closest Object: true
```

**3. Grabbable Objects:**

```
Example: TestCube
- Layer: Grabbable
- Box Collider (default)
- Rigidbody:
  - Use Gravity: false
  - Is Kinematic: false
  - Mass: 1
- GrabbableObject component (optional)
```

**4. Hand Landmarks (Automatic):**

```
All 21 landmarks:
- Layer: HandLandmarks (set by InitializeLandmarkPrefabs)
- SphereCollider (added if missing)
- Rigidbody:
  - Is Kinematic: true
  - Use Gravity: false
```

---

### Performance Notes

**Collision Detection:**

- 21 kinematic colliders (landmarks) updated every frame
- `Physics.OverlapSphere` called once per pinch start (not every frame)
- No noticeable FPS impact on test hardware

**Memory:**

- No GC allocations during grab/release cycle
- `Physics.OverlapSphere` allocates array (could use NonAlloc version for optimization)

---

### Future Enhancements

**High Priority:**

1. **Proximity highlighting** - Glow effect on objects near hand (OnNearby callback)
2. **Two-handed grabbing** - Scale/rotate objects with both hands
3. **Grab constraints** - Lock rotation, constrain to axis

**Medium Priority:** 4. **Haptic feedback simulation** - Visual/audio cues on grab/release 5. **Grab force visualization** - Show "grip strength" based on pinch tightness 6. **Smart grab points** - Custom attachment points on complex objects

**Low Priority:** 7. **Gesture-based actions** - Shake to throw harder, twist to rotate 8. **Physics-based grab** - Use joints instead of parenting for more realistic physics

---

### Code Files Added

**New Components:**

```
PinchDetector.cs        - 230 lines - Pinch gesture detection
GrabController.cs       - 290 lines - Object grabbing logic
GrabbableObject.cs      - 113 lines - Grabbable object component
```

**Modified Components:**

```
HandTracker3D.cs        - Updated InitializeLandmarkPrefabs() to add colliders/layers
```

**Total Addition:** ~650 lines of interaction code

---

### Key Learnings

1. **Hysteresis is Essential:** Single-threshold gesture detection always flickers with noisy input
2. **Layer Separation >> Component Checks:** Using layers is faster and cleaner than checking for specific components
3. **Kinematic Rigidbodies are Perfect for UI:** Position-controlled objects that can still push physics objects
4. **Offset Preservation Matters:** Small UX details (grab offset) make huge difference in feel
5. **Scene Corruption Happens:** Always keep recovery backups during rapid iteration

---

### Testing Checklist

When modifying grab system:

- [ ] Test pinch detection without objects (should detect cleanly)
- [ ] Test grab with single object (should attach smoothly)
- [ ] Test grab with multiple objects (should grab closest)
- [ ] Test release (should detach cleanly)
- [ ] Test hand-object collision (hand should push objects)
- [ ] Verify landmarks not grabbable (pinch near hand shouldn't self-grab)
- [ ] Test grab radius (objects outside radius shouldn't be grabbed)
- [ ] Test throw velocity if enabled (should apply realistic force)
- [ ] Check console for warnings (layer configuration)
- [ ] Verify no self-grabbing glitches

---

## Phase 6: Player Movement & Physics Collision

**Date:** 2025-11-12
**Goal:** Implement first-person WASD movement with jump, sprint, and proper physics collision

### Overview

Added complete first-person player controller to enable navigation through the 3D environment. Integrated with existing mouse look system (Test.cs) to provide full FPS-style controls. Encountered and partially resolved physics collision issues between kinematic rigidbodies (hand landmarks) and static/kinematic colliders (ground).

---

### Player Movement Implementation

#### **Enhanced PlayerMovement.cs**

**Upgraded from basic WASD to full-featured FPS controller:**

**Features Added:**

- ✅ Walk/Sprint system (Shift to sprint)
- ✅ Jump with proper physics (Space)
- ✅ Gravity simulation
- ✅ Ground detection (prevents mid-air jumping)
- ✅ Smooth acceleration/deceleration
- ✅ Diagonal movement normalization (prevents faster diagonal speed)

**Configuration:**

```csharp
[Header("Movement")]
walkSpeed = 5f          // Normal movement speed
sprintSpeed = 10f       // Sprint speed (Shift)
acceleration = 10f      // Speed ramp-up rate
deceleration = 10f      // Speed ramp-down rate

[Header("Jump & Gravity")]
jumpHeight = 2f         // How high player jumps
gravity = -20f          // Downward acceleration

[Header("Ground Check")]
groundCheck             // Auto-created position at player feet
groundDistance = 0.2f   // Sphere radius for ground detection
groundMask              // Layer mask (set to "Ground" layer)

[Header("Input")]
sprintKey = LeftShift
jumpKey = Space
```

---

#### **Physics Implementation**

**CharacterController-based movement:**

- Uses Unity's CharacterController (not Rigidbody)
- Collision detection built-in
- No physics forces applied (direct position control)

**Ground Detection:**

```csharp
// Sphere cast at player feet to check if grounded
_isGrounded = Physics.CheckSphere(groundCheck.position, groundDistance, groundMask);

// Reset falling velocity when touching ground
if (_isGrounded && _velocity.y < 0)
{
    _velocity.y = -2f;  // Small negative keeps player stuck to ground
}
```

**Jump Formula:**

```csharp
// Physics-based jump velocity calculation
_velocity.y = Mathf.Sqrt(jumpHeight * -2f * gravity);
// For jumpHeight=2, gravity=-20: velocity = ~6.32 units/sec
```

**Movement Flow:**

```
1. Get WASD input → Calculate direction
2. Normalize diagonal movement (prevents speed exploit)
3. Determine speed (walk vs sprint)
4. Smooth acceleration/deceleration
5. Apply horizontal movement via CharacterController.Move()
6. Apply gravity
7. Apply vertical velocity
```

---

### Integration with Existing Systems

#### **Mouse Look (Test.cs)**

- Already implemented toggle-based mouse look (Tab key)
- PlayerMovement uses `transform.forward` for movement direction
- Works seamlessly: rotate with mouse → WASD moves in look direction

**Controls:**

```
Tab          - Toggle mouse lock (for looking)
Mouse        - Look around (when Tab active)
W/A/S/D      - Move forward/left/back/right
Left Shift   - Sprint (hold while moving)
Space        - Jump
```

#### **Hand Tracking Interaction**

- Player movement doesn't interfere with hand tracking
- Can walk around while hand-tracked objects remain in world space
- Can grab objects while moving (pinch-to-grab still works)

---

### Physics Collision Setup

#### **Layer System (Expanded)**

**New Layer Added:**

```
Layer 8: Ground
```

**Complete Layer Structure:**

```
Layer 0: Default      - General objects
Layer 6: HandLandmarks - Hand tracking spheres (kinematic)
Layer 7: Grabbable    - Objects that can be grabbed
Layer 8: Ground       - Floor/terrain/platforms
```

---

#### **Layer Collision Matrix Configuration**

**Edit > Project Settings > Physics > Layer Collision Matrix:**

```
                    Default  Ground  HandLandmarks  Grabbable
Default               ✅       ✅         ✅            ✅
Ground                ✅       ✅         ✅            ✅
HandLandmarks         ✅       ✅         ❌            ✅
Grabbable             ✅       ✅         ✅            ✅
```

**Key Settings:**

- ✅ **HandLandmarks ↔ Ground** - Hands should collide with floor
- ❌ **HandLandmarks ↔ HandLandmarks** - Fingers shouldn't self-collide (prevents jitter)
- ✅ **Grabbable ↔ Ground** - Objects rest on floor
- ✅ **HandLandmarks ↔ Grabbable** - Hands can push objects

---

### Known Issues & Debugging

#### **Issue 1: Hand Goes Through Ground ⚠️ (UNRESOLVED)**

**Symptom:**
Hand landmark spheres pass through floor despite correct layer collision settings

**Attempted Solutions:**

**1. Layer Collision Matrix (Verified ✓)**

- Confirmed HandLandmarks ↔ Ground is enabled
- Still passes through

**2. Changed Ground from Plane to Cube (Partial Fix)**

```
Problem: Unity Plane is single-sided mesh
Solution: Use 3D Cube for ground
- Position: (0, -0.5, 0)
- Scale: (20, 1, 20)
- Layer: Ground
Result: Grabbable objects now collide ✓, hand still passes through ✗
```

**3. Tried Adding Rigidbody to Ground**

- Added Rigidbody to ground cube
- Set Is Kinematic = true
- Set Use Gravity = false
- Result: Still didn't fix hand collision

**Root Cause (Suspected):**
**Kinematic-to-Kinematic Collision Limitation**

Hand landmarks:

- Kinematic Rigidbody (isKinematic=true)
- Position controlled by script (transform.position)
- Move via direct position update, not physics forces

Ground:

- Static or Kinematic collider
- No Rigidbody, or Kinematic Rigidbody

**Unity Physics Limitation:**
Kinematic rigidbodies moved via `transform.position` **do not properly collide** with static or other kinematic colliders. Unity's physics engine only processes collisions for:

- Dynamic ↔ Static (works)
- Dynamic ↔ Kinematic (works)
- Dynamic ↔ Dynamic (works)
- Kinematic ↔ Static (NO COLLISION - this is the problem)

**Current State:**

- Grabbable objects (dynamic rigidbodies) collide with ground correctly ✓
- Hand landmarks (kinematic rigidbodies) pass through ground ✗

---

#### **Potential Solutions (Not Yet Implemented)**

**Option A: Switch Hands to Dynamic Rigidbodies**

```csharp
// Instead of kinematic
rb.isKinematic = false;
rb.useGravity = false;

// Move hands using physics forces
rb.MovePosition(targetPosition);
```

**Pros:** Would collide properly with ground
**Cons:** Adds physics overhead, may introduce lag/jitter

---

**Option B: Manual Ground Collision Detection**

```csharp
// In HandTracker3D.cs, after updating landmark position:
foreach (var landmark in landmarkPrefabs)
{
    // Raycast downward to detect ground
    if (Physics.Raycast(landmark.position, Vector3.down, out hit, 0.1f, groundLayer))
    {
        // Clamp position to above ground
        landmark.position = new Vector3(landmark.position.x, hit.point.y + radius, landmark.position.z);
    }
}
```

**Pros:** Full control, guaranteed to work
**Cons:** Extra raycasts every frame (21 landmarks × raycasts)

---

**Option C: Use CharacterController for Hands**

```csharp
// Attach CharacterController to each landmark
CharacterController handCC = landmark.AddComponent<CharacterController>();
handCC.radius = 0.05f;
handCC.Move(deltaPosition);
```

**Pros:** Built-in collision, no physics overhead
**Cons:** 21 CharacterControllers (high overhead), may conflict with tracking

---

**Option D: Physics Layers + Continuous Collision Detection**

```csharp
// On hand rigidbodies
rb.collisionDetectionMode = CollisionDetectionMode.Continuous;
```

**Pros:** Minimal code change
**Cons:** May not solve kinematic-static collision issue

---

### Ground Setup (Working Configuration)

**Ground GameObject:**

```
Name: Ground
Type: Cube
Transform:
  - Position: (0, -0.5, 0)
  - Rotation: (0, 0, 0)
  - Scale: (20, 1, 20)

Components:
  - MeshFilter (Cube)
  - MeshRenderer
  - BoxCollider
  - Rigidbody (optional)
    - Is Kinematic: true
    - Use Gravity: false

Layer: Ground
```

**Why Cube Instead of Plane:**

- Planes are single-sided (only top surface has collision)
- Cubes have proper 3D collision on all faces
- More reliable for physics interactions

---

### Testing Results

**✅ Working:**

- WASD movement (smooth, responsive)
- Sprint system (Shift increases speed)
- Jump with proper arc
- Ground detection (can't jump mid-air)
- Grabbable objects collide with ground properly
- Player CharacterController collides with ground
- Movement direction follows camera look direction

**⚠️ Partially Working:**

- Hand landmark collision (objects yes, ground no)

**❌ Not Working:**

- Hand landmarks still pass through ground floor

---

### Performance Notes

**CharacterController Movement:**

- No performance impact
- Efficient collision detection
- No physics simulation needed

**Ground Check:**

- Single sphere cast per frame
- Negligible cost

**Overall:**

- No FPS drop from movement system
- Smooth 60+ FPS maintained

---

### Code Changes

**Modified Files:**

```
PlayerMovement.cs - Completely rewritten with full FPS controller
  - Added: Jump, sprint, gravity, ground detection
  - Added: Smooth acceleration/deceleration
  - Added: Auto-created ground check transform
  - Lines: ~160 (was ~27)
```

**Existing Files Used:**

```
Test.cs - Mouse look (already working, no changes)
```

---

### Future Work

**High Priority:**

1. **Fix hand-ground collision** - Implement one of the solutions above
2. **Test different collision methods** - Compare performance/accuracy
3. **Add collision feedback** - Visual/audio when hand hits objects

**Medium Priority:** 4. **Crouching** - Ctrl to crouch/lower camera 5. **Head bobbing** - Subtle camera movement while walking 6. **Footstep sounds** - Audio feedback for movement

**Low Priority:** 7. **Climbing** - Ladder interaction 8. **Swimming** - Water physics 9. **Stamina system** - Limited sprint duration

---

### Key Learnings

1. **Kinematic Limitations:** Kinematic rigidbodies don't collide with static/kinematic colliders when moved via `transform.position`
2. **Plane Collision Issues:** Unity Planes are unreliable for physics - use Cubes for floors
3. **CharacterController > Rigidbody:** For player movement, CharacterController is simpler and more reliable than Rigidbody
4. **Layer Collision Matrix ≠ Guaranteed Collision:** Enabled matrix settings don't override Unity's physics engine limitations
5. **Ground Check is Essential:** Prevents mid-air jumping, makes movement feel grounded

---

### Debug Checklist

When testing movement:

- [ ] WASD moves player in correct directions
- [ ] Sprint (Shift) increases speed
- [ ] Jump works only when grounded
- [ ] Gravity pulls player down
- [ ] Player collides with walls/obstacles
- [ ] Diagonal movement not faster than cardinal directions
- [ ] Ground check sphere visible in Scene view (green when grounded)
- [ ] Mouse look controls where WASD moves (forward = camera forward)
- [ ] Grabbable objects don't fall through ground
- [ ] Hand landmarks collision (expected to fail currently)

---

## Project Roadmap: Hands-Only Interaction

**Vision:** Transition from keyboard/mouse controls to **fully hand-based locomotion and interaction**. Goal is to navigate, look around, and interact using only hand gestures - no keyboard or mouse needed.

**Current Problem:** Using keyboard for movement while also using hands in-game is difficult - not enough hands! Need to free up hands by making movement gesture-based.

---

### Phase 7: Two-Handed Tracking (NEXT PRIORITY)

**Goal:** Enable simultaneous tracking of both hands

**Current State:**

- Only tracking one hand (right or left, whichever detected first)
- HandLandmarkerRunner processes `handLandmarks[0]` only
- PinchDetector and GrabController work with single hand

**Implementation Tasks:**

1. **Dual Hand Detection**

   - Modify HandLandmarkerRunner to track both hands
   - Detect left vs right hand (MediaPipe provides handedness)
   - Emit separate events: `OnLeftHandData`, `OnRightHandData`

2. **Dual HandTracker3D Instances**

   - Create LeftHandTracker3D and RightHandTracker3D GameObjects
   - Each tracks its respective hand independently
   - Separate landmark sets (21 × 2 = 42 total landmarks)
   - Separate skeleton rendering for each hand

3. **Dual PinchDetector**

   - LeftPinchDetector monitors left thumb-index distance
   - RightPinchDetector monitors right thumb-index distance
   - Independent pinch states for each hand

4. **Enhanced GrabController**
   - Support grabbing with either hand
   - Support two-handed grabbing (same object)
   - Determine which hand is closer to object

**Success Criteria:**

- [ ] Both hands visible simultaneously
- [ ] Both hands have skeleton rendering
- [ ] Can pinch with left hand, right hand, or both
- [ ] Can grab objects with either hand
- [ ] Hands don't interfere with each other

---

### Phase 8: Two-Handed Object Manipulation

**Goal:** Use both hands together to rotate and scale objects

**Features:**

#### **1. Two-Handed Grab**

```
Gesture: Pinch same object with both hands simultaneously
Behavior: Object locked to both hands (weighted center)
Release: Either hand releases → single-hand grab continues
```

#### **2. Two-Handed Rotation**

```
Gesture:
  - Grab object with both hands
  - Rotate hands relative to each other

Calculation:
  - Track angle between hands (Vector3.Angle)
  - Apply rotation to object around axis perpendicular to hand plane
  - Natural twist motion rotates object

Example: Grabbing a stick with both hands and twisting
```

#### **3. Two-Handed Scaling**

```
Gesture:
  - Grab object with both hands
  - Move hands closer/farther apart

Calculation:
  - Initial distance = distance between pinch points at grab
  - Current distance = real-time distance between pinch points
  - Scale factor = currentDistance / initialDistance
  - Apply uniform scale to object

Example: Pinch-to-zoom but with physical object in 3D space
```

**Implementation Approach:**

- New component: `TwoHandedManipulator.cs`
- Listens to both PinchDetectors
- Detects when both hands grab same object
- Calculates rotation/scale based on hand positions
- Smooth interpolation for natural feel

**Success Criteria:**

- [ ] Can grab object with both hands
- [ ] Rotating hands rotates object naturally
- [ ] Spreading hands apart scales object up
- [ ] Bringing hands together scales object down
- [ ] Releasing one hand transitions to single-hand grab smoothly

---

### Phase 9: Hands-Only Locomotion (MAJOR MILESTONE)

**Goal:** Completely replace keyboard/mouse with hand gesture-based movement

**Problem Statement:**
"Right now it's kind of hard to move around using the keyboard and also using my hand in-game. I don't have enough hands."

**Solution:** Gesture-based movement - free up hands by making movement hand-controlled.

---

#### **Movement System: Pinch & Expand to Move Forward**

**Gesture:**

```
1. Bring both hands together (pinch inward)
2. Expand hands apart (push outward)
3. Repeat rhythmic motion
```

**Mechanics:**

```csharp
// Pseudo-code
float handDistance = Vector3.Distance(leftPinchPoint, rightPinchPoint);

if (handDistance < minDistance)  // Hands together
{
    isCompressed = true;
}

if (isCompressed && handDistance > maxDistance)  // Hands expanded
{
    // Apply forward movement impulse
    playerVelocity += cameraForward * moveSpeed;
    isCompressed = false;
}
```

**Feel:**

- Each pinch-expand cycle = one "step" forward
- Faster cycling = faster movement (sprint)
- Hands at rest = no movement
- Direction based on camera facing (where you're looking)

**Alternative Designs:**

- **Continuous:** Hold hands apart = move forward (no rhythm needed)
- **Swimming Motion:** Push hands forward/back like swimming strokes
- **Running Motion:** Alternate hand pumping like running arms

---

#### **Look System: Pinch & Drag to Look Around**

**Gesture:**

```
1. Pinch with either hand (enter look mode)
2. While pinched, move hand left/right/up/down
3. Camera follows hand movement
4. Release pinch to exit look mode
```

**Mechanics:**

```csharp
// Pseudo-code
if (leftPinch.IsPinching || rightPinch.IsPinching)
{
    Vector3 pinchPoint = activePinch.PinchPoint;
    Vector3 delta = pinchPoint - previousPinchPoint;

    // Map hand movement to camera rotation
    cameraYaw += delta.x * lookSensitivity;
    cameraPitch -= delta.y * lookSensitivity;

    // Apply rotation
    camera.rotation = Quaternion.Euler(cameraPitch, cameraYaw, 0);
}
```

**Feel:**

- Natural drag motion (like grabbing and pulling the world)
- Smooth following (lerp for smoothing)
- Sensitivity adjustable per user
- Either hand can look (whichever is more comfortable)

**Alternative Designs:**

- **Head Tracking:** Use head pose from webcam for looking (frees up hands entirely)
- **Point & Look:** Extend arm, point direction = look direction
- **Gaze Tracking:** Use eye tracking if available

---

#### **Jump System: Hands-Only Options**

**Option A: Upward Thrust**

```
Gesture: Both hands push upward quickly (jump motion)
Mechanic: Detect upward velocity spike in hand positions
```

**Option B: Clap Jump**

```
Gesture: Clap hands together
Mechanic: Detect hands coming together quickly
```

**Option C: Squat Jump**

```
Gesture: Lower hands (crouch) then raise quickly (jump)
Mechanic: Track hand height delta
```

**Recommended:** Option A (most intuitive, matches real jump motion)

---

### Implementation Phases

#### **Phase 9.1: Pinch & Expand Movement**

1. Detect hand distance between pinches
2. Detect expansion gesture (threshold crossing)
3. Apply forward impulse on each expansion
4. Test feel (speed, sensitivity, smoothness)
5. Disable WASD movement (hands only!)

**Components:**

- `HandLocomotion.cs` - Manages gesture-based movement
- Listens to both PinchDetectors
- Applies movement to CharacterController
- Replaces PlayerMovement.cs logic

---

#### **Phase 9.2: Pinch & Drag Looking**

1. Enter look mode on pinch
2. Track pinch point delta while pinching
3. Map delta to camera rotation (yaw/pitch)
4. Smooth interpolation
5. Disable mouse look (Test.cs)

**Components:**

- `HandLookController.cs` - Manages gesture-based camera control
- Listens to PinchDetectors
- Applies rotation to camera
- Replaces Test.cs mouse look

---

#### **Phase 9.3: Gesture-Based Jump**

1. Implement upward thrust detection
2. Apply jump velocity on gesture
3. Test feel and reliability
4. Tune sensitivity (avoid false positives)

**Components:**

- Integrated into `HandLocomotion.cs`
- Tracks hand velocity in Y-axis
- Applies jump when threshold exceeded

---

#### **Phase 9.4: Polish & Refinement**

1. Add visual feedback (UI hints for gestures)
2. Add audio feedback (whoosh sounds on movement)
3. Add haptic feedback simulation (visual pulse on gesture)
4. Tutorial system (teach gestures to new users)
5. Comfort options (seated vs standing calibration)

---

### Success Criteria: Hands-Only Mode

**Must Have:**

- [ ] No keyboard needed for movement
- [ ] No mouse needed for looking
- [ ] Can navigate entire environment with hands only
- [ ] Can grab and manipulate objects while moving
- [ ] Intuitive gestures (< 5 min learning curve)
- [ ] Responsive (minimal input lag)
- [ ] Comfortable (no arm fatigue after 10 min)

**Nice to Have:**

- [ ] Gesture customization (user can remap gestures)
- [ ] Accessibility options (one-handed mode)
- [ ] Gesture recognition feedback (show when gesture detected)
- [ ] Multiple movement modes (walk, run, teleport)

---

### Technical Challenges

**Challenge 1: Hand Tracking Reliability**

- **Problem:** Hands occlude each other, tracking may drop
- **Solution:** Fallback to last known position, timeout before disabling

**Challenge 2: Gesture Ambiguity**

- **Problem:** Movement gesture might trigger grab, or vice versa
- **Solution:** Context-aware gesture detection (different thresholds based on mode)

**Challenge 3: Fatigue**

- **Problem:** Holding arms up tires users quickly
- **Solution:** Support seated mode (hands at rest position), shorter gesture ranges

**Challenge 4: Precision vs Comfort**

- **Problem:** Precise gestures (small movements) vs comfortable gestures (large movements)
- **Solution:** Multiple sensitivity profiles, user-adjustable

**Challenge 5: False Positives**

- **Problem:** Unintentional movements trigger actions
- **Solution:** Require deliberate gestures (min velocity, min distance thresholds)

---

### Alternative Approaches to Consider

**Hybrid Mode:**

- Keyboard for movement (current system)
- Hands for interaction only (grab, rotate, scale)
- Toggle between modes with voice command or gesture

**Teleport Locomotion:**

- Point with hand → show target location
- Pinch to teleport to location
- Less immersion, but less fatigue, better for VR-style experiences

**Gaze-Based Movement:**

- Look where you want to go
- Pinch to walk in that direction
- Frees up hand gestures for other actions

---

### Development Timeline Estimate

**Phase 7: Two-Handed Tracking**

- Complexity: Medium
- Estimate: 2-3 sessions
- Blockers: MediaPipe handedness detection, dual instance management

**Phase 8: Two-Handed Manipulation**

- Complexity: Medium-High
- Estimate: 2-4 sessions
- Blockers: Rotation math, smooth transitions, testing feel

**Phase 9: Hands-Only Locomotion**

- Complexity: High
- Estimate: 4-6 sessions
- Blockers: Gesture detection reliability, feel/comfort tuning, false positives

**Total Estimate:** 8-13 sessions to complete hands-only interaction system

---

### Open Questions for Next Session

1. **Hand Preference:** Should movement gestures require both hands, or allow single-hand options?
2. **Movement Speed:** Continuous (hold gesture) vs discrete (one gesture = one step)?
3. **Look Sensitivity:** High (fast look) vs low (precise look)?
4. **Jump Necessity:** Is jumping needed, or can we use teleport/climb for vertical movement?
5. **Fatigue Mitigation:** Seated mode required, or optional?
6. **Grab While Moving:** Should pinch-to-grab disable during movement gestures, or coexist?

---

### References & Inspiration

**VR Locomotion Systems:**

- Beat Saber (no locomotion, stationary)
- Half-Life: Alyx (teleport + smooth locomotion)
- Boneworks (full physics-based movement)

**Hand Gesture Interfaces:**

- Leap Motion Controller examples
- Microsoft Hololens hand tracking
- Meta Quest hand tracking

**Design Principles:**

- Natural mapping (gesture resembles real-world action)
- Immediate feedback (action happens instantly)
- Forgiveness (small mistakes don't break experience)
- Discoverability (gestures are guessable)

---
