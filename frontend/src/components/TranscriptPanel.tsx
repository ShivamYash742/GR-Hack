"use client";

interface TranscriptPanelProps {
  transcript: string | null;
  loading?: boolean;
}

/**
 * Primary output panel. The transcript is the first thing a judge reads —
 * it must feel like a decoded signal, not a pasted string.
 *
 * Empty state: ghost lines with a blinking cursor — communicates "ready to
 * receive" rather than "nothing here yet."
 * Loading: shimmer skeleton that holds the panel's shape.
 * Result: radio log with a sector-purple speaker rail.
 */
export default function TranscriptPanel({ transcript, loading }: TranscriptPanelProps) {
  return (
    <section className="hairline flex flex-col" style={{ minHeight: 180 }}>
      <header className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[var(--border)]">
        <h2 className="section-label">Transcript · Whisper-small</h2>
        {transcript && !loading && (
          <span className="text-[10px] text-[var(--muted)] font-[family-name:var(--font-mono)] tabnum uppercase tracking-wider">
            {transcript.length} chars
          </span>
        )}
      </header>

      <div className="flex-1 px-5 py-4">
        {loading ? (
          /* Skeleton — three lines, maintains shape */
          <div className="flex flex-col gap-3">
            <div className="skeleton h-3.5 w-full" />
            <div className="skeleton h-3.5 w-4/5" />
            <div className="skeleton h-3.5 w-3/5" />
            <div className="skeleton h-3.5 w-2/3 mt-1" />
          </div>
        ) : transcript ? (
          /* Result — radio log with sector-purple speaker rail */
          <div className="radio-log">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--sector-purple)] font-[family-name:var(--font-mono)] mb-2">
              RADIO TX
            </p>
            <p className="text-base text-white font-[family-name:var(--font-mono)] leading-relaxed">
              &ldquo;{transcript}&rdquo;
            </p>
          </div>
        ) : (
          /* Empty state — intentional ghost, not "Awaiting upload." */
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--dim)] font-[family-name:var(--font-mono)]">
                SIGNAL PENDING
              </span>
              <span className="cursor-blink text-[var(--sector-purple)] font-[family-name:var(--font-mono)] text-sm leading-none">
                ▌
              </span>
            </div>
            <div className="ghost-bar w-full" />
            <div className="ghost-bar" style={{ width: "78%" }} />
            <div className="ghost-bar" style={{ width: "55%", opacity: 0.5 }} />
          </div>
        )}
      </div>
    </section>
  );
}
