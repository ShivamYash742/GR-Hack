import type { AnalyzeParams, AnalyzeResponse } from "@/types/analysis";

const PRIMARY_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://gr-hack.onrender.com"
).trim().replace(/\/+$/, "");

const LOCAL_FALLBACK_URL = "http://127.0.0.1:8000";

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

  const urlsToTry = [activeBaseUrl];
  if (!urlsToTry.includes(LOCAL_FALLBACK_URL)) {
    urlsToTry.push(LOCAL_FALLBACK_URL);
  }
  if (!urlsToTry.includes(PRIMARY_URL)) {
    urlsToTry.push(PRIMARY_URL);
  }

  let resp: Response | null = null;
  let lastErr: any = null;

  for (const baseUrl of urlsToTry) {
    try {
      resp = await fetch(`${baseUrl}/analyze`, {
        method: "POST",
        mode: "cors",
        body: form,
      });
      activeBaseUrl = baseUrl;
      break;
    } catch (err: any) {
      console.warn(`analyzeAudio fetch failed for ${baseUrl}, trying fallback if available...`, err);
      lastErr = err;
    }
  }

  if (!resp) {
    throw new AnalyzeError(
      `Backend unreachable at ${activeBaseUrl} (and fallback ${LOCAL_FALLBACK_URL}). Original error: ${lastErr?.message || lastErr || "Network Error"}.`,
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
  if (!resp.ok) {
    throw new AnalyzeError(`Unexpected status ${resp.status}`, resp.status);
  }
  return resp.json() as Promise<AnalyzeResponse>;
}

export async function pingBackend(): Promise<{ ok: boolean; version?: string }> {
  const urlsToTry = [activeBaseUrl];
  if (!urlsToTry.includes(LOCAL_FALLBACK_URL)) {
    urlsToTry.push(LOCAL_FALLBACK_URL);
  }
  if (!urlsToTry.includes(PRIMARY_URL)) {
    urlsToTry.push(PRIMARY_URL);
  }

  for (const baseUrl of urlsToTry) {
    try {
      const resp = await fetch(`${baseUrl}/health`, { mode: "cors" });
      if (resp.ok) {
        const body = await resp.json();
        if (body.status === "ok") {
          activeBaseUrl = baseUrl;
          return { ok: true, version: body.version };
        }
      }
    } catch (err) {
      console.warn(`pingBackend failed for ${baseUrl}`, err);
    }
  }

  return { ok: false };
}
