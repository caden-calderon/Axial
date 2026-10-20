# Axial (Unity, 2025)

The original Axial: a Unity desktop game, built in late 2025 for a game design course and an AI course
at the same time. You play with your hands. A webcam and MediaPipe hand tracking let you pinch a piece,
carry it over the 3D board and let go to drop it, against a Monte Carlo tree search opponent written in
Python. The browser game in [`axial-web/`](../axial-web/) is a ground-up rebuild of it.

[Gameplay video](https://youtu.be/uuLK-gQ7Y54)

## What's here

The game is built on top of the MediaPipe Unity Plugin's hand landmark sample scene, so its code lives
in that sample's folder:

| Path                                                                    | Contents                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Assets/Scenes/main.unity`                                              | The game scene                                                                                                                                                                                                                                                                 |
| `Assets/MediaPipeUnity/Samples/Scenes/Hand Landmark Detection/main/`    | The game: `AxialGameController` (turns, win checks, the TCP bridge to the AI), `GridManager`, `BoardGenerator`, `GridColumn`, `PieceSpawner`, `GamePiece`, and the hand controls (`HandTracker3D`, `PinchDetector`, `GrabController`, `DualHandManager`, `RotationController`) |
| `Assets/MediaPipeUnity/Samples/Scenes/Hand Landmark Detection/*_old.cs` | Earlier versions of the same scripts                                                                                                                                                                                                                                           |
| `Assets/MediaPipeUnity/Samples/`, `Tutorial/`                           | The plugin's own samples and tutorials, which the game builds on                                                                                                                                                                                                               |

## Opening it

1. Unity 6 (`6000.2.8f1`) with the Universal Render Pipeline.
2. The [MediaPipe Unity Plugin](https://github.com/homuler/MediaPipeUnityPlugin) v0.16.2 (MIT), which isn't
   in this repository (about 390 MB of native libraries and models). Download
   `com.github.homuler.mediapipe-0.16.2.tgz` from the plugin's
   [v0.16.2 release](https://github.com/homuler/MediaPipeUnityPlugin/releases/tag/v0.16.2), extract it,
   and move the `package/` folder inside to `Packages/com.github.homuler.mediapipe/`, where
   `Packages/packages-lock.json` expects it as an embedded package.
3. Start the AI: `uv run python engine/axial_ai_server.py` from
   [`archive/python-ai/`](../archive/python-ai/README.md). It listens on `127.0.0.1:5555`, which is where
   `AxialGameController` connects.
4. Open `Assets/Scenes/main.unity` and press Play with a webcam connected.

Not included: Unity's generated folders, crash-recovery autosaves, and an unused third-party character
model.
