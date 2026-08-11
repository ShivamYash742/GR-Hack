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

/**
 * Collapsible metadata override — presets are the primary path.
 * CSS-drawn chevron (no Unicode glyph), grid-template-rows accordion.
 */
export default function MetadataForm({ values, onChange, disabled }: MetadataFormProps) {
  const [open, setOpen] = useState(false);

  const set = <K extends keyof MetadataValues>(key: K, raw: string) => {
    const value =
      key === "racingNumber"
        ? ((raw === "" ? null : Number(raw)) as MetadataValues[K])
        : (raw as MetadataValues[K]);
    onChange({ ...values, [key]: value });
  };

  return (
    <section className="hairline">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-5 py-3 cursor-pointer"
      >
        <span className="section-label">Manual Override · metadata</span>
        <span className={`chevron ${open ? "chevron--open" : ""}`} aria-hidden />
      </button>

      <div className={`accordion-body ${open ? "accordion-body--open" : ""}`}>
        <div className="accordion-inner">
          <div className="grid grid-cols-2 gap-3 px-5 pb-5">
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
    </section>
  );
}
