"use client";

import type { EmotionResult } from "@/types/analysis";

interface EmotionBadgeProps {
  emotion: EmotionResult | null;
  loading?: boolean;
}

const BUCKET_COLOR: Record<string, "red" | "green" | "yellow"> = {
  stressed: "red",
  calm: "green",
  tired: "yellow",
};

/**
 * Emotion badge as a sector-color chip — no icons, no flame/shield/moon.
 * Always shows the raw model label, the bucket, and the confidence score.
 * Below a 0.25 threshold, a low-confidence warning is shown with the RAVDESS
 * domain-gap explanation in plain language.
 */
export default function EmotionBadge({ emotion, loading }: EmotionBadgeProps) {
  if (loading) {
    return (
      <section className="hairline p-4">
        <header className="mb-3">
          <h2 className="text-xs uppercase tracking-[0.12em] text-[var(--muted)] font-[family-name:var(--font-mono)]">
            Emotion · wav2vec2
     </h2>
       </header>
        <p className="text-sm text-[var(--muted)] font-[family-name:var(--font-mono)] italic">
          classifying…
     </p>
   </section>
    );
  }

  if (!emotion) {
    return (
      <section className="hairline p-4">
        <header className="mb-3">
          <h2 className="text-xs uppercase tracking-[0.12em] text-[var(--muted)] font-[family-name:var(--font-mono)]">
            Emotion · wav2vec2
     </h2>
       </header>
        <p className="text-sm text-[var(--muted)] font-[family-name:var(--font-mono)]">
          Awaiting upload.
     </p>
   </section>
    );
  }

  const chipColor = BUCKET_COLOR[emotion.bucket] ?? "yellow";
  const scorePct = (emotion.score * 100).toFixed(1);
  const lowConfidence = emotion.score < 0.25;

  return (
    <section className="hairline p-4 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-[0.12em] text-[var(--muted)] font-[family-name:var(--font-mono)]">
          Emotion · wav2vec2
   </h2>
        <span
          className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-[family-name:var(--font-mono)]"
          title="Confidence is the model's softmax score for the predicted raw class — not a guarantee."
        >
          confidence
   </span>
     </header>

      <div className="flex items-center gap-3 flex-wrap">
        <span className={`chip chip--${chipColor}`}>
          {emotion.bucket.toUpperCase()}
   </span>
        <span className="text-sm font-[family-name:var(--font-mono)] tabnum text-[var(--body)]">
          raw: {emotion.raw_label}
   </span>
        <span className="text-sm font-[family-name:var(--font-mono)] tabnum text-[var(--muted)]">
          {scorePct}%
   </span>
   </div>

      {lowConfidence && (
        <div
          className="chip chip--yellow self-start"
          title="wav2vec2-lg-xlsr was fine-tuned on RAVDESS — scripted actor speech. Real F1 broadcast noise pushes the model toward uniform-probability outputs across the 8 raw classes. This is a domain gap, not a model bug."
        >
          Low Model Confidence — Broadcast Audio Domain Gap
     </div>
      )}

      <dl className="grid grid-cols-3 gap-2 text-xs">
        <div className="row flex flex-col">
          <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-[family-name:var(--font-mono)]">
            Bucket
     </dt>
          <dd className="font-[family-name:var(--font-mono)] tabnum text-[var(--body)]">
            {emotion.bucket}
     </dd>
   </div>
        <div className="row flex flex-col">
          <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-[family-name:var(--font-mono)]">
            Score
     </dt>
          <dd className="font-[family-name:var(--font-mono)] tabnum text-[var(--body)]">
            {scorePct}%
     </dd>
   </div>
        <div className="row flex flex-col">
          <dt className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)] font-[family-name:var(--font-mono)]">
            Raw class
     </dt>
          <dd className="font-[family-name:var(--font-mono)] tabnum text-[var(--body)]">
            {emotion.raw_label}
     </dd>
   </div>
 </dl>
</section>
  );
}
