#!/usr/bin/env python3
"""
End-to-end test harness: loads 5 real 2023+ MikCil samples,
runs each through the analyze pipeline, prints ASCII table.
"""
import asyncio
import httpx
import numpy as np
import librosa
import io
from datasets import load_dataset
from datetime import datetime

API_URL = "http://localhost:8000/analyze"

# Pick 5 diverse 2023+ clips manually or filter programmatically
TARGET_DRIVERS = ["MAXVER01", "LEWHAM01", "LANNOR01", "CHALEC01", "GEORUS01"]


async def test_clip(sample, client: httpx.AsyncClient):
    """Run single clip through /analyze and return formatted result."""
    audio_data = sample["audio"]
    array = np.array(audio_data["array"], dtype=np.float32)
    sr = audio_data["sampling_rate"]

    # Prepare multipart form
    buf = io.BytesIO()
    import soundfile as sf
    sf.write(buf, array, sr, format='WAV')
    buf.seek(0)

    files = {"file": (f"{sample['id']}.wav", buf, "audio/wav")}
    data = {
        "driver_id": sample["driver_id"],
        "grand_prix": sample["grand_prix"],
        "session_date": sample["session_date"],
        "message_timestamp": sample["message_timestamp"],
        "racing_number": str(sample.get("racing_number", "")),
    }

    try:
        resp = await client.post(API_URL, files=files, data=data, timeout=60.0)
        resp.raise_for_status()
        result = resp.json()
        return {
            "clip_id": sample["id"][:20],
            "driver": sample["driver_id"][:4],
            "gp": sample["grand_prix"][:20],
            "transcript": result["transcript"][:28],
            "emotion": f'{result["emotion"]["raw_label"]} ({result["emotion"]["score"]:.2f})',
            "method": result["lap"]["method"],
            "duration": f'{result["lap"]["lap_duration"]:.2f}s' if result["lap"]["lap_duration"] else "N/A",
            "ok": True,
        }
    except Exception as e:
        return {
            "clip_id": sample["id"][:20],
            "driver": sample["driver_id"][:4],
            "gp": sample["grand_prix"][:20],
            "transcript": "ERROR",
            "emotion": str(e)[:28],
            "method": "error",
            "duration": "N/A",
            "ok": False,
        }


async def main():
    print("Loading MikCil dataset...")
    ds = load_dataset("MikCil/f1-team-radio", split="train")

    # Filter 2023+ samples for target drivers
    candidates = []
    for row in ds:
        try:
            year = int(row["session_date"][:4])
            if year >= 2023 and row["driver_id"] in TARGET_DRIVERS:
                candidates.append(row)
                if len(candidates) >= 5:
                    break
        except Exception:
            continue

    if len(candidates) < 3:
        print(f"WARNING: Only found {len(candidates)} 2023+ samples for target drivers")
        # Fallback: any 2023+ samples
        for row in ds:
            try:
                year = int(row["session_date"][:4])
                if year >= 2023:
                    candidates.append(row)
                    if len(candidates) >= 5:
                        break
            except Exception:
                continue

    print(f"Testing {len(candidates)} clips...\n")

    async with httpx.AsyncClient() as client:
        tasks = [test_clip(s, client) for s in candidates]
        results = await asyncio.gather(*tasks)

    # Print ASCII table
    print("=" * 110)
    print(f"{'CLIP ID':<20} | {'DRV':<4} | {'GP':<20} | {'TRANSCRIPT':<30} | {'EMOTION (SCORE)':<20} | {'METHOD':<12} | {'DUR':<8}")
    print("=" * 110)
    exact_count = 0
    for r in results:
        print(f"{r['clip_id']:<20} | {r['driver']:<4} | {r['gp']:<20} | {r['transcript']:<30} | {r['emotion']:<20} | {r['method']:<12} | {r['duration']:<8}")
        if r["method"] == "exact":
            exact_count += 1
    print("=" * 110)
    print(f"\nSummary: {len(results)} clips tested, {exact_count} exact-lap matches, {sum(1 for r in results if r['ok'])} succeeded.")

    # Assertions
    assert len(results) >= 3, "Need at least 3 clips tested"
    assert exact_count >= 1, "Need at least 1 exact-lap match"
    print("\n✅ All acceptance criteria met!")


if __name__ == "__main__":
    asyncio.run(main())