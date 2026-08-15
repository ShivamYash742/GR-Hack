/**
 * Mirrors `backend/app/schemas/analysis.py` exactly. Keep in sync by hand.
 * If the backend schema changes, change this file in the same commit.
 */

export type EmotionBucket = "calm" | "stressed" | "tired" | string;

export interface EmotionResult {
  raw_label: string;
  score: number;
  bucket: EmotionBucket;
}

export type LapMethod =
  | "exact"
  | "fallback_early"
  | "fallback_mid"
  | "fallback_late"
  | "error";

export interface LapResult {
  lap_number: number | null;
  lap_duration: number | null;
  method: LapMethod;
  driver_mean: number | null;
  session_mean: number | null;
  error: string | null;
}

export interface AnalyzeResponse {
  transcript: string;
  emotion: EmotionResult;
  lap: LapResult;
}

export interface AnalyzeParams {
  file: File;
  driver_id: string;
  grand_prix: string;
  session_date: string;
  message_timestamp: string;
  racing_number?: number;
}

/** Friendly label per LapMethod for the UI. */
export const LAP_METHOD_LABEL: Record<LapMethod, string> = {
  exact: "EXACT MATCH",
  fallback_early: "APPROXIMATE — EARLY SESSION",
  fallback_mid: "APPROXIMATE — MID SESSION",
  fallback_late: "APPROXIMATE — LATE SESSION",
  error: "NO MATCH",
};

export const LAP_METHOD_TAG_COLOR: Record<
  LapMethod,
  "purple" | "yellow" | "muted"
> = {
  exact: "purple",
  fallback_early: "yellow",
  fallback_mid: "yellow",
  fallback_late: "yellow",
  error: "muted",
};

export type BackendMode = "auto" | "local" | "server" | "custom";
export type BackendTargetType = "local" | "server" | "custom";
export type BackendStatus = "online" | "offline" | "checking";

export interface BackendConnectionInfo {
  mode: BackendMode;
  targetType: BackendTargetType | null;
  activeUrl: string;
  configuredServerUrl: string;
  configuredLocalUrl: string;
  customUrl: string;
  status: BackendStatus;
  latencyMs: number | null;
  version: string | null;
  demoMode: boolean;
  lastChecked: number | null;
  errorMessage?: string | null;
}

export interface BackendPingResult {
  ok: boolean;
  url: string;
  targetType: BackendTargetType;
  latencyMs: number;
  version?: string;
  demoMode?: boolean;
  error?: string;
}

