"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_EXT = [".wav", ".mp3"];

interface AudioUploaderProps {
  file: File | null;
  onFile: (file: File | null) => void;
}

/**
 * Drag-and-drop zone with native file-picker fallback. The native input is
 * the primary path — drag-and-drop is a convenience layered on top.
 */
export default function AudioUploader({ file, onFile }: AudioUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const accept = useCallback((raw: File) => {
    setError(null);
    if (raw.size > MAX_BYTES) {
      setError(
        `File exceeds 25 MB limit (${(raw.size / 1024 / 1024).toFixed(1)} MB).`,
      );
      return false;
    }
    const ext = raw.name.toLowerCase().slice(raw.name.lastIndexOf("."));
    if (!ALLOWED_EXT.includes(ext)) {
      setError(`Unsupported file type "${ext}". Use .wav or .mp3.`);
      return false;
    }
    return true;
  }, []);

  const onSelect = useCallback(
    (raw: File | null) => {
      if (raw && accept(raw)) {
        onFile(raw);
      }
    },
    [accept, onFile],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    onSelect(dropped);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    onSelect(e.target.files?.[0] ?? null);
  };

  const clear = () => {
    onFile(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        className="dropzone p-6 cursor-pointer select-none"
        data-active={dragging}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload audio file (.wav or .mp3, max 25 MB)"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
      >
        <div className="flex flex-col items-start gap-2">
          <span className="text-xs uppercase tracking-[0.12em] text-[var(--muted)] font-[family-name:var(--font-mono)]">
            Audio Input
         </span>
          {file ? (
            <>
              <span className="text-sm font-[family-name:var(--font-mono)] tabnum">
                {file.name}
             </span>
              <span className="text-xs text-[var(--muted)] font-[family-name:var(--font-mono)] tabnum">
                {(file.size / 1024).toFixed(1)} KB ·{" "}
                {file.name.toLowerCase().endsWith(".wav") ? "WAV" : "MP3"}
             </span>
              {file && (
                <audio
                  controls
                  preload="metadata"
                  src={audioUrl ?? undefined}
                  className="w-full mt-2"
                />
              )}
            </>
          ) : (
            <span className="text-sm text-[var(--muted)]">
              Drag a .wav or .mp3 file here, or click to browse. ≤ 25 MB.
           </span>
          )}
       </div>
     </div>

      <input
        ref={inputRef}
        type="file"
        accept=".wav,.mp3,audio/wav,audio/mpeg,audio/x-wav"
        onChange={onChange}
        className="hidden"
      />

      <div className="flex items-center justify-between text-xs">
        {error ? (
          <span className="text-[var(--alert-red)] font-[family-name:var(--font-mono)] uppercase tracking-wider">
            {error}
         </span>
        ) : (
          <span className="text-[var(--muted)] font-[family-name:var(--font-mono)]">
            WAV @ 16 kHz mono recommended
         </span>
        )}
        {file && (
          <button
            type="button"
            onClick={clear}
            className="text-[var(--muted)] hover:text-[var(--body)] font-[family-name:var(--font-mono)] uppercase tracking-wider cursor-pointer"
          >
            Clear
         </button>
        )}
     </div>
   </div>
  );
}
