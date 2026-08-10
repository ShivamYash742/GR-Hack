"""
PRE-FLIGHT VERIFICATION -- Silent Co-Driver
Run this BEFORE writing any pipeline or UI code. Budget: tonight, before Day 1.

This checks three things the original plan assumed would work but never
actually tested against live data:

  1. How many MikCil samples fall inside OpenF1's free coverage window (2023+).
  2. Whether a MikCil driver_id + grand_prix + message_timestamp resolves to
     a real OpenF1 lap_duration, end to end.
  3. What labels and confidence scores the emotion model actually returns on
     real F1 radio audio -- not on the RAVDESS actor speech it was trained on.

NOTE: this could not be executed against huggingface.co or openf1.org from
the environment that generated it -- no network route to those domains from
that sandbox. Run it yourself. Read every PASS / FAIL / WARN line before you
write any pipeline code -- they tell you whether you're building on the exact
OpenF1 lookup or the session-relative fallback (see the build plan, Section 2).

Install:
    pip install --break-system-packages datasets transformers torch librosa requests torchcodec

CONFIRMED COLUMNS (from the Aug 9 run against the real dataset):
    id, driver_id, racing_number, grand_prix, race_id, session_date,
    message_timestamp, audio, transcription

NOTE: there is a 'racing_number' column that may already BE the OpenF1
driver_number, which would make the static driver_id lookup table
unnecessary. Part 1 below now prints it explicitly so you can check.
"""

import requests
from datetime import datetime

# -- PART 0: static driver_id -> OpenF1 driver_number lookup ----------------
# MikCil driver_id format: first 3 letters of surname + first 3 of forename
# + a number, e.g. "MAXVER01" = Verstappen. OpenF1 wants a plain integer.
# Confirm/extend this from https://api.openf1.org/v1/drivers?session_key=latest
# Start with whatever driver_id shows up in PART 1's printed sample row.
DRIVER_ID_TO_NUMBER = {
    "MAXVER01": 1,    # Verstappen
    "LEWHAM01": 44,   # Hamilton
    "CHALEC01": 16,   # Leclerc
    "LANNOR01": 4,    # Norris
    "GEORUS01": 63,   # Russell
    # add more as you find them -- do not fuzzy-match this live, hardcode it
}


def part1_check_coverage_window():
    print("\n=== PART 1: MikCil date coverage vs OpenF1 (2023+) ===")
    from datasets import load_dataset

    ds = load_dataset("MikCil/f1-team-radio", split="train")
    print(f"Total samples: {len(ds)}")
    print(f"Columns: {ds.column_names}")

    # Read the non-audio columns without triggering audio decode (that's
    # what crashed the first run — decode_row() decodes every column in the
    # row, including 'audio', even though we only wanted to print metadata).
    ds_no_audio = ds.remove_columns(["audio"])
    sample = ds_no_audio[0]
    print(f"Sample row (no audio column): {sample}")
    print(f"\nracing_number for this row: {sample.get('racing_number')!r} "
          f"-- check by hand whether this matches the driver's real OpenF1 "
          f"driver_number (e.g. Verstappen=1, Hamilton=44). If it does, the "
          f"static driver_id lookup table in Part 2 can likely be dropped.")

    ts_field = "message_timestamp" if "message_timestamp" in ds.column_names else None
    if ts_field is None:
        print("WARN: no 'message_timestamp' column found. Check the column "
              "list above and update ts_field in this script manually.")
        return ds, None

    post_2023 = 0
    for row in ds:
        try:
            year = datetime.fromisoformat(str(row[ts_field]).replace("Z", "+00:00")).year
            if year >= 2023:
                post_2023 += 1
        except Exception:
            continue
    print(f"Samples with a parseable date >= 2023: {post_2023} / {len(ds)}")
    if post_2023 < 50:
        print("FAIL: too few 2023+ samples for reliable correlation. Adopt "
              "session-relative bucketing as PRIMARY, not backup.")
    else:
        print("PASS: enough 2023+ samples to attempt exact-lap correlation.")
    return ds, ts_field


