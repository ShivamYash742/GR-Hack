"use client";

interface TranscriptPanelProps {
  transcript: string | null;
  loading?: boolean;
}

/**
 * Renders the Whisper transcript like a radio log: monospace, all-caps-ish,
 * line-broken so a judge can read it back at a glance. Empty state when
 * the transcript hasn't arrived yet.
 */
export default function TranscriptPanel({
  transcript,
  loading,
}: TranscriptPanelProps) {
  return (
    <section className="hairline p-4">
      <header className="flex items-center justify-between mb-3">
        <h2 className="text-xs uppercase tracking-[0.12em] text-[var(--muted)] font-[family-name:var(--font-mono)]">
          Transcript · Whisper-small
    </h2>
        {transcript && !loading && (
          <span className="text-[10px] text-[var(--muted)] font-[family-name:var(--font-mono)] uppercase tracking-wider">
            {transcript.length} chars
    </span>
        )}
  </header>

      <div className="bg-[var(--panel)] border border-[var(--border)] p-3 min-h-[6rem]">
        {loading ? (
          <p className="text-sm text-[var(--muted)] font-[family-name:var(--font-mono)] italic">
            transcribing…
      </p>
        ) : transcript ? (
          <p className="text-base text-[var(--body)] font-[family-name:var(--font-mono)] tabnum leading-snug quote">
            &ldquo;{transcript}&rdquo;
      </p>
        ) : (
          <p className="text-sm text-[var(--muted)] font-[family-name:var(--font-mono)]">
            Awaiting upload.
      </p>
        )}
  </div>
</section>
  );
}
