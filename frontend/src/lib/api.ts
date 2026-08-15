import type {
  AnalyzeParams,
  AnalyzeResponse,
  BackendConnectionInfo,
  BackendMode,
  BackendPingResult,
  BackendTargetType,
} from "@/types/analysis";

export const DEFAULT_SERVER_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://gr-hack.onrender.com"
).trim().replace(/\/+$/, "");

export const DEFAULT_LOCAL_URL = "http://127.0.0.1:8000";

const STORAGE_KEY_MODE = "silent_codriver_backend_mode";
const STORAGE_KEY_CUSTOM_URL = "silent_codriver_custom_url";

function getStoredMode(): BackendMode {
  if (typeof window === "undefined") return "auto";
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MODE);
    if (saved === "auto" || saved === "local" || saved === "server" || saved === "custom") {
      return saved;
    }
  } catch {
    // Ignore localStorage errors (e.g. incognito/SSR)
  }
  return "auto";
}

function getStoredCustomUrl(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEY_CUSTOM_URL) || "";
  } catch {
    return "";
  }
}

let currentMode: BackendMode = getStoredMode();
let currentCustomUrl: string = getStoredCustomUrl();
let activeBaseUrl: string = DEFAULT_LOCAL_URL;

let currentConnectionInfo: BackendConnectionInfo = {
  mode: currentMode,
  targetType: null,
  activeUrl: DEFAULT_LOCAL_URL,
  configuredServerUrl: DEFAULT_SERVER_URL,
  configuredLocalUrl: DEFAULT_LOCAL_URL,
  customUrl: currentCustomUrl,
  status: "checking",
  latencyMs: null,
  version: null,
  demoMode: false,
  lastChecked: null,
  errorMessage: null,
};

export function classifyTargetType(url: string): BackendTargetType {
  const clean = (url || "").toLowerCase();
  if (
    clean.includes("127.0.0.1") ||
    clean.includes("localhost") ||
    clean.includes("0.0.0.0") ||
    clean.startsWith("http://192.168.") ||
    clean.startsWith("http://10.")
  ) {
    return "local";
  }
  if (clean.includes("onrender.com") || clean.includes("vercel.app") || clean.includes("hf.space") || clean === DEFAULT_SERVER_URL.toLowerCase()) {
    return "server";
  }
  return "custom";
}

export function getConnectionConfig() {
  return {
    mode: currentMode,
    customUrl: currentCustomUrl,
    serverUrl: DEFAULT_SERVER_URL,
    localUrl: DEFAULT_LOCAL_URL,
    activeUrl: activeBaseUrl,
  };
}

export function setBackendMode(mode: BackendMode) {
  currentMode = mode;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_MODE, mode);
    } catch {
      // Ignore
    }
  }
  currentConnectionInfo.mode = mode;
}

export function setCustomBackendUrl(url: string) {
  const clean = (url || "").trim().replace(/\/+$/, "");
  currentCustomUrl = clean;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_CUSTOM_URL, clean);
    } catch {
      // Ignore
    }
  }
  currentConnectionInfo.customUrl = clean;
}

export function getActiveBaseUrl(): string {
  if (currentMode === "local") {
    return DEFAULT_LOCAL_URL;
  }
  if (currentMode === "server") {
    return DEFAULT_SERVER_URL;
  }
  if (currentMode === "custom") {
    return currentCustomUrl || DEFAULT_LOCAL_URL;
  }
  return activeBaseUrl;
}

export class AnalyzeError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AnalyzeError";
  }
}

