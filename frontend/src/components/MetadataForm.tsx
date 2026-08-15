"use client";

import { useState } from "react";

export interface MetadataValues {
  driverId: string;
  racingNumber: number | null;
  grandPrix: string;
  sessionDate: string;
  messageTimestamp: string;
}

interface MetadataFormProps {
  values: MetadataValues;
  onChange: (v: MetadataValues) => void;
  disabled?: boolean;
}

const RACE_PRESETS: Array<{
  label: string;
  driverId: string;
  racingNumber: number;
  grandPrix: string;
  sessionDate: string;
  messageTimestamp: string;
}> = [
  {
    label: "Bahrain GP · Leclerc #16",
    driverId: "CHALEC01",
    racingNumber: 16,
    grandPrix: "2023 Bahrain Grand Prix",
    sessionDate: "2023-03-05",
    messageTimestamp: "2023-03-05T15:50",
  },
  {
    label: "Bahrain GP · Alonso #14",
    driverId: "FERALO01",
    racingNumber: 14,
    grandPrix: "2023 Bahrain Grand Prix",
    sessionDate: "2023-03-05",
    messageTimestamp: "2023-03-05T15:25",
  },
  {
    label: "Azerbaijan GP · Verstappen #1",
    driverId: "MAXVER01",
    racingNumber: 1,
    grandPrix: "2023 Azerbaijan Grand Prix",
    sessionDate: "2023-04-30",
    messageTimestamp: "2023-04-30T10:16",
  },
  {
    label: "Azerbaijan GP · Hamilton #44",
    driverId: "LEWHAM01",
    racingNumber: 44,
    grandPrix: "2023 Azerbaijan Grand Prix",
    sessionDate: "2023-04-30",
    messageTimestamp: "2023-04-30T12:24",
  },
];

const FIELDS: Array<{
  key: keyof MetadataValues;
  label: string;
  placeholder: string;
  type: "text" | "number" | "date" | "datetime-local";
  span: "half" | "full";
}> = [
  { key: "driverId",         label: "driver_id",         placeholder: "CHALEC01",                type: "text",           span: "half" },
  { key: "racingNumber",     label: "racing_number",     placeholder: "16",                      type: "number",         span: "half" },
  { key: "grandPrix",        label: "grand_prix",        placeholder: "2023 Bahrain Grand Prix", type: "text",           span: "full" },
  { key: "sessionDate",      label: "session_date",      placeholder: "",                        type: "date",           span: "half" },
  { key: "messageTimestamp", label: "message_timestamp", placeholder: "",                        type: "datetime-local", span: "half" },
];

export default function MetadataForm({ values, onChange, disabled }: MetadataFormProps) {
  const [open, setOpen] = useState(false);

  const set = <K extends keyof MetadataValues>(key: K, raw: string) => {
    const value =
      key === "racingNumber"
        ? ((raw === "" ? null : Number(raw)) as MetadataValues[K])
        : (raw as MetadataValues[K]);
    onChange({ ...values, [key]: value });
  };

  const applyRacePreset = (p: typeof RACE_PRESETS[0]) => {
    onChange({
      driverId: p.driverId,
      racingNumber: p.racingNumber,
      grandPrix: p.grandPrix,
      sessionDate: p.sessionDate,
      messageTimestamp: p.messageTimestamp,
    });
  };

  return (
    <section className="hairline">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-5 py-3 cursor-pointer hover:bg-[rgba(255,255,255,0.02)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="section-label">Session Telemetry Metadata</span>
          <span className="text-[10px] text-[var(--muted)] font-mono">
            [{values.grandPrix.replace("2023 ", "")} · #{values.racingNumber}]
          </span>
        </div>
        <span className={`chevron ${open ? "chevron--open" : ""}`} aria-hidden />
      </button>

      <div className={`accordion-body ${open ? "accordion-body--open" : ""}`}>
        <div className="accordion-inner">
          <div className="flex flex-col gap-3 px-5 pb-5 pt-1">
            {/* Quick race context selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase font-mono text-[var(--muted)]">Quick Race Target:</span>
              <div className="grid grid-cols-2 gap-1.5">
                {RACE_PRESETS.map((p) => {
                  const isSelected =
                    values.driverId === p.driverId &&
                    values.grandPrix === p.grandPrix;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      disabled={disabled}
                      onClick={() => applyRacePreset(p)}
                      className={[
                        "text-[10px] font-mono px-2 py-1.5 border text-left truncate transition-colors cursor-pointer",
                        isSelected
                          ? "border-[var(--sector-purple)] text-[var(--sector-purple)] bg-[rgba(157,78,221,0.08)] font-bold"
                          : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--body)] hover:border-[var(--dim)] bg-[var(--base)]",
                      ].join(" ")}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Detailed fields */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border-dim)]">
              {FIELDS.map((f) => (
                <label
                  key={f.key}
                  className={`flex flex-col gap-1 ${f.span === "full" ? "col-span-2" : "col-span-2 sm:col-span-1"}`}
                >
                  <span className="section-label">{f.label}</span>
                  <input
                    type={f.type}
                    value={(values[f.key] ?? "") as string | number}
                    placeholder={f.placeholder}
                    disabled={disabled}
                    onChange={(e) => set(f.key, e.target.value)}
                    className="bg-[var(--base)] text-[var(--body)] border border-[var(--border)] px-2.5 py-1.5 text-sm font-[family-name:var(--font-mono)] tabnum focus:outline-none focus:border-[var(--sector-yellow)] disabled:opacity-50 transition-colors"
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
