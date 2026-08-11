import type { AnalyzeParams, AnalyzeResponse } from "@/types/analysis";

const rawUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://gr-hack.onrender.com";
const API_BASE_URL = rawUrl.trim().replace(/\/+$/, "");

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

  let resp: Response;
  try {
    resp = await fetch(`${API_BASE_URL}/analyze`, {
      method: "POST",
      mode: "cors",
      body: form,
    });
  } catch (err: any) {
    console.error("analyzeAudio fetch error:", err);
    throw new AnalyzeError(
      `Backend unreachable at ${API_BASE_URL} (${err?.message || err || "Network Error"}). If it's a hosted instance, this might be a cold-start — give it 30s.`,
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
  try {
    const resp = await fetch(`${API_BASE_URL}/health`, { mode: "cors" });
    if (!resp.ok) return { ok: false };
    const body = await resp.json();
    return { ok: body.status === "ok", version: body.version };
  } catch (err) {
    console.error("pingBackend error:", err);
    return { ok: false };
  }
}
