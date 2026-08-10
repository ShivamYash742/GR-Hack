#!/usr/bin/env python3
"""
Extract 4 real MikCil clips (2023+) for the frontend preset bundle.

Each row MUST independently resolve through the OpenF1 chain (exact OR
fallback bucket) before it ships as a preset. Slow by design — catches
the failure mode where a row looks valid but doesn't actually correlate.

Outputs:
  - frontend/src/data/presets.ts        (TS module)
  - frontend/public/presets/*.wav       (audio files)
  - frontend/PRESETS_MANIFEST.txt       (provenance + method log)
"""
import asyncio
import json
import os
from datetime import datetime
from pathlib import Path

import httpx
import numpy as np
import soundfile as sf
from datasets import load_dataset

API_URL = "http://localhost:8000/analyze"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
PRESETS_WAV_DIR = PROJECT_ROOT / "frontend" / "public" / "presets"
PRESETS_TS = PROJECT_ROOT / "frontend" / "src" / "data" / "presets.ts"
MANIFEST = PROJECT_ROOT / "frontend" / "PRESETS_MANIFEST.txt"

# Target drivers covering the spectrum of the locked palette
TARGET_DRIVERS = ["MAXVER01", "LEWHAM01", "CHALEC01", "GEORUS01", "LANNOR01", "SERPER01"]

# Need at least 4 distinct drivers to span the demo
N_PRESETS = 4


async def verify_clip(metadata: dict, audio: dict, client: httpx.AsyncClient) -> dict | None:
    """POST clip to /analyze, verify correlation. Returns result dict or None on failure."""
    array = np.array(audio["array"], dtype=np.float32)
    sr = audio["sampling_rate"]
    buf = __import__("io").BytesIO()
    sf.write(buf, array, sr, format="WAV")
    buf.seek(0)

    files = {"file": (f"{metadata['id']}.wav", buf, "audio/wav")}
    data = {
        "driver_id": metadata["driver_id"],
        "grand_prix": metadata["grand_prix"],
        "session_date": metadata["session_date"],
        "message_timestamp": metadata["message_timestamp"],
        "racing_number": str(metadata.get("racing_number", "") or ""),
    }
    try:
        resp = await client.post(API_URL, files=files, data=data, timeout=120.0)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        print(f"  VERIFY FAILED for {metadata['id']}: {e}")
        return None


