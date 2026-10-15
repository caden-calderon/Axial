"""Render editable Axial trailer narration, music bed, and game-inspired effects."""

from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro


SAMPLE_RATE = 48_000
DURATION = 44
VOICE = "af_sarah"
ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "public" / "audio"
MODEL = ROOT / ".cache" / "kokoro" / "kokoro-v1.0.int8.onnx"
VOICES = ROOT / ".cache" / "kokoro" / "voices-v1.0.bin"

LINES = [
    "This is Axial.",
    "Connect four. In three dimensions.",
    "Look for a line. Watch for theirs.",
    "Then change the rules. Connect five.",
    "Change the size of the board.",
    "Make it two lines to win. Or three.",
    "Your move. Play Axial in your browser.",
]


def add_tone(
    output: np.ndarray,
    at: float,
    frequency: float,
    duration: float,
    volume: float,
    end_frequency: float | None = None,
) -> None:
    start = round(at * SAMPLE_RATE)
    count = round(duration * SAMPLE_RATE)
    time = np.arange(count, dtype=np.float64) / SAMPLE_RATE
    if end_frequency is None:
        phase = 2 * np.pi * frequency * time
    else:
        change = (end_frequency - frequency) / max(duration, 0.001)
        phase = 2 * np.pi * (frequency * time + 0.5 * change * time**2)
    attack = np.clip(time / 0.004, 0, 1)
    envelope = attack * np.exp(-5.6 * time / duration)
    stop = min(start + count, len(output))
    output[start:stop] += volume * envelope[: stop - start] * np.sin(phase[: stop - start])


def render_voice() -> None:
    model = Kokoro(str(MODEL), str(VOICES))
    for index, line in enumerate(LINES, start=1):
        samples, sample_rate = model.create(line, voice=VOICE, speed=0.95, lang="en-us")
        destination = AUDIO / f"voice-{index:02d}.wav"
        sf.write(destination, samples, sample_rate)
        print(f"{destination.name}: {len(samples) / sample_rate:.2f}s")


def render_bed() -> None:
    time = np.arange(DURATION * SAMPLE_RATE, dtype=np.float64) / SAMPLE_RATE
    output = np.zeros_like(time)

    # A quiet, slowly beating cluster supplies motion without a melody under speech.
    for frequency, level, period in [(65.41, 0.009, 11), (98.0, 0.006, 13), (146.83, 0.004, 17)]:
        motion = 0.68 + 0.32 * np.sin(2 * np.pi * time / period)
        output += level * motion * np.sin(2 * np.pi * frequency * time)

    for beat in np.arange(2.1, 9.4, 1.18):
        add_tone(output, float(beat), 110, 0.42, 0.022, 80)

    # The final impact makes room for the win motif, then the pad opens up.
    duck = 1 - 0.7 * np.exp(-((time - 10.0) / 0.32) ** 2)
    output *= duck
    arrival = np.clip((time - 10.65) / 1.2, 0, 1)
    release = np.clip((DURATION - time) / 2.2, 0, 1)
    for frequency, level in [(130.81, 0.006), (155.56, 0.005), (196.0, 0.005), (293.66, 0.003)]:
        output += level * arrival * release * np.sin(2 * np.pi * frequency * time)
    output *= np.clip(time / 0.7, 0, 1) * release
    sf.write(AUDIO / "music-bed.wav", output.astype(np.float32), SAMPLE_RATE)


def render_effects() -> None:
    output = np.zeros(DURATION * SAMPLE_RATE, dtype=np.float64)
    for at, player in [(0.95, 1), (3.25, 2), (5.55, 1), (7.85, 2), (10.15, 1)]:
        root = 760 if player == 1 else 640
        add_tone(output, at, 180 if player == 1 else 155, 0.14, 0.1, 125 if player == 1 else 110)
        add_tone(output, at, root, 0.23, 0.047)
        add_tone(output, at, root * 1.46, 0.09, 0.016)

    for index, ratio in enumerate([1, 1.25, 1.5]):
        add_tone(output, 10.55 + index * 0.07, 330 * ratio, 0.4 + index * 0.065, 0.066)

    sf.write(AUDIO / "game-effects.wav", output.astype(np.float32), SAMPLE_RATE)


if __name__ == "__main__":
    AUDIO.mkdir(parents=True, exist_ok=True)
    render_voice()
    render_bed()
    render_effects()
