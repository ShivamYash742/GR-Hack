"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import AudioUploader from "@/components/AudioUploader";
import EmotionBadge from "@/components/EmotionBadge";
import dynamic from "next/dynamic";
const LapCorrelationChart = dynamic(() => import("@/components/LapCorrelationChart"), { ssr: false });
import MetadataForm, { type MetadataValues } from "@/components/MetadataForm";
import TranscriptPanel from "@/components/TranscriptPanel";
import { PRESETS, type Preset } from "@/data/presets";
import { analyzeAudio, AnalyzeError, pingBackend } from "@/lib/api";
import type { AnalyzeResponse } from "@/types/analysis";

type Stage =
  | "idle"
  | "uploading"
  | "transcribing"
  | "emotion"
  | "telemetry"
  | "done"
  | "error";

type StageStatus = "pending" | "active" | "done" | "error";

const STAGE_NODES = [
  { key: "upload"     as const, label: "Upload"    },
  { key: "transcribe" as const, label: "Whisper"   },
  { key: "emotion"    as const, label: "wav2vec2"  },
  { key: "telemetry"  as const, label: "OpenF1"    },
];

const STAGE_MAP: Record<Stage, number> = {
  idle: -1, uploading: 0, transcribing: 1, emotion: 2, telemetry: 3, done: 4, error: 4,
};

function nodeStatus(stage: Stage, nodeKey: string, errorAt: number): StageStatus {
  const idx = STAGE_NODES.findIndex((n) => n.key === nodeKey);
  const cur = STAGE_MAP[stage];
  if (stage === "error") {
    if (idx === errorAt) return "error";
    if (idx < errorAt)  return "done";
    return "pending";
  }
  if (cur === 4)   return "done";
  if (idx < cur)   return "done";
  if (idx === cur) return "active";
  return "pending";
}

const EMPTY_META: MetadataValues = {
  driverId: "TEST01", racingNumber: 99, grandPrix: "Test GP", sessionDate: "2023-01-01", messageTimestamp: "2023-01-01T12:00",
};

function toDatetimeLocal(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  return m ? `${m[1]}T${m[2]}` : "";
}

function metaFromPreset(p: Preset): MetadataValues {
  return {
    driverId: p.driverId,
    racingNumber: p.racingNumber,
    grandPrix: p.grandPrix,
    sessionDate: p.sessionDate,
    messageTimestamp: toDatetimeLocal(p.messageTimestamp),
  };
}

async function fetchPresetFile(p: Preset): Promise<File> {
  const resp = await fetch(p.audioUrl);
  if (!resp.ok) throw new Error(`Preset fetch failed: ${resp.status}`);
  const blob = await resp.blob();
  return new File([blob], `${p.id}.wav`, { type: "audio/wav" });
}

/* ═══════════════════════════════════════════════════════════════════════════ */

