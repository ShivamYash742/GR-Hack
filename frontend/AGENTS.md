# AGENTS.md — frontend/

Context for any AI coding tool working in this folder. This is a mirror of
`CLAUDE.md` in this same directory — same facts, written without
assuming a specific tool's session model. If you edit one file, edit the
other to match; they must not drift apart.

Read the repo root's `CLAUDE.md` first for anything not covered here: the
`/analyze` API contract, the OpenF1 lookup chain, the emotion-label
mapping, and the project's hard rules. This file does not restate those —
if you need the exact response shape, read `backend/app/schemas/analysis.py`
directly, since a description of a schema drifts from the schema itself
over time and the file is the only thing guaranteed current.

## Primary user — locked

Competition judge watching a 3-minute live demo, not a race engineer in
repeated real-session use. This determines the tradeoff on every UI
decision in this folder: optimize for a stranger understanding what's on
screen within seconds, not for efficiency on repeated use. Do not add
keyboard shortcuts, settings panels, or dense low-chrome views — wrong
user model for this build.

What follows from that:
- Preset buttons are the primary interaction, not a form with buttons
  next to it. One click, pipeline runs, no typing required.
- The manual metadata form is a collapsed "advanced" section.
- Every result state (exact lap match / fallback / no data) must be
  understandable on first glance, in about 10 seconds, without spoken
  explanation.
- The confidence-score tooltip on the emotion badge is required, not
  optional — without it, a low confidence score reads as a broken model
  instead of a disclosed and expected domain gap.

## Design system — locked

Do not default to a dark background plus one bright accent color. That
combination was evaluated and rejected for this project specifically
(see `DAY2_PROMPT.md`, Step 7) — it reads as a generic AI-generated
template regardless of the subject matter. The palette below is grounded
in F1 pit-wall telemetry and timing-screen conventions instead.

| Token | Value | Use |
|---|---|---|
| Base | `#0D1117` | page background |
| Panel | `#161B22` | card/panel background |
| Border | `#2A313C` | 1px hairline, no border-radius |
| Sector-purple | `#9D4EDD` | exact lap match |
| Sector-green | `#00D268` | calm |
| Sector-yellow | `#FFD93D` | fallback / approximate match |
| Alert-red | `#E10600` | stressed — reserve as the only saturated color |
| Body text | `#C9D1D9` | |
| Muted label | `#6E7681` | "no data" state only — this is an absence, not a result, so it must not use a sector color |

Numbers (lap times, timestamps, driver numbers, confidence scores) render
in a monospace face (`JetBrains Mono` or `IBM Plex Mono`) with
tabular-nums. Everything else uses a plain sans (`Inter` or system-ui).
No icon-based status indicators — sector-color chips only, applied
consistently to both the emotion badge and the lap-correlation chart so
they share one visual language. Motion is minimal: no looping
transitions; if a chart animates on data arrival, it does so once.

## File map

```
frontend/
├── CLAUDE.md
├── AGENTS.md                 # this file
├── src/
│   ├── app/
│   │   ├── page.tsx           # 2-column dashboard layout
│   │   └── globals.css        # design tokens above, as CSS variables
│   ├── components/
│   │   ├── AudioUploader.tsx
│   │   ├── MetadataForm.tsx     # advanced/collapsed, not the primary flow
│   │   ├── TranscriptPanel.tsx
│   │   ├── EmotionBadge.tsx     # sector-color chip + mono label, no icons
│   │   └── LapCorrelationChart.tsx  # exact / fallback / no-data states
│   ├── data/
│   │   └── presets.ts         # real dataset rows only, see rule below
│   ├── lib/
│   │   └── api.ts             # calls NEXT_PUBLIC_API_BASE_URL + /analyze
│   └── types/
│       └── analysis.ts        # kept in sync by hand with backend/app/schemas/analysis.py
```

## Preset data rule

Every entry in `presets.ts` must be a row pulled verbatim from the actual
MikCil dataset (already downloaded locally), independently confirmed to
resolve through the live OpenF1 lookup chain before use. Do not invent
preset metadata from general F1 knowledge — a real driver, a real
circuit, and a plausible date do not add up to a real row with a real
audio clip attached. A preset that fails in front of a judge live is
worse than shipping with no presets at all.

## Commands

```bash
cd frontend
npm run dev
npm run build   # must succeed before any deploy step
```

## Status tracking

Not tracked in this file. Progress updates go in the repo root's
`CLAUDE.md`, under "Current Status" — one status log for the whole
project, not one per folder.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
