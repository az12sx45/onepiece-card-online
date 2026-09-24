"""Render three original, seamless-ish instrumental profile themes as Ogg Vorbis.

The score and synthesis are project-owned and intentionally do not quote game or
anime soundtracks. Re-run with Python, NumPy, and ffmpeg on PATH.
"""

from __future__ import annotations

import hashlib
import json
import math
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "audio" / "profile_bgm"
MANIFEST = ROOT / "docs" / "LAUNCHER_PROFILE_BGM_20260924.json"
SAMPLE_RATE = 32_000

TRACKS = (
    {
        "id": "bgm-harbor", "file": "harbor.ogg", "title": "暮港歸航",
        "bpm": 94, "root": 57, "mode": "warm",
        "chords": ((0, 4, 7), (5, 9, 12), (7, 11, 14), (4, 7, 11),
                   (0, 4, 7), (5, 9, 12), (2, 5, 9), (7, 11, 14)),
        "melody": (12, 14, 16, 19, 16, 14, 12, 9, 12, 16, 17, 16, 14, 12, 9, 7,
                   12, 14, 16, 19, 21, 19, 16, 14, 12, 9, 7, 9, 11, 14, 12, 7),
    },
    {
        "id": "bgm-night-watch", "file": "night-watch.ogg", "title": "星夜航線",
        "bpm": 82, "root": 52, "mode": "night",
        "chords": ((0, 3, 7), (8, 12, 15), (5, 8, 12), (7, 10, 14),
                   (0, 3, 7), (8, 12, 15), (3, 7, 10), (7, 10, 14)),
        "melody": (12, 15, 19, 15, 12, 10, 8, 10, 12, 15, 17, 15, 12, 10, 7, 10,
                   12, 15, 19, 22, 19, 17, 15, 12, 10, 8, 10, 12, 15, 14, 12, 7),
    },
    {
        "id": "bgm-voyage", "file": "voyage.ogg", "title": "破曉揚帆",
        "bpm": 116, "root": 55, "mode": "bright",
        "chords": ((0, 4, 7), (5, 9, 12), (9, 12, 16), (7, 11, 14),
                   (0, 4, 7), (5, 9, 12), (2, 5, 9), (7, 11, 14)),
        "melody": (12, 16, 19, 21, 19, 16, 14, 12, 14, 17, 21, 24, 21, 19, 17, 14,
                   12, 16, 19, 24, 23, 19, 16, 14, 12, 14, 16, 19, 17, 14, 12, 7),
    },
)


