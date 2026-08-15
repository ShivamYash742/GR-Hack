"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_LOCAL_URL,
  DEFAULT_SERVER_URL,
  getConnectionConfig,
  setBackendMode,
  setCustomBackendUrl,
  testEndpoint,
} from "@/lib/api";
import type {
  BackendConnectionInfo,
  BackendMode,
  BackendPingResult,
} from "@/types/analysis";

interface BackendModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionInfo: BackendConnectionInfo;
  onRefresh: () => Promise<BackendConnectionInfo>;
}

export default function BackendModal({
  isOpen,
  onClose,
  connectionInfo,
  onRefresh,
}: BackendModalProps) {
  const [selectedMode, setSelectedMode] = useState<BackendMode>(connectionInfo.mode);
  const [customInput, setCustomInput] = useState<string>(connectionInfo.customUrl || "");
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<BackendPingResult | null>(null);
  const [localPing, setLocalPing] = useState<BackendPingResult | null>(null);
  const [serverPing, setServerPing] = useState<BackendPingResult | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = getConnectionConfig();
      setSelectedMode(config.mode);
      setCustomInput(config.customUrl);
      setTestResult(null);

      // Probe both local and server in background for quick comparison
      testEndpoint(DEFAULT_LOCAL_URL, 3000).then(setLocalPing);
      testEndpoint(DEFAULT_SERVER_URL, 4000).then(setServerPing);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleTest(url: string) {
    if (!url) return;
    setTestingEndpoint(url);
    setTestResult(null);
    try {
      const res = await testEndpoint(url, 5000);
      setTestResult(res);
    } finally {
      setTestingEndpoint(null);
    }
  }

  async function handleApply() {
    setIsApplying(true);
    try {
      setBackendMode(selectedMode);
      if (selectedMode === "custom") {
        setCustomBackendUrl(customInput);
      }
      await onRefresh();
      onClose();
    } finally {
      setIsApplying(false);
    }
  }

  const activeTargetType = connectionInfo.targetType;
  const isOnline = connectionInfo.status === "online";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
      <div
        className="w-full max-w-2xl bg-[var(--panel)] border border-[var(--border)] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="backend-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] bg-[var(--base)]">
          <div className="flex items-center gap-3">
            <div className="w-[3px] h-5 bg-[var(--sector-purple)]" />
            <div>
              <h2
                id="backend-modal-title"
                className="text-sm font-black uppercase tracking-[0.16em] font-[family-name:var(--font-mono)] text-[var(--body)]"
              >
                Telemetry Link Controller
              </h2>
              <p className="text-[10px] text-[var(--muted)] font-[family-name:var(--font-mono)] uppercase tracking-[0.08em]">
                Switch Backend Target · Local vs Cloud Server Pipeline
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-xs font-mono text-[var(--muted)] hover:text-[var(--body)] px-2 py-1 border border-transparent hover:border-[var(--border)] transition-colors cursor-pointer"
          >
            ESC ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex flex-col gap-5">
          {/* Active Live Link Status Overview */}
          <div className="border border-[var(--border)] p-3.5 bg-[var(--base)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-[var(--muted)] uppercase tracking-wider">Active Telemetry Link</span>
              <div className="flex items-center gap-2">
                <span
                  className={
                    isOnline
                      ? "chip chip--green text-[10px]"
                      : connectionInfo.status === "checking"
                      ? "chip chip--yellow text-[10px]"
                      : "chip chip--red text-[10px]"
                  }
                >
                  {connectionInfo.status}
                </span>
                {connectionInfo.latencyMs !== null && (
                  <span className="chip chip--purple text-[10px] tabnum">
                    {connectionInfo.latencyMs}ms
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-[var(--border-dim)] text-[11px] font-mono">
              <div>
                <span className="text-[var(--muted)] text-[10px] block uppercase">Target Type</span>
                <span className="font-bold text-[var(--body)] uppercase">
                  {activeTargetType === "local"
                    ? "🟢 Local Machine"
                    : activeTargetType === "server"
                    ? "🌐 Cloud Server"
                    : activeTargetType === "custom"
                    ? "🛠️ Custom Endpoint"
                    : "Unknown"}
                </span>
              </div>
              <div className="sm:col-span-2 truncate">
                <span className="text-[var(--muted)] text-[10px] block uppercase">Connected Endpoint</span>
                <span className="text-[var(--sector-yellow)] tabnum truncate block" title={connectionInfo.activeUrl}>
                  {connectionInfo.activeUrl}
                </span>
              </div>
            </div>

            {connectionInfo.version && (
              <div className="text-[10px] font-mono text-[var(--muted)] flex items-center justify-between pt-1">
                <span>FastAPI Engine: v{connectionInfo.version} · Whisper + wav2vec2</span>
                {connectionInfo.demoMode && (
                  <span className="text-[var(--sector-yellow)]">DEMO_MODE ACTIVE</span>
                )}
              </div>
            )}
          </div>

          {/* Target Selection Modes */}
          <div className="flex flex-col gap-2.5">
            <label className="section-label">Select Backend Target</label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Local Backend */}
              <button
                type="button"
                onClick={() => setSelectedMode("local")}
                className={[
                  "p-3 text-left border flex flex-col gap-1.5 transition-all cursor-pointer",
                  selectedMode === "local"
                    ? "border-[var(--sector-green)] bg-[rgba(0,210,104,0.06)]"
                    : "border-[var(--border)] hover:border-[var(--muted)] bg-[var(--panel)]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[var(--body)] flex items-center gap-1.5">
                    <span
                      className={`inline-block w-2 h-2 ${
                        localPing?.ok ? "bg-[var(--sector-green)]" : "bg-[var(--dim)]"
                      }`}
                    />
                    LOCAL BACKEND
                  </span>
                  {localPing && (
                    <span
                      className={`text-[10px] font-mono tabnum ${
                        localPing.ok ? "text-[var(--sector-green)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {localPing.ok ? `${localPing.latencyMs}ms` : "unreachable"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--muted)] font-mono truncate">
                  {DEFAULT_LOCAL_URL}
                </p>
                <p className="text-[10px] text-[var(--muted)] leading-tight">
                  Direct local FastAPI instance on this machine. Ultra low latency.
                </p>
              </button>

              {/* Option 2: Cloud Server */}
              <button
                type="button"
                onClick={() => setSelectedMode("server")}
                className={[
                  "p-3 text-left border flex flex-col gap-1.5 transition-all cursor-pointer",
                  selectedMode === "server"
                    ? "border-[var(--sector-purple)] bg-[rgba(157,78,221,0.08)]"
                    : "border-[var(--border)] hover:border-[var(--muted)] bg-[var(--panel)]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[var(--body)] flex items-center gap-1.5">
                    <span
                      className={`inline-block w-2 h-2 ${
                        serverPing?.ok ? "bg-[var(--sector-green)]" : "bg-[var(--dim)]"
                      }`}
                    />
                    CLOUD SERVER
                  </span>
                  {serverPing && (
                    <span
                      className={`text-[10px] font-mono tabnum ${
                        serverPing.ok ? "text-[var(--sector-green)]" : "text-[var(--muted)]"
                      }`}
                    >
                      {serverPing.ok ? `${serverPing.latencyMs}ms` : "idle/spinup"}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--muted)] font-mono truncate" title={DEFAULT_SERVER_URL}>
                  {DEFAULT_SERVER_URL}
                </p>
                <p className="text-[10px] text-[var(--muted)] leading-tight">
                  Hosted Render/Cloud backend. Free tier may spin down when idle.
                </p>
              </button>

              {/* Option 3: Auto Mode */}
              <button
                type="button"
                onClick={() => setSelectedMode("auto")}
                className={[
                  "p-3 text-left border flex flex-col gap-1.5 transition-all cursor-pointer sm:col-span-2",
                  selectedMode === "auto"
                    ? "border-[var(--sector-yellow)] bg-[rgba(255,217,61,0.06)]"
                    : "border-[var(--border)] hover:border-[var(--muted)] bg-[var(--panel)]",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[var(--body)] flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 bg-[var(--sector-yellow)]" />
                    AUTO-DETECT (SMART FALLBACK)
                  </span>
                  <span className="chip chip--yellow text-[9px]">RECOMMENDED</span>
                </div>
                <p className="text-[10px] text-[var(--muted)] leading-tight">
                  Automatically prioritizes low-latency Local FastAPI ({DEFAULT_LOCAL_URL}) when running locally, and seamlessly falls back to Cloud Server ({DEFAULT_SERVER_URL}) if local is offline.
                </p>
              </button>

              {/* Option 4: Custom URL */}
              <div
                className={[
                  "p-3 border flex flex-col gap-2 transition-all sm:col-span-2",
                  selectedMode === "custom"
                    ? "border-[var(--sector-yellow)] bg-[rgba(255,217,61,0.04)]"
                    : "border-[var(--border)] bg-[var(--panel)]",
                ].join(" ")}
              >
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setSelectedMode("custom")}
                >
                  <span className="font-mono text-xs font-bold text-[var(--body)] flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="backendMode"
                      checked={selectedMode === "custom"}
                      onChange={() => setSelectedMode("custom")}
                      className="accent-[var(--sector-yellow)]"
                    />
                    CUSTOM ENDPOINT
                  </span>
                  <span className="text-[10px] text-[var(--muted)] font-mono">
                    Tunnels / LAN / Alternate Ports
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="url"
                    value={customInput}
                    onChange={(e) => {
                      setCustomInput(e.target.value);
                      setSelectedMode("custom");
                    }}
                    placeholder="e.g. http://localhost:8000 or https://your-tunnel.loca.lt"
                    className="flex-1 px-3 py-1.5 text-xs font-mono bg-[var(--base)] border border-[var(--border)] text-[var(--body)] placeholder:text-[var(--dim)] focus:border-[var(--sector-yellow)] outline-none"
                  />
                  <button
                    type="button"
                    disabled={!customInput || testingEndpoint === customInput}
                    onClick={() => handleTest(customInput)}
                    className="px-3 py-1.5 text-xs font-mono border border-[var(--border)] hover:border-[var(--sector-yellow)] text-[var(--body)] hover:text-[var(--sector-yellow)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {testingEndpoint === customInput ? "Pinging…" : "Test Link"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Ping Testing & Diagnostics */}
          <div className="border-t border-[var(--border)] pt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="section-label">Live Diagnostics & Ping Tester</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTest(DEFAULT_LOCAL_URL)}
                  disabled={!!testingEndpoint}
                  className="text-[10px] font-mono px-2 py-1 border border-[var(--border)] hover:border-[var(--sector-green)] text-[var(--body)] transition-colors cursor-pointer"
                >
                  Ping Local
                </button>
                <button
                  type="button"
                  onClick={() => handleTest(DEFAULT_SERVER_URL)}
                  disabled={!!testingEndpoint}
                  className="text-[10px] font-mono px-2 py-1 border border-[var(--border)] hover:border-[var(--sector-purple)] text-[var(--body)] transition-colors cursor-pointer"
                >
                  Ping Server
                </button>
              </div>
            </div>

            {testResult && (
              <div
                className={`p-3 text-xs font-mono border flex flex-col gap-1 ${
                  testResult.ok
                    ? "border-[var(--sector-green)] bg-[rgba(0,210,104,0.05)] text-[var(--sector-green)]"
                    : "border-[var(--alert-red)] bg-[rgba(225,6,0,0.05)] text-[var(--alert-red)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {testResult.ok ? "✓ HEALTH CHECK PASSED" : "✗ CONNECTION FAILED"}
                  </span>
                  <span className="tabnum">{testResult.latencyMs}ms</span>
                </div>
                <div className="text-[11px] text-[var(--body)] opacity-90 truncate">
                  Target: {testResult.url} ({testResult.targetType.toUpperCase()})
                </div>
                {testResult.ok && testResult.version && (
                  <div className="text-[10px] text-[var(--muted)]">
                    Engine Version: {testResult.version} {testResult.demoMode ? "· Demo Mode" : ""}
                  </div>
                )}
                {!testResult.ok && testResult.error && (
                  <div className="text-[10px] text-[var(--alert-red)]">{testResult.error}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--border)] bg-[var(--base)]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono border border-[var(--border)] hover:border-[var(--muted)] text-[var(--muted)] hover:text-[var(--body)] transition-colors cursor-pointer uppercase tracking-wider"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isApplying}
            onClick={handleApply}
            className="px-5 py-2 text-xs font-mono font-bold uppercase tracking-wider border border-[var(--sector-green)] text-[var(--sector-green)] hover:bg-[rgba(0,210,104,0.1)] transition-colors cursor-pointer"
          >
            {isApplying ? "Connecting…" : "Apply Link Config"}
          </button>
        </div>
      </div>
    </div>
  );
}
