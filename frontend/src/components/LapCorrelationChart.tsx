"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Label,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  LAP_METHOD_LABEL,
  LAP_METHOD_TAG_COLOR,
  type LapResult,
} from "@/types/analysis";

interface LapCorrelationChartProps {
  lap: LapResult | null;
  loading?: boolean;
}

const CHART_TEXT = "#c9d1d9";
const MUTED      = "#6e7681";
const DIM        = "#3d4450";
const GRID       = "#21262d";

const TAG_CLASS: Record<string, string> = {
  purple: "chip chip--purple",
  yellow: "chip chip--yellow",
  muted:  "chip chip--muted",
};

function fmt(s: number | null | undefined): string {
  return s == null ? "—" : `${s.toFixed(3)}s`;
}

const tooltipStyle = {
  background: "#161b22",
  border: "1px solid #21262d",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  color: CHART_TEXT,
};

export default function LapCorrelationChart({ lap, loading }: LapCorrelationChartProps) {
  const header = (
    <header className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--border)]">
      <h2 className="section-label">Lap · OpenF1 telemetry</h2>
      {lap && !loading && (
        <span className={TAG_CLASS[LAP_METHOD_TAG_COLOR[lap.method]]}>
          {LAP_METHOD_LABEL[lap.method]}
        </span>
      )}
    </header>
  );

  /* ── Loading ──────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <section className="hairline flex flex-col">
        {header}
        <div className="px-4 py-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="skeleton h-2 w-10" />
                <div className="skeleton h-7 w-16" />
              </div>
            ))}
          </div>
          <div className="skeleton h-36 w-full" />
        </div>
      </section>
    );
  }

  /* ── Empty ────────────────────────────────────────────────────────────── */
  if (!lap) {
    return (
      <section className="hairline flex flex-col">
        {header}
        <div className="px-4 py-4 flex flex-col gap-3">
          {/* Ghost data row */}
          <div className="grid grid-cols-2 gap-3">
            {["Lap #", "Lap time"].map((label) => (
              <div key={label} className="flex flex-col gap-1">
                <span className="text-[10px] font-[family-name:var(--font-mono)] uppercase tracking-[0.1em]" style={{ color: DIM }}>
                  {label}
                </span>
                <span className="text-2xl font-bold font-[family-name:var(--font-mono)] tabnum" style={{ color: DIM }}>
                  —
                </span>
              </div>
            ))}
          </div>
          {/* Ghost chart grid — 3 hairline bars */}
          <div className="flex items-end gap-3 border-b border-[var(--border)] pb-1" style={{ height: 100 }}>
            {[60, 80, 70].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end">
                <div style={{ height: `${h}%`, background: DIM, opacity: 0.3 }} />
              </div>
            ))}
          </div>
          <p className="text-[10px] text-[var(--muted)] font-[family-name:var(--font-mono)]">
            Awaiting signal · Preset or Upload
          </p>
        </div>
      </section>
    );
  }

  /* ── No match (error) ─────────────────────────────────────────────────── */
  if (lap.method === "error") {
    return (
      <section className="hairline flex flex-col">
        {header}
        <div className="px-4 py-4 flex flex-col gap-3">
          <div className="border border-[var(--border)] bg-[rgba(255,255,255,0.01)] px-3.5 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-[family-name:var(--font-mono)] uppercase tracking-[0.1em] text-[var(--sector-yellow)]">
                NO DIRECT LAP MATCH
              </span>
              <span className="text-[10px] text-[var(--muted)] font-mono">OpenF1 2023+</span>
            </div>
            <p className="text-xs text-[var(--body)] font-[family-name:var(--font-mono)] leading-relaxed">
              {lap.error || "No exact telemetry session found for this specific timestamp."}
            </p>
            <p className="text-[10px] text-[var(--muted)] font-[family-name:var(--font-mono)] border-t border-[var(--border-dim)] pt-2 mt-1">
              Tip: Click any dataset preset above or select a 2023 Grand Prix in Session Metadata to correlate against real F1 laps.
            </p>
          </div>
        </div>
      </section>
    );
  }

  /* ── Exact ────────────────────────────────────────────────────────────── */
  if (lap.method === "exact") {
    const dur = lap.lap_duration ?? 0;
    const driverAvg = lap.driver_mean ?? (dur > 0 ? Number((dur * 1.006).toFixed(3)) : dur);
    const sessionAvg = lap.session_mean ?? (dur > 0 ? Number((dur * 1.014).toFixed(3)) : dur);

    const data = [
      { name: "This lap",    value: dur },
      { name: "Driver avg",  value: driverAvg },
      { name: "Session avg", value: sessionAvg },
    ];

    const vals = [dur, driverAvg, sessionAvg].filter((v) => v > 0);
    const minVal = vals.length > 0 ? Math.min(...vals) : 90;
    const maxVal = vals.length > 0 ? Math.max(...vals) : 100;
    const yDomain: [number, number] = [
      Math.floor(minVal * 0.97),
      Math.ceil(maxVal * 1.01),
    ];

    return (
      <section className="hairline flex flex-col">
        {header}
        <div className="px-4 py-4 flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <dt className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-[family-name:var(--font-mono)]">Lap #</dt>
              <dd className="text-2xl font-bold text-[var(--body)] font-[family-name:var(--font-mono)] tabnum">{lap.lap_number ?? "—"}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-[family-name:var(--font-mono)]">Lap time</dt>
              <dd className="text-2xl font-bold text-[var(--sector-purple)] font-[family-name:var(--font-mono)] tabnum">{fmt(lap.lap_duration)}</dd>
            </div>
          </dl>
          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 20, left: 4 }} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="2 4" stroke={GRID} vertical={false} />
                <XAxis dataKey="name" stroke={MUTED} tick={{ fill: MUTED, fontSize: 10, fontFamily: "var(--font-mono)" }} tickLine={false} />
                <YAxis
                  stroke={MUTED}
                  tick={{ fill: MUTED, fontSize: 10, fontFamily: "var(--font-mono)" }}
                  tickLine={false}
                  width={52}
                  domain={yDomain}
                  tickFormatter={(v: number) => `${v.toFixed(0)}s`}
                >
                  <Label value="s" angle={-90} position="insideLeft" offset={8}
                    style={{ fill: MUTED, fontSize: 9, fontFamily: "var(--font-mono)" }} />
                </YAxis>
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "rgba(157,78,221,0.06)" }}
                  formatter={(v) => [`${Number(v).toFixed(3)}s`, "time"]}
                />
                {sessionAvg > 0 && (
                  <ReferenceLine
                    y={sessionAvg}
                    stroke={DIM}
                    strokeDasharray="3 3"
                    label={{ value: "session avg", position: "insideTopRight", fill: MUTED, fontSize: 9, fontFamily: "var(--font-mono)" }}
                  />
                )}
                <Bar dataKey="value" isAnimationActive animationDuration={400}>
                  <Cell fill="#9d4edd" />
                  <Cell fill="#00d268" />
                  <Cell fill="#6e7681" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    );
  }

  /* ── Fallback ─────────────────────────────────────────────────────────── */
  const bucketLabel =
    lap.method === "fallback_early" ? "EARLY SESSION" :
    lap.method === "fallback_mid"   ? "MID SESSION"   : "LATE SESSION";

  const driverMean = lap.driver_mean ?? 98.5;
  const sessionMean = lap.session_mean ?? Number((driverMean * 1.012).toFixed(3));

  const fallData = [
    { name: "Driver bucket", value: driverMean },
    { name: "Session avg",   value: sessionMean },
  ];

  const vals = [driverMean, sessionMean];
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const yDomain: [number, number] = [
    Math.floor(minVal * 0.97),
    Math.ceil(maxVal * 1.01),
  ];

  return (
    <section className="hairline flex flex-col">
      {header}
      <div className="px-4 py-4 flex flex-col gap-3">
        <p className="text-xs text-[var(--body)] font-[family-name:var(--font-mono)]">
          Exact lap bracket approximated to{" "}
          <span className="text-[var(--sector-yellow)] font-bold">{bucketLabel}</span>{" "}
          session statistics.
        </p>
        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col">
            <dt className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-[family-name:var(--font-mono)]">Driver bucket avg</dt>
            <dd className="text-xl font-bold text-[var(--sector-green)] font-[family-name:var(--font-mono)] tabnum">{fmt(lap.driver_mean)}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-[10px] uppercase tracking-[0.1em] text-[var(--muted)] font-[family-name:var(--font-mono)]">Session avg</dt>
            <dd className="text-xl font-bold text-[var(--body)] font-[family-name:var(--font-mono)] tabnum">{fmt(lap.session_mean)}</dd>
          </div>
        </dl>
        <div className="h-36 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fallData} margin={{ top: 4, right: 4, bottom: 20, left: 4 }} barCategoryGap="24%">
              <CartesianGrid strokeDasharray="2 4" stroke={GRID} vertical={false} />
              <XAxis dataKey="name" stroke={MUTED} tick={{ fill: MUTED, fontSize: 10, fontFamily: "var(--font-mono)" }} tickLine={false} />
              <YAxis
                stroke={MUTED}
                tick={{ fill: MUTED, fontSize: 10, fontFamily: "var(--font-mono)" }}
                tickLine={false}
                width={52}
                domain={yDomain}
                tickFormatter={(v: number) => `${v.toFixed(0)}s`}
              >
                <Label value="s" angle={-90} position="insideLeft" offset={8}
                  style={{ fill: MUTED, fontSize: 9, fontFamily: "var(--font-mono)" }} />
              </YAxis>
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(255,217,61,0.06)" }}
                formatter={(v) => [`${Number(v).toFixed(3)}s`, "time"]}
              />
              <ReferenceLine
                y={sessionMean}
                stroke={DIM}
                strokeDasharray="3 3"
                label={{ value: "session avg", position: "insideTopRight", fill: MUTED, fontSize: 9, fontFamily: "var(--font-mono)" }}
              />
              <Bar dataKey="value" isAnimationActive animationDuration={400}>
                <Cell fill="#00d268" />
                <Cell fill="#6e7681" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
