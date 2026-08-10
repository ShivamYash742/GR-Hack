<!-- impeccable:product-schema 1 -->

# Product — Silent Co-Driver

## Platform

web

## Stack

Next.js 16 (App Router) + React 19 + Tailwind 4 + Recharts. Backend is FastAPI on Python 3.14, locked in CLAUDE.md.

## Users

- **Primary:** hackathon judges evaluating a 3-minute live demo. They do not know the dataset, the model names, or the OpenF1 lookup chain before the demo starts. The UI must narrate itself.
- **Secondary:** an F1 race engineer hypothetically using the same UI mid-session. Density should not punish this case but is not the optimization target.

## Product Purpose

Turn a single team-radio clip into a timestamped, actionable signal that pairs what the driver said (Whisper), how they sounded (wav2vec2 emotion classifier), and what happened on the lap at that exact moment (OpenF1 lap bracket). The mechanism is composition of three pretrained models plus a deterministic API chain — no training, no fabricated numbers.

A correct output happens when transcript + emotion + lap match the real broadcast context. The product fails honestly when correlation is unavailable: surfaces "no lap data" rather than guessing.

## Positioning

The genuinely AI-shaped piece of work is the **two-model composition and the 3-hop OpenF1 lookup + session-tertile fallback**. This is what neighboring radio-analysis tools do not do live: most surface the transcript, almost none correlate the exact lap the radio call sat inside, and almost none disclose what happens when that correlation fails. The bias is toward transparent mechanics over black-box inference.

## Operating Context

- Demo is live in front of judges with a 3-minute window. Backend cold-starts (free-tier Render spins down on idle).
- OpenF1's free tier covers 2023+ only; MikCil spans 2018+. Pre-2023 rows are a known absence, surfaced explicitly as `NO MATCH`, never a placeholder.
- The emotion model was trained on RAVDESS (scripted actor speech), not real broadcast radio. On broadcast audio the eight RAVDESS labels collapse to ~0.13 uniform confidence — a domain gap. The product discloses this in-line next to the badge rather than hiding it.
- All model inference runs in-process inside the FastAPI backend. No Hugging Face hosted Inference API calls during the demo path.
- Judges may upload an untested clip live to check whether results are cherry-picked. Two pre-tested presets plus 2–3 untested audibles must work end-to-end.

## Capabilities and Constraints

**Hard rules** (cannot violate, source: CLAUDE.md):
1. Models run in-process in the FastAPI backend, loaded once at startup.
2. Never fabricate or interpolate lap-time data. "No lap data" is a legitimate result.
3. Do not fuzzy-match driver names against OpenF1 at runtime — MikCil `racing_number` validates directly against OpenF1 `driver_number`.
4. The static `mapping/driver_ids.py` dict is dead code (kept as documented fallback); source of truth is racing_number → /v1/drivers validation.

**MVP locked in CLAUDE.md:**
- Audio upload (.wav/.mp3)
- Whisper transcript rendered to user
- Emotion badge (calm / stressed / tired) with confidence
- Lap-correlation chart with "no lap data" as a first-class state, not a fallback

**Operational:**
- Frontend on Vercel, backend on Render. URLs public.
- Demo rehearsed on a non-dev device.

## Brand Commitments

Names, identity, palette, and typography are **already locked** by the Day 2 prompt and CLAUDE.md — not subject to aesthetic consideration here. The visual world will be **pit-wall telemetry**, not a generic "dark SaaS dashboard."

- Name: "Silent Co-Driver" — telemetry-callsign framing, not a marketing wordmark.
- Palette: sector-timing colors (purple fastest / green on-pace / yellow fallback / red alert) on near-black `#0D1117` panels with hairline borders.
- Type: monospace face for any numeric or identifier (lap time, driver number, confidence), plain sans for prose. Tabular-nums on figures.
- Motif: sector bars, telemetry readouts, instrument panels. Not icons, not cards, not drop shadows.

## Evidence on Hand

- Cached MikCil/f1-team-radio dataset from Sunday pre-flight (6,144 rows, 2023+).
- 5/5 Day 1 test clips resolved with exact-lap matches — verified working chain.
- Day 1 backend live with `/analyze` returning structured JSON, transcript, emotion scores.
- Domain-gap observation: ~0.13 uniform confidence on 8 RAVDESS labels from real broadcast audio — confirmed in pre-flight and Day 1 test output.

**No fabricated assets:** Day 2 must extract preset audio bytes from the cached MikCil rows, not invent clips by driver+track name.

## Product Principles

1. **Tell judges what they're looking at.** A judge spends 3 minutes. Every panel must narrate itself on first glance.
2. **Honest over confident.** A 13% confidence is a 13% confidence. Show it; don't dress it up.
3. **"No data" is a result, not an error.** The third chart state exists because absence is information — surfacing it cleanly earns judge trust that nothing else was faked.
4. **Telemetry over decoration.** Numbers in mono, bars for comparisons, hairline borders for grouping. No icons, no shadows, no animated flourishes.

## Accessibility & Inclusion

- Color is never the only signal — sector labels carry text alongside (`EXACT MATCH`, `APPROXIMATE`, `NO MATCH`).
- Contrast checked against `#C9D1D9` body text on `#0D1117` base (≥ AA).
- Drag-and-drop is a convenience; native file picker remains the primary path (per Day 2 brief — "no drag-and-drop needed" was relaxed to drag-and-drop OK but file input required).
- Hover-tooltips carry the RAVDESS domain-gap explanation in plain language.

## Open Decisions

None blocking. Day 2 brief resolved palette, palette, type, motif, and chart states.