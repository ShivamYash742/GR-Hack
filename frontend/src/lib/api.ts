import type { AnalyzeParams, AnalyzeResponse } from "@/types/analysis";

const DEFAULT_API_BASE_URL = "/api/backend";
const HOSTED_FALLBACK_URL = "https://gr-hack.onrender.com";
const ANALYZE_TIMEOUT_MS = 90_000;
const HEALTH_TIMEOUT_MS = 25_000;

function normalizeApiBaseUrl(raw: string | undefined): string {
  const trimmed = (raw || HOSTED_FALLBACK_URL).trim().replace(/\/+$/, "");
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function apiUrlsToTry(): string[] {
  const urls: string[] = [];

  const pushCandidate = (raw: string | undefined) => {
    if (!raw) return;
    const normalized = normalizeApiBaseUrl(raw);
    if (normalized && !urls.includes(normalized)) {
      urls.push(normalized);
    }
  };

  // Strictly target hosted Render backend (and Next.js proxy route to Render)
  pushCandidate(activeBaseUrl);
  pushCandidate(PRIMARY_URL);
  pushCandidate(HOSTED_FALLBACK_URL);
  pushCandidate(DEFAULT_API_BASE_URL);

  return urls;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error || "Network Error");
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

const PRIMARY_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);

let activeBaseUrl = PRIMARY_URL;

export class AnalyzeError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AnalyzeError";
  }
}

export async function analyzeAudio(
  params: AnalyzeParams,
): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append("file", params.file);
  form.append("driver_id", params.driver_id);
  form.append("grand_prix", params.grand_prix);
  form.append("session_date", params.session_date);
  form.append("message_timestamp", params.message_timestamp);
  if (params.racing_number !== undefined && params.racing_number !== null) {
    form.append("racing_number", String(params.racing_number));
  }

  const urlsToTry = apiUrlsToTry();

  let resp: Response | null = null;
  let lastErr: unknown = null;

  for (const baseUrl of urlsToTry) {
    try {
      resp = await fetchWithTimeout(`${baseUrl}/analyze`, {
        method: "POST",
        mode: "cors",
        body: form,
      }, ANALYZE_TIMEOUT_MS);
      activeBaseUrl = baseUrl;
      break;
    } catch (err: unknown) {
      console.warn(`analyzeAudio fetch failed for ${baseUrl}, trying fallback if available...`, err);
      lastErr = err;
    }
  }

  if (!resp) {
    throw new AnalyzeError(
      `Backend unreachable at ${activeBaseUrl}. Original error: ${errorMessage(lastErr)}.`,
      0,
    );
  }

  if (resp.status === 400) {
    const body = await resp.json().catch(() => ({}));
    throw new AnalyzeError(body.error || "Bad request", 400);
  }
  if (resp.status === 500) {
    throw new AnalyzeError(
      "Inference failed (500). If cold-starting a free-tier backend, retry in 30s.",
      500,
    );
  }
  if (resp.status === 502 || resp.status === 503 || resp.status === 504) {
    throw new AnalyzeError(
      `Backend gateway timeout (${resp.status}). On Render, confirm SILENT_CO_DRIVER_DEMO_MODE=1 or redeploy the updated Dockerfile.`,
      resp.status,
    );
  }
  if (!resp.ok) {
    throw new AnalyzeError(`Unexpected status ${resp.status}`, resp.status);
  }
  return resp.json() as Promise<AnalyzeResponse>;
}

export async function pingBackend(): Promise<{ ok: boolean; version?: string; url?: string }> {
  const urlsToTry = apiUrlsToTry();

  for (const baseUrl of urlsToTry) {
    try {
      const resp = await fetchWithTimeout(
        `${baseUrl}/health`,
        { mode: "cors" },
        HEALTH_TIMEOUT_MS,
      );
      if (resp.ok) {
        const body = await resp.json();
        if (body && (body.status === "ok" || body.status === "healthy")) {
          activeBaseUrl = baseUrl;
          return { ok: true, version: body.version, url: baseUrl };
        }
      }
    } catch (err) {
      console.warn(`pingBackend failed for ${baseUrl}`, err);
    }
  }

  return { ok: false };
}
