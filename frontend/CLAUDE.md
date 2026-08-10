# CLAUDE.md — frontend/

Read this after the root `CLAUDE.md`, not instead of it. This file does
NOT own the API contract, the OpenF1 chain, the emotion-label mapping, or
any Hard Rule — those live in root `CLAUDE.md` and this file must not
restate them, to avoid the two files drifting apart the way root
`CLAUDE.md`'s Hard Rule #4 went stale on Day 1 (fixed, but that's exactly
the failure mode duplication causes). If you need the `/analyze` response
shape, read `backend/app/schemas/analysis.py` directly — it's the actual
source of truth, not a description of it in either CLAUDE.md.

What this file owns: where things live in `frontend/`, and the frontend
design decisions specific to this folder.

## Primary user — locked

Competition judge, 3-minute live demo. Not a race engineer in repeated
real-session use. This is the single decision that shapes everything
below — optimize for a stranger understanding what they're looking at in
seconds, not for dense, repeated, keyboard-driven use. If you're about to
add a keyboard shortcut, a settings panel, or anything that trades
first-glance clarity for efficiency-on-the-Nth-use, stop — that's the
wrong user model for this build.

Concretely:
- Presets are the primary interaction path, not a fallback next to a
  form. A judge should be able to click one and watch the pipeline run
  without typing anything.
- The metadata form (`driver_id`, `session_date`, etc.) is a collapsed
  "advanced" section, not the default view. It exists so you can test
  with arbitrary clips, not so a judge fills out fields.
- Every chart state (exact / fallback / no-data — see root CLAUDE.md's
  OpenF1 section) must be self-explanatory within about 10 seconds, on
  first glance, with no verbal narration required. If a state needs you
  to explain it out loud during the pitch, it hasn't done its job.
- The confidence-score tooltip on the emotion badge is load-bearing, not
  decorative — it's what stops the domain-gap finding (root CLAUDE.md)
  from reading as a bug when a judge sees a low score.

## Design system — locked, do not revert to defaults

Full rationale in `DAY2_PROMPT.md` Step 7. Do not fall back to
dark-background-plus-one-accent — that was identified and rejected as the
generic default for this build, not a style preference.

| Token | Value | Use |
|---|---|---|
| Base | `#0D1117` | page background |
| Panel | `#161B22` | card/panel background |
| Border | `#2A313C` | hairline, 1px, no rounded corners |
| Sector-purple | `#9D4EDD` | exact lap match |
| Sector-green | `#00D268` | calm |
| Sector-yellow | `#FFD93D` | fallback / approximate |
| Alert-red | `#E10600` | stressed — the one saturated color, use deliberately |
| Body text | `#C9D1D9` | |
| Muted label | `#6E7681` | "no data" states — absence, not a result, so it does NOT get a sector color |

Type: monospace (`JetBrains Mono` or `IBM Plex Mono`) for every number —
lap times, timestamps, driver numbers, confidence scores — with
tabular-nums so columns align. Plain sans (`Inter` or system-ui) for
everything else. No status icons (flame/shield/moon) — sector-color chips
only, same visual language across the emotion badge and the lap chart.

Motion: minimal. No looping or decorative transitions. If the lap bar
chart animates, it draws in once on data arrival, not on every render.

## File map

```
frontend/
├── CLAUDE.md               # this file
├── AGENTS.md                # same facts, for non-Claude-Code tools
├── src/
│   ├── app/
│   │   ├── page.tsx          # main dashboard — 2-column, see Step 7
│   │   └── globals.css       # design tokens above, as CSS variables
│   ├── components/
│   │   ├── AudioUploader.tsx
│   │   ├── MetadataForm.tsx    # collapsed/advanced, not primary
│   │   ├── TranscriptPanel.tsx
│   │   ├── EmotionBadge.tsx    # sector-color chip, mono label, no icons
│   │   └── LapCorrelationChart.tsx  # 3 states, see root CLAUDE.md
│   ├── data/
│   │   └── presets.ts        # REAL dataset rows only — see warning below
│   ├── lib/
│   │   └── api.ts            # analyzeAudio(), posts to NEXT_PUBLIC_API_BASE_URL
│   └── types/
│       └── analysis.ts       # mirrors backend/app/schemas/analysis.py — keep in sync by hand
```

## Presets — hard rule specific to this file

`presets.ts` must contain only rows pulled verbatim from the actual
MikCil dataset, each independently confirmed to resolve through the full
OpenF1 chain before it ships. Do not write preset metadata from general
F1 knowledge (a real driver + real track + a plausible date is not the
same as a real row with a real audio clip attached). A preset that fails
live in front of a judge is worse than having no presets. Full reasoning
in `DAY2_PROMPT.md` Step 3.

## Commands

```bash
cd frontend
npm run dev      # local dev server
npm run build    # confirm this succeeds before deploying — Day 2 Step 8 depends on it
```

## Status

Tracked in root `CLAUDE.md`'s "Current Status" section, not duplicated
here. Update that file, not this one, when frontend work lands.
