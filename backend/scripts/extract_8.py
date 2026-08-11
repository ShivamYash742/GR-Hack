#!/usr/bin/env python3
import json
from datetime import datetime
from pathlib import Path
import numpy as np
import soundfile as sf
from datasets import load_dataset

from app.openf1 import correlate

PROJECT_ROOT = Path("/home/shivammishra/Pictures/GR-hack")
PRESETS_WAV_DIR = PROJECT_ROOT / "frontend" / "public" / "presets"
PRESETS_TS = PROJECT_ROOT / "frontend" / "src" / "data" / "presets.ts"

TARGET_DRIVERS = [
    "CHALEC01", "GEORUS01", "LANNOR01", "LEWHAM01",
    "MAXVER01", "SERPER01", "FERALO01", "CARSAI01"
]

def main():
    PRESETS_WAV_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading MikCil dataset...")
    ds = load_dataset("MikCil/f1-team-radio", split="train")

    verified = []
    seen_drivers = set()

    for row in ds:
        try:
            if not row["session_date"].startswith("2023"):
                continue

            driver_id = row["driver_id"]
            if driver_id not in TARGET_DRIVERS or driver_id in seen_drivers:
                continue

            racing_number = int(row["racing_number"]) if row.get("racing_number") else None

            # Test OpenF1 correlation
            lap_res = correlate(
                driver_id=driver_id,
                racing_number=racing_number,
                grand_prix=row["grand_prix"],
                session_date=row["session_date"],
                message_timestamp=row["message_timestamp"],
            )

            if lap_res.get("method") == "error":
                continue

            # Extract audio
            audio = row["audio"]
            array = np.array(audio["array"], dtype=np.float32)
            sr = audio["sampling_rate"]

            audio_id = row["id"]
            wav_path = PRESETS_WAV_DIR / f"{audio_id}.wav"
            sf.write(str(wav_path), array, sr, format="WAV")

            duration = round(len(array) / sr, 1)

            preset_entry = {
                "id": audio_id,
                "driverId": driver_id,
                "racingNumber": racing_number,
                "grandPrix": row["grand_prix"],
                "sessionDate": row["session_date"],
                "messageTimestamp": row["message_timestamp"],
                "audioUrl": f"/presets/{audio_id}.wav",
                "durationSeconds": duration,
                "correlationMethod": lap_res.get("method", "exact"),
                "expectedLapNumber": lap_res.get("lap_number"),
                "expectedLapDuration": lap_res.get("lap_duration"),
                "emotionRawLabel": "neutral",
                "emotionScore": 0.138,
            }

            verified.append(preset_entry)
            seen_drivers.add(driver_id)
            print(f"✓ Added preset #{len(verified)}: {driver_id} ({row['grand_prix']})")

            if len(verified) >= 8:
                break

        except Exception as e:
            continue

    ts_content = f"""// AUTO-GENERATED on {datetime.now().isoformat()}

export interface Preset {{
  id: string;
  driverId: string;
  racingNumber: number | null;
  grandPrix: string;
  sessionDate: string;
  messageTimestamp: string;
  audioUrl: string;
  durationSeconds: number;
  correlationMethod: "exact" | "fallback_early" | "fallback_mid" | "fallback_late" | "error";
  expectedLapNumber: number | null;
  expectedLapDuration: number | null;
  emotionRawLabel: string;
  emotionScore: number;
}}

export const PRESETS: Preset[] = {json.dumps(verified, indent=2)};
"""
    with open(PRESETS_TS, "w", encoding="utf-8") as f:
        f.write(ts_content)
    print("SUCCESS: Updated presets.ts with", len(verified), "presets!")

if __name__ == "__main__":
    main()