async def main():
    PRESETS_WAV_DIR.mkdir(parents=True, exist_ok=True)
    PRESETS_TS.parent.mkdir(parents=True, exist_ok=True)

    print("Loading MikCil dataset (cached locally)...")
    ds = load_dataset("MikCil/f1-team-radio", split="train")
    print(f"Total rows: {len(ds)}")

    # Scan for 2023+ rows, group by driver, pick N distinct drivers
    candidates_by_driver: dict[str, list] = {}
    seen_ids = set()
    for row in ds:
        try:
            if int(row["session_date"][:4]) < 2023:
                continue
            drv = row["driver_id"]
            if drv not in TARGET_DRIVERS:
                continue
            if drv in candidates_by_driver:
                continue  # take the first row per driver only
            candidates_by_driver[drv] = row
        except Exception:
            continue
        if len(candidates_by_driver) >= N_PRESETS:
            break

    print(f"Found rows for {len(candidates_by_driver)} drivers: {list(candidates_by_driver)}")

    if len(candidates_by_driver) < N_PRESETS:
        raise SystemExit(f"Need {N_PRESETS} candidate rows across distinct drivers; only got {len(candidates_by_driver)}")

    verified: list[dict] = []
    async with httpx.AsyncClient() as client:
        for driver_id, row in candidates_by_driver.items():
            print(f"\n→ Verifying {driver_id} | {row['id']} | {row['grand_prix']}")
            result = await verify_clip(row, row["audio"], client)
            if result is None:
                continue

            method = result["lap"]["method"]
            if method == "error":
                print(f"  SKIP: correlation errored ({result['lap'].get('error')})")
                continue

            print(f"  PASS: lap.method={method} duration={result['lap'].get('lap_duration')}")

            audio = row["audio"]
            array = np.array(audio["array"], dtype=np.float32)
            sr = audio["sampling_rate"]

            wav_path = PRESETS_WAV_DIR / f"{row['id']}.wav"
            sf.write(str(wav_path), array, sr)
            wav_size_kb = wav_path.stat().st_size / 1024

            preview_seconds = round(len(array) / sr, 1)

            verified.append({
                "id": row["id"],
                "driver_id": row["driver_id"],
                "racing_number": int(row["racing_number"]) if row.get("racing_number") else None,
                "grand_prix": row["grand_prix"],
                "session_date": row["session_date"],
                "message_timestamp": row["message_timestamp"],
                "audio_filename": wav_path.name,
                "audio_size_kb": round(wav_size_kb, 1),
                "preview_seconds": preview_seconds,
                "correlation_method": method,
                "lap_duration_s": result["lap"].get("lap_duration"),
                "lap_number": result["lap"].get("lap_number"),
                "emotion_raw_label_on_full_audio": result["emotion"]["raw_label"],
                "emotion_score_on_full_audio": round(result["emotion"]["score"], 3),
            })

    if len(verified) < 3:
        raise SystemExit(f"Only {len(verified)} presets verified; need at least 3.")

    print(f"\n✓ Verified {len(verified)} presets")

    # Write presets.ts
    ts_lines = [
        "// AUTO-GENERATED by backend/scripts/extract_presets.py on "
        + datetime.now().isoformat(timespec="seconds")
        + " — DO NOT EDIT BY HAND.",
        "// Each row's audio file is bundled at /presets/<audio_filename>.",
        "// Provenance: see ../../PRESETS_MANIFEST.txt",
        "",
        "export interface Preset {",
        "  /** Stable id from the MikCil dataset, also used as the audio filename stem. */",
        "  id: string;",
        "  driverId: string;",
        "  racingNumber: number | null;",
        "  grandPrix: string;",
        "  sessionDate: string;",
        "  messageTimestamp: string;",
        "  /** Path served from /public, e.g. \"/presets/<id>.wav\" */",
        "  audioUrl: string;",
        "  /** Length of the audio in seconds, for the player duration display. */",
        "  durationSeconds: number;",
        "  /** Which OpenF1 path this clip resolved through on extraction day. */",
        "  correlationMethod: 'exact' | 'fallback_early' | 'fallback_mid' | 'fallback_late';",
        "  /** Optional known lap — pin this in the UI when method === 'exact' */",
        "  expectedLapDuration: number | null;",
        "  expectedLapNumber: number | null;",
        "}",
        "",
        f"export const PRESETS: Preset[] = {json.dumps(verified, indent=2)}".replace(
            '"correlation_method"', '"correlationMethod"'
        ).replace(
            '"driver_id"', '"driverId"'
        ).replace(
            '"racing_number"', '"racingNumber"'
        ).replace(
            '"session_date"', '"sessionDate"'
        ).replace(
            '"message_timestamp"', '"messageTimestamp"'
        ).replace(
            '"audio_filename"', '"audioUrl"'
        ).replace(
            '"preview_seconds"', '"durationSeconds"'
        ).replace(
            '"expected_lap_duration_s"', '"expectedLapDuration"'
        ).replace(
            '"expected_lap_number"', '"expectedLapNumber"'
        ).replace('"id"', '"id"').replace(
            '"grand_prix"', '"grandPrix"'
        ) + ";",
        "",
    ]
    PRESETS_TS.write_text("\n".join(ts_lines))

    # Map /presets/<filename> → /presets/<filename> for the audioUrl field
    # (Need to do this post-json.dumps since the field is a flat filename)
    txt = PRESETS_TS.read_text()
    txt = txt.replace('"audioUrl": "', '"audioUrl": "/presets/')
    PRESETS_TS.write_text(txt)

    # Write manifest
    MANIFEST.write_text(
        f"Silent Co-Driver — preset extraction run\n"
        f"Timestamp: {datetime.now().isoformat(timespec='seconds')}\n"
        f"Backend endpoint used for live verification: {API_URL}\n\n"
        f"Total verified presets: {len(verified)}\n\n"
        + "\n".join(
            f"  {p['id']}: driver={p['driver_id']} racing_number={p['racing_number']} "
            f"gp={p['grand_prix']} date={p['session_date']} "
            f"method={p['correlation_method']} "
            f"lap_dur={p['lap_duration_s']}s lap_num={p['lap_number']}"
            for p in verified
        )
         + "\n"
    )

    total_kb = sum(p["audio_size_kb"] for p in verified)
    print(f"\nWrote {PRESETS_TS}")
    print(f"Wrote {len(verified)} .wav files to {PRESETS_WAV_DIR} (total {total_kb:.0f} KB)")
    print(f"Wrote manifest: {MANIFEST}")


if __name__ == "__main__":
    asyncio.run(main())