export async function testEndpoint(
  url: string,
  timeoutMs = 5000,
): Promise<BackendPingResult> {
  const cleanUrl = url.trim().replace(/\/+$/, "");
  const targetType = classifyTargetType(cleanUrl);
  const startTime = performance.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`${cleanUrl}/health`, {
      method: "GET",
      mode: "cors",
      headers: { "Bypass-Tunnel-Reminder": "true" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);

    if (resp.ok) {
      const body = await resp.json().catch(() => null);
      if (body && (body.status === "ok" || body.status === "healthy")) {
        return {
          ok: true,
          url: cleanUrl,
          targetType,
          latencyMs,
          version: body.version || "0.1.0",
          demoMode: !!body.demo_mode,
        };
      }
    }
    return {
      ok: false,
      url: cleanUrl,
      targetType,
      latencyMs,
      error: `HTTP ${resp.status} ${resp.statusText}`,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const latencyMs = Math.round(performance.now() - startTime);
    const errorMsg =
      err.name === "AbortError"
        ? `Timeout after ${timeoutMs}ms`
        : err?.message || "Connection refused";
    return {
      ok: false,
      url: cleanUrl,
      targetType,
      latencyMs,
      error: errorMsg,
    };
  }
}

export async function pingBackend(): Promise<BackendConnectionInfo> {
  currentMode = getStoredMode();
  currentCustomUrl = getStoredCustomUrl();

  const urlsToTest: { url: string; modeTarget: BackendTargetType }[] = [];

  if (currentMode === "local") {
    urlsToTest.push({ url: DEFAULT_LOCAL_URL, modeTarget: "local" });
  } else if (currentMode === "server") {
    urlsToTest.push({ url: DEFAULT_SERVER_URL, modeTarget: "server" });
  } else if (currentMode === "custom") {
    urlsToTest.push({
      url: currentCustomUrl || DEFAULT_LOCAL_URL,
      modeTarget: "custom",
    });
  } else {
    // Auto Mode: test local first (faster/dev default), then server fallback
    urlsToTest.push({ url: DEFAULT_LOCAL_URL, modeTarget: "local" });
    urlsToTest.push({ url: DEFAULT_SERVER_URL, modeTarget: "server" });
  }

  let successfulResult: BackendPingResult | null = null;
  let lastFailedResult: BackendPingResult | null = null;

  for (const item of urlsToTest) {
    const res = await testEndpoint(item.url, 4000);
    if (res.ok) {
      successfulResult = res;
      break;
    } else {
      lastFailedResult = res;
    }
  }

  if (successfulResult) {
    activeBaseUrl = successfulResult.url;
    currentConnectionInfo = {
      mode: currentMode,
      targetType: successfulResult.targetType,
      activeUrl: successfulResult.url,
      configuredServerUrl: DEFAULT_SERVER_URL,
      configuredLocalUrl: DEFAULT_LOCAL_URL,
      customUrl: currentCustomUrl,
      status: "online",
      latencyMs: successfulResult.latencyMs,
      version: successfulResult.version || null,
      demoMode: !!successfulResult.demoMode,
      lastChecked: Date.now(),
      errorMessage: null,
    };
  } else {
    const failedUrl = urlsToTest[0]?.url || activeBaseUrl;
    currentConnectionInfo = {
      mode: currentMode,
      targetType: classifyTargetType(failedUrl),
      activeUrl: failedUrl,
      configuredServerUrl: DEFAULT_SERVER_URL,
      configuredLocalUrl: DEFAULT_LOCAL_URL,
      customUrl: currentCustomUrl,
      status: "offline",
      latencyMs: lastFailedResult?.latencyMs ?? null,
      version: null,
      demoMode: false,
      lastChecked: Date.now(),
      errorMessage: lastFailedResult?.error || "Host unreachable",
    };
  }

  return { ...currentConnectionInfo };
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

  // Resolve target URLs based on mode
  const resolvedTarget = getActiveBaseUrl();
  const urlsToTry: string[] = [resolvedTarget];

  if (currentMode === "auto") {
    if (!urlsToTry.includes(DEFAULT_LOCAL_URL)) {
      urlsToTry.push(DEFAULT_LOCAL_URL);
    }
    if (!urlsToTry.includes(DEFAULT_SERVER_URL)) {
      urlsToTry.push(DEFAULT_SERVER_URL);
    }
  }

  let resp: Response | null = null;
  let lastErr: any = null;

  for (const baseUrl of urlsToTry) {
    try {
      resp = await fetch(`${baseUrl}/analyze`, {
        method: "POST",
        mode: "cors",
        headers: { "Bypass-Tunnel-Reminder": "true" },
        body: form,
      });
      activeBaseUrl = baseUrl;
      break;
    } catch (err: any) {
      console.warn(`analyzeAudio failed for ${baseUrl}, trying fallback...`, err);
      lastErr = err;
    }
  }

  if (!resp) {
    const targetLabel = classifyTargetType(resolvedTarget).toUpperCase();
    throw new AnalyzeError(
      `Backend unreachable on ${targetLabel} (${resolvedTarget}). Error: ${lastErr?.message || "Network request failed"}`,
      0,
    );
  }

  if (resp.status === 400) {
    const body = await resp.json().catch(() => ({}));
    throw new AnalyzeError(body.error || "Bad request", 400);
  }
  if (resp.status === 500) {
    throw new AnalyzeError(
      "Inference failed (500). If cold-starting a free-tier cloud backend, retry in 30s.",
      500,
    );
  }
  if (!resp.ok) {
    throw new AnalyzeError(`Unexpected backend response status ${resp.status}`, resp.status);
  }
  try {
    return (await resp.json()) as AnalyzeResponse;
  } catch {
    const text = await resp.text().catch(() => "(unreadable)");
    throw new AnalyzeError(
      `Backend returned invalid JSON (status ${resp.status}). Body preview: ${text.slice(0, 120)}`,
      resp.status,
    );
  }
}
