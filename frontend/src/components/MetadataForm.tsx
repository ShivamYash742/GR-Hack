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
  onChange: (values: MetadataValues) => void;
  /** Disabled while a submission is in flight. */
  disabled?: boolean;
}

const FIELDS: Array<{
  key: keyof MetadataValues;
  label: string;
  placeholder: string;
  type: "text" | "number" | "date" | "datetime-local";
  width: "half" | "full";
}> = [
  {
    key: "driverId",
    label: "driver_id",
    placeholder: "CHALEC01",
    type: "text",
    width: "half",
  },
  {
    key: "racingNumber",
    label: "racing_number",
    placeholder: "16",
    type: "number",
    width: "half",
  },
  {
    key: "grandPrix",
    label: "grand_prix",
    placeholder: "2023 Bahrain Grand Prix",
    type: "text",
    width: "full",
  },
  {
    key: "sessionDate",
    label: "session_date",
    placeholder: "",
    type: "date",
    width: "half",
  },
  {
    key: "messageTimestamp",
    label: "message_timestamp",
    placeholder: "",
    type: "datetime-local",
    width: "half",
  },
];

/**
 * Collapsed "advanced" metadata block. Presets are the primary interaction;
 * this is for testing with arbitrary clips. Drive fields via `onChange`.
 *
 * The form prevents re-editing during submission so judge-driven demos don't
 * lose state to a half-typed form.
 */
export default function MetadataForm({
  values,
  onChange,
  disabled,
}: MetadataFormProps) {
  const [open, setOpen] = useState(false);

  const setField = <K extends keyof MetadataValues>(
    key: K,
    raw: string,
  ) => {
    let value: MetadataValues[K];
    if (key === "racingNumber") {
      value = (raw === "" ? null : Number(raw)) as MetadataValues[K];
    } else {
      value = raw as MetadataValues[K];
    }
    onChange({ ...values, [key]: value });
  };

  return (
    <section className="hairline">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-4 py-3 cursor-pointer"
      >
        <span className="text-xs uppercase tracking-[0.12em] text-[var(--muted)] font-[family-name:var(--font-mono)]">
          Advanced · metadata override
      </span>
        <span className="text-xs text-[var(--muted)] font-[family-name:var(--font-mono)]">
          {open ? "▾" : "▸"}
      </span>
     </button>
      {open && (
        <div className="grid grid-cols-2 gap-3 px-4 pb-4">
          {FIELDS.map((f) => (
            <label
              key={f.key}
              className={`flex flex-col gap-1 ${
                f.width === "full" ? "col-span-2" : "col-span-2 sm:col-span-1"
              }`}
            >
              <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-[family-name:var(--font-mono)]">
                {f.label}
            </span>
              <input
                type={f.type}
                value={(values[f.key] ?? "") as string | number}
                placeholder={f.placeholder}
                disabled={disabled}
                onChange={(e) => setField(f.key, e.target.value)}
                className="bg-[var(--panel)] text-[var(--body)] border border-[var(--border)] px-2 py-1.5 text-sm font-[family-name:var(--font-mono)] tabnum focus:outline-none focus:border-[var(--sector-yellow)] disabled:opacity-50"
              />
          </label>
          ))}
      </div>
      )}
  </section>
  );
}