export default function HomePage() {
  const [file, setFile]             = useState<File | null>(null);
  const [metadata, setMetadata]     = useState<MetadataValues>(EMPTY_META);
  const [stage, setStage]           = useState<Stage>("idle");
  const [result, setResult]         = useState<AnalyzeResponse | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [errorAt, setErrorAt]       = useState(3);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [backend, setBackend]       = useState<"online" | "offline" | "checking">("checking");
  const [backendVer, setBackendVer] = useState<string | null>(null);

  const checkBackend = useCallback(async () => {
    setBackend("checking");
    const { ok, version } = await pingBackend();
    setBackend(ok ? "online" : "offline");
    if (ok && version) {
      setBackendVer(version);
    }
    return ok;
  }, []);

  useEffect(() => {
    let dead = false;
    let timer: NodeJS.Timeout | null = null;

    async function poll() {
      if (dead) return;
      const ok = await checkBackend();
      if (dead) return;
      const intervalMs = ok ? 30_000 : 5_000;
      timer = setTimeout(poll, intervalMs);
    }

    poll();

    return () => {
      dead = true;
      if (timer) clearTimeout(timer);
    };
  }, [checkBackend]);

  const running = !["idle", "done", "error"].includes(stage);

  const canSubmit =
    !!file && !running &&
    metadata.driverId.length > 0 &&
    metadata.grandPrix.length > 0 &&
    metadata.sessionDate.length > 0 &&
    metadata.messageTimestamp.length > 0;

  async function runPipeline(f: File, meta: MetadataValues) {
    setResult(null);
    setError(null);
    setErrorAt(3);
    // Step through visual stages — real API call is one shot
    setStage("transcribing");
    setStage("emotion");
    setStage("telemetry");
    try {
      const data = await analyzeAudio({
        file: f,
        driver_id: meta.driverId,
        racing_number: meta.racingNumber ?? undefined,
        grand_prix: meta.grandPrix,
        session_date: meta.sessionDate,
        message_timestamp: meta.messageTimestamp,
      });
      setResult(data);
      setBackend("online");
      setStage("done");
    } catch (e) {
      setError(
        e instanceof AnalyzeError ? e.message :
        e instanceof Error ? e.message : "Unknown failure"
      );
      setStage("error");
    }
  }

  async function handleSubmit() {
    if (!file || !canSubmit) return;
    setActivePreset(null);
    setStage("uploading");
    await runPipeline(file, metadata);
  }

  async function handlePreset(p: Preset) {
    const meta = metaFromPreset(p);
    setMetadata(meta);
    setError(null);
    setResult(null);
    setActivePreset(p.id);
    setStage("uploading");
    try {
      const pf = await fetchPresetFile(p);
      setFile(pf);
      await runPipeline(pf, meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load preset audio");
      setActivePreset(null);
      setStage("error");
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <AppHeader status={backend} version={backendVer} onRefresh={checkBackend} />

      {/* ── Timing board preset strip ───────────────────────────────────────── */}
      <div className="border-b border-[var(--border)]">
        <div className="max-w-[1440px] w-full mx-auto px-4 lg:px-6 py-4">
          <div className="flex items-baseline gap-3 mb-3">
            <span className="section-label">Dataset Presets</span>
            <span className="text-[10px] text-[var(--muted)] font-[family-name:var(--font-mono)]">
              Real MikCil rows · verified through live OpenF1 chain
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 border border-[var(--border)]">
            {PRESETS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                disabled={running}
                onClick={() => handlePreset(p)}
                className={[
                  "timing-tile",
                  activePreset === p.id && running ? "timing-tile--loading" : "",
                  activePreset === p.id ? "timing-tile--active" : "",
                  /* right divider for all but the last in each row */
                  i % 2 !== 1 ? "border-r border-[var(--border)]" : "",
                  /* bottom divider for first two on mobile */
                  i < 2 ? "border-b border-b-[var(--border)] lg:border-b-0" : "",
                  /* on lg+ add right divider between all but last */
                  i < 3 ? "lg:border-r lg:border-r-[var(--border)]" : "",
                ].join(" ")}
                title={`${p.driverId} #${p.racingNumber} · ${p.grandPrix} · ${p.sessionDate}`}
              >
                {/* Racing number column */}
                <div className="timing-tile__num">
                  {activePreset === p.id && running ? (
                    <span className="pulse-dot text-sm font-mono text-[var(--sector-yellow)]">↺</span>
                  ) : (
                    <span className="text-2xl font-black font-[family-name:var(--font-mono)] text-[var(--sector-purple)] tabnum leading-none">
                      {p.racingNumber}
                    </span>
                  )}
                </div>
                {/* Info column */}
                <div className="flex flex-col gap-0.5 px-3 py-3 flex-1 min-w-0">
                  <span className="text-xs font-bold font-[family-name:var(--font-mono)] text-[var(--body)] uppercase tracking-[0.06em] truncate">
                    {p.driverId}
                  </span>
                  <span className="text-[11px] text-[var(--muted)] font-[family-name:var(--font-sans)] leading-snug truncate">
                    {p.grandPrix.replace("2023 ", "").replace(" Grand Prix", " GP")}
                  </span>
                  <span className="text-[10px] text-[var(--muted)] font-[family-name:var(--font-mono)] tabnum mt-0.5">
                    L{p.expectedLapNumber} · {p.durationSeconds.toFixed(1)}s
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main grid: 2fr input | 3fr output ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-5 p-4 lg:p-6 max-w-[1440px] w-full mx-auto flex-1">

        {/* ── Left: Signal controls ──────────────────────────────────────── */}
        <section className="flex flex-col gap-4">

          {/* Upload */}
          <div className="hairline p-5 flex flex-col gap-4">
            <h2 className="section-label">Signal Input</h2>
            <AudioUploader file={file} onFile={setFile} />
          </div>

          {/* Metadata */}
          <MetadataForm values={metadata} onChange={setMetadata} disabled={running} />

          {/* Pipeline + Run */}
          <div className="hairline p-5 flex flex-col gap-4">
            <h2 className="section-label">Analysis Pipeline</h2>

            {/* Stage rail */}
            <div className="flex items-center gap-1.5">
              {STAGE_NODES.map((n, i) => {
                const status = nodeStatus(stage, n.key, errorAt);
                return (
                  <div key={n.key} className="flex items-center gap-1.5 flex-1 min-w-0">
                    <div className={`stage-node stage-node--${status} min-w-0`}>
                      <div className="stage-node__dot" />
                      <span className="hidden sm:block truncate">{n.label}</span>
                    </div>
                    {i < STAGE_NODES.length - 1 && (
                      <div className={`stage-connector ${status === "done" ? "stage-connector--done" : ""}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Error message */}
            {error && (
              <p className="text-xs text-[var(--alert-red)] font-[family-name:var(--font-mono)] border border-[var(--alert-red)] px-3 py-2">
                {error}
              </p>
            )}

            {/* Run button */}
            <button
              id="run-pipeline-btn"
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className={[
                "w-full py-3 text-sm font-[family-name:var(--font-mono)] uppercase tracking-[0.14em]",
                "border transition-all duration-150",
                canSubmit
                  ? "border-[var(--sector-yellow)] text-[var(--sector-yellow)] hover:bg-[rgba(255,217,61,0.06)] cursor-pointer"
                  : "border-[var(--border)] text-[var(--muted)] cursor-not-allowed opacity-40",
              ].join(" ")}
            >
              {running ? "Running…" : "Run Pipeline"}
            </button>
          </div>
        </section>

        {/* ── Right: Analysis output ─────────────────────────────────────── */}
        <section className="flex flex-col gap-4">

          {/* Transcript — primary output, most vertical space */}
          <TranscriptPanel transcript={result?.transcript ?? null} loading={running} />

          {/* Emotion + Lap — secondary, side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EmotionBadge emotion={result?.emotion ?? null} loading={running} />
            <LapCorrelationChart lap={result?.lap ?? null} loading={running} />
          </div>
        </section>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border)] px-4 lg:px-6 py-4 max-w-[1440px] w-full mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center flex-wrap gap-2">
          <span className="section-label">Pipeline</span>
          {["Whisper-small", "wav2vec2-lg-xlsr", "OpenF1 API"].map((m) => (
            <span key={m} className="chip chip--muted" style={{ fontSize: "9px" }}>{m}</span>
          ))}
          <span className="text-[10px] text-[var(--muted)] font-[family-name:var(--font-mono)]">
            · no HF hosted API · models run local
          </span>
        </div>
        <span className="chip chip--yellow" style={{ fontSize: "9px" }}>domain gap disclosed</span>
      </footer>
    </div>
  );
}

/* ─── Header ─────────────────────────────────────────────────────────────── */

function AppHeader({
  status,
  version,
  onRefresh,
}: {
  status: string;
  version: string | null;
  onRefresh: () => void;
}) {
  const dotColor =
    status === "online"   ? "var(--sector-green)"  :
    status === "checking" ? "var(--sector-yellow)" : "var(--muted)";
  const dotAnim = status === "checking" ? "pulse-dot" : "";
  const label =
    status === "online"   ? (version ?? "online") :
    status === "checking" ? "pinging…"             : "unreachable";

  return (
    <header className="header-scanlines border-b border-[var(--border)] px-4 lg:px-6 py-4 flex items-center justify-between max-w-[1440px] w-full mx-auto flex-wrap gap-4">
      <div className="flex items-center gap-3">
        {/* Left accent bar */}
        <div className="w-[3px] self-stretch" style={{ background: "var(--sector-purple)" }} />
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-black uppercase tracking-[0.2em] font-[family-name:var(--font-mono)] text-[var(--body)] leading-none">
            SILENT CO-DRIVER
          </h1>
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] font-[family-name:var(--font-mono)]">
            F1 Radio · Lap-Correlated Stress Decoder
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onRefresh}
        title="Click to check backend status"
        className="flex items-center gap-2 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.1em] cursor-pointer hover:opacity-80 transition-opacity border border-transparent hover:border-[var(--border)] px-2 py-1"
      >
        <span className="text-[var(--muted)]">Backend</span>
        <span
          className={dotAnim}
          style={{ display: "inline-block", width: 8, height: 8, background: dotColor, flexShrink: 0 }}
        />
        <span className="tabnum" style={{ color: dotColor }}>{label}</span>
      </button>
    </header>
  );
}