def part2_check_openf1_chain(grand_prix, date_str, driver_id, racing_number,
                              message_timestamp):
    print("\n=== PART 2: MikCil -> OpenF1 lookup chain (single sample) ===")

    # Step A: grand_prix + date -> session_key
    r = requests.get("https://api.openf1.org/v1/sessions",
                      params={"year": date_str[:4]}, timeout=15)
    data = r.json()
    if not isinstance(data, list):
        print(f"WARN: OpenF1 sessions API returned non-list for year {date_str[:4]}: {data}")
        sessions = []
    else:
        sessions = [s for s in data
                    if grand_prix.lower() in str(s.get("location", "")).lower()
                    or grand_prix.lower() in str(s.get("country_name", "")).lower()]
    if not sessions:
        print(f"FAIL: no OpenF1 session matched grand_prix='{grand_prix}' "
              f"year={date_str[:4]}")
        return False
    session_key = sessions[0]["session_key"]
    print(f"Matched session_key={session_key} ({sessions[0].get('session_name')})")

    # Step B: driver_number. Prefer MikCil's own racing_number column if it
    # checks out against OpenF1's driver list for this session; fall back to
    # the static driver_id dict only if it doesn't.
    driver_number = None
    try:
        r = requests.get("https://api.openf1.org/v1/drivers",
                          params={"session_key": session_key}, timeout=15)
        valid_numbers = {d.get("driver_number") for d in r.json()}
        if racing_number is not None and int(racing_number) in valid_numbers:
            driver_number = int(racing_number)
            print(f"racing_number {racing_number} is a valid OpenF1 "
                  f"driver_number for this session -- static dict NOT needed "
                  f"for this row.")
    except Exception as e:
        print(f"WARN: could not validate racing_number against /v1/drivers: {e}")

    if driver_number is None:
        driver_number = DRIVER_ID_TO_NUMBER.get(driver_id)
        if driver_number is None:
            print(f"FAIL: racing_number '{racing_number}' didn't validate, "
                  f"and driver_id '{driver_id}' isn't in the static lookup "
                  f"table either. Add it and rerun.")
            return False
        print(f"Fell back to static dict for driver_id '{driver_id}' "
              f"-> driver_number {driver_number}")

    # Step C: session_key + driver_number -> laps, bracket-match by timestamp
    r = requests.get("https://api.openf1.org/v1/laps",
                      params={"session_key": session_key, "driver_number": driver_number},
                      timeout=15)
    laps = sorted(r.json(), key=lambda l: str(l.get("date_start", "")))
    if not laps:
        print("FAIL: no laps returned for this driver/session.")
        return False

    target = datetime.fromisoformat(str(message_timestamp).replace("Z", "+00:00"))
    matched_lap = None
    for lap in laps:
        lap_start = lap.get("date_start")
        if not lap_start:
            continue
        lap_dt = datetime.fromisoformat(str(lap_start).replace("Z", "+00:00"))
        if lap_dt <= target:
            matched_lap = lap
        else:
            break

    if matched_lap is None:
        print("FAIL: message timestamp falls outside this driver's lap range "
              "(formation lap, red flag, or pre/post-session radio call).")
        return False

    print(f"PASS: lap_number={matched_lap.get('lap_number')} "
          f"lap_duration={matched_lap.get('lap_duration')}s")
    return True


def part3_check_emotion_labels(sample_audio_arrays):
    print("\n=== PART 3: real emotion-model output on real F1 radio audio ===")
    from transformers import pipeline, Wav2Vec2FeatureExtractor

    # This checkpoint's own preprocessor_config doesn't load via AutoProcessor
    # (confirmed from the model's HF discussion thread) -- pull the feature
    # extractor from the base model it was fine-tuned from instead.
    feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(
        "facebook/wav2vec2-large-xlsr-53"
    )
    classifier = pipeline(
        "audio-classification",
        model="ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition",
        feature_extractor=feature_extractor,
    )

    for i, audio in enumerate(sample_audio_arrays):
        result = classifier(audio)
        print(f"Sample {i}: {result}")

    print("\nExpected label set (confirmed from the model card, RAVDESS-"
          "trained): angry, calm, disgust, fearful, happy, neutral, sad, "
          "surprised")
    print("WATCH FOR: this model was trained on scripted actor speech, not "
          "real broadcast radio. If every real clip comes back 'neutral' "
          "with low confidence, that's the domain gap. Plan to supplement "
          "with your own scripted calm/stressed/tired clips.")


if __name__ == "__main__":
    ds, ts_field = part1_check_coverage_window()

    if ts_field:
        row = ds[0]
        part2_check_openf1_chain(
            grand_prix=row.get("grand_prix", ""),
            date_str=str(row.get("session_date", row[ts_field]))[:10],
            driver_id=row.get("driver_id", ""),
            racing_number=row.get("racing_number"),
            message_timestamp=row[ts_field],
        )

    try:
        sample_audios = [ds[i]["audio"]["array"] for i in range(min(3, len(ds)))]
        part3_check_emotion_labels(sample_audios)
    except ImportError as e:
        print(f"\nFAIL: audio decode needs an extra package: {e}")
        print("Run: pip install --break-system-packages torchcodec")
        print("Then rerun this script.")

    print("\n=== DONE. Read every PASS/FAIL/WARN line above before Day 1. ===")