def frequency(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def tone(length: int, midi: float, kind: str) -> np.ndarray:
    time = np.arange(length, dtype=np.float64) / SAMPLE_RATE
    hz = frequency(midi)
    phase = 2 * np.pi * hz * time
    if kind == "bell":
        signal = np.sin(phase) + 0.35 * np.sin(2 * phase) + 0.16 * np.sin(3 * phase)
        envelope = (1 - np.exp(-time * 75)) * np.exp(-time * 4.3)
    elif kind == "flute":
        signal = np.sin(phase + 0.022 * np.sin(2 * np.pi * 5.1 * time))
        signal += 0.16 * np.sin(2 * phase)
        envelope = (1 - np.exp(-time * 13)) * np.minimum(1.0, (length / SAMPLE_RATE - time) * 8)
    elif kind == "pluck":
        signal = np.sin(phase) + 0.28 * np.sin(2 * phase) + 0.12 * np.sin(4 * phase)
        envelope = (1 - np.exp(-time * 100)) * np.exp(-time * 3.0)
    elif kind == "pad":
        signal = np.sin(phase) + 0.18 * np.sin(2 * phase + 0.7)
        envelope = (1 - np.exp(-time * 1.4)) * np.minimum(1.0, (length / SAMPLE_RATE - time) * 2.2)
    else:
        signal = np.sin(phase) + 0.18 * np.sin(2 * phase)
        envelope = (1 - np.exp(-time * 35)) * np.exp(-time * 2.0)
    return (signal * np.clip(envelope, 0, 1)).astype(np.float32)


def place(buffer: np.ndarray, start_s: float, duration_s: float, midi: float, volume: float, kind: str) -> None:
    start = int(start_s * SAMPLE_RATE)
    if start >= len(buffer):
        return
    length = min(int(duration_s * SAMPLE_RATE), len(buffer) - start)
    if length > 0:
        buffer[start:start + length] += volume * tone(length, midi, kind)


def render(track: dict) -> np.ndarray:
    beat = 60 / track["bpm"]
    bar = 4 * beat
    seconds = 16 * bar
    samples = round(seconds * SAMPLE_RATE)
    left = np.zeros(samples, dtype=np.float32)
    right = np.zeros(samples, dtype=np.float32)
    melody_kind = {"warm": "pluck", "night": "flute", "bright": "bell"}[track["mode"]]
    melody = track["melody"]
    rng = np.random.default_rng(sum(ord(c) for c in track["file"]))

    for bar_index in range(16):
        chord = track["chords"][bar_index % 8]
        begin = bar_index * bar
        # A sustained harmony and a moving root give each loop its own harmonic arc.
        for note_index, interval in enumerate(chord):
            place(left, begin, bar * 1.02, track["root"] + interval, 0.043, "pad")
            place(right, begin + 0.012, bar * 1.02, track["root"] + interval, 0.039, "pad")
        root = track["root"] + chord[0] - 12
        for beat_index in (0, 2):
            place(left, begin + beat_index * beat, beat * 1.8, root, 0.12, "bass")
            place(right, begin + beat_index * beat + 0.01, beat * 1.8, root, 0.10, "bass")
        for beat_index in range(4):
            interval = melody[(bar_index * 4 + beat_index) % len(melody)]
            start = begin + beat_index * beat
            duration = beat * (1.30 if beat_index == 3 else 0.88)
            place(left, start, duration, track["root"] + interval, 0.17, melody_kind)
            place(right, start + 0.016, duration, track["root"] + interval, 0.14, melody_kind)
            if track["mode"] != "night" and beat_index in (0, 2):
                place(right, start, beat * 0.5, track["root"] + chord[beat_index // 2] + 12, 0.055, "pluck")

    # Quiet deterministic sea-like texture; no sampled or third-party audio is used.
    noise = rng.normal(0, 1, samples).astype(np.float32)
    smooth = np.convolve(noise, np.ones(95, dtype=np.float32) / 95, mode="same")
    tide = (0.48 + 0.52 * np.sin(2 * np.pi * np.arange(samples) / SAMPLE_RATE / 5.5) ** 2).astype(np.float32)
    ambience = 0.009 * smooth * tide
    left += ambience
    right += ambience[::-1]

    # A short fade eliminates the only discontinuity at the loop boundary.
    fade_len = int(0.22 * SAMPLE_RATE)
    fade = np.sin(np.linspace(0, np.pi / 2, fade_len, dtype=np.float32)) ** 2
    for channel in (left, right):
        channel[:fade_len] *= fade
        channel[-fade_len:] *= fade[::-1]
    stereo = np.stack((left, right), axis=1)
    peak = float(np.max(np.abs(stereo)))
    if peak > 0:
        stereo *= min(1.0, 0.84 / peak)
    return np.clip(stereo, -1, 1)


def write_track(track: dict) -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    audio = render(track)
    with tempfile.TemporaryDirectory(prefix="launcher-bgm-") as temporary:
        source = Path(temporary) / "score.wav"
        with wave.open(str(source), "wb") as wav:
            wav.setnchannels(2)
            wav.setsampwidth(2)
            wav.setframerate(SAMPLE_RATE)
            wav.writeframes((audio * 32767).astype("<i2").tobytes())
        target = OUT / track["file"]
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
            "-c:a", "libvorbis", "-qscale:a", "4", str(target)
        ], check=True)
    return {
        "id": track["id"], "title": track["title"],
        "output": str(target.relative_to(ROOT)).replace("\\", "/"),
        "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
        "bytes": target.stat().st_size,
        "seconds": round(len(audio) / SAMPLE_RATE, 3),
        "codec": "Ogg Vorbis", "sampleRate": SAMPLE_RATE, "channels": 2,
        "bpm": track["bpm"]
    }


def main() -> None:
    items = [write_track(track) for track in TRACKS]
    MANIFEST.write_text(json.dumps({
        "date": "2026-09-24",
        "source": "Project-authored note sequences and local NumPy synthesis; no external audio samples or One Piece OST copied.",
        "renderer": "tools/launcher-profile/compose_bgm.py",
        "items": items
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(items, ensure_ascii=False))


if __name__ == "__main__":
    main()
