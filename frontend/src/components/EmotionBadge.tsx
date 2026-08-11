"use client";

import { useEffect, useRef } from "react";
import type { EmotionResult } from "@/types/analysis";

interface EmotionBadgeProps {
  emotion: EmotionResult | null;
  loading?: boolean;
}

const BUCKET_COLOR: Record<string, "red" | "green" | "yellow"> = {
  stressed: "red",
  calm:     "green",
  tired:    "yellow",
};

const BUCKET_CSS: Record<string, string> = {
  stressed: "var(--alert-red)",
  calm:     "var(--sector-green)",
  tired:    "var(--sector-yellow)",
};

/**
 * Emotion panel — bucket chip + animated confidence bar.
 * Empty state: empty bar track to signal what will appear.
 * Low confidence: RAVDESS domain-gap note surfaced inline.
 */
export default function EmotionBadge({ emotion, loading }: EmotionBadgeProps) {
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fillRef.current || !emotion) return;
    fillRef.current.style.width = "0%";
    const raf = requestAnimationFrame(() => {
      if (fillRef.current) {
        fillRef.current.style.width = `${(emotion.score * 100).toFixed(1)}%`;
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [emotion]);

  return (
    <section className="hairline flex flex-col">
      <header className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[var(--border)]">
        <h2 className="section-label">Emotion · wav2vec2</h2>
        <span
          className="section-label cursor-help"
          title="Confidence is the model's softmax score for the predicted raw class — not a guarantee."
        >
          confidence
        </span>
      </header>

      <div className="px-4 py-4 flex flex-col gap-3 flex-1">
        {loading ? (
          <>
            <div className="flex items-center gap-3">
              <div className="skeleton h-5 w-20" />
              <div className="skeleton h-4 w-24 ml-auto" />
            </div>
            <div className="skeleton h-1.5 w-full" />
          </>
        ) : emotion ? (
          <>
            {/* Chip row */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`chip chip--${BUCKET_COLOR[emotion.bucket] ?? "yellow"}`}>
                {emotion.bucket.toUpperCase()}
              </span>
              <span className="text-xs font-[family-name:var(--font-mono)] text-[var(--muted)]">
                {emotion.raw_label}
              </span>
              <span className="text-sm font-[family-name:var(--font-mono)] tabnum text-[var(--body)] ml-auto font-bold">
                {(emotion.score * 100).toFixed(1)}%
              </span>
            </div>

            {/* Confidence bar */}
            <div className="confidence-track">
              <div
                ref={fillRef}
                className="confidence-fill"
                style={{ background: BUCKET_CSS[emotion.bucket] ?? "var(--sector-yellow)", width: "0%" }}
              />
            </div>

            {/* Domain-gap warning */}
            {emotion.score < 0.25 && (
              <div
                className="chip chip--yellow self-start"
                style={{ fontSize: "9px" }}
                title="wav2vec2-lg-xlsr was fine-tuned on RAVDESS scripted actor speech. Real F1 broadcast noise pushes the model toward uniform-probability outputs across 8 raw classes — a domain gap, not a model bug."
              >
                Low confidence · RAVDESS domain gap
              </div>
            )}
          </>
        ) : (
          /* Empty state — show the bar track so the layout reads */
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="hairline px-3 py-1">
                <span className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--dim)] uppercase tracking-widest">
                  —
                </span>
              </div>
              <span className="text-xs text-[var(--dim)] font-[family-name:var(--font-mono)] ml-auto">—%</span>
            </div>
            <div className="confidence-track opacity-25" />
            <p className="text-[10px] text-[var(--muted)] font-[family-name:var(--font-mono)]">
              Awaiting signal
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
