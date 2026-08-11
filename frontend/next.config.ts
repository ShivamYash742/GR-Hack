import type { NextConfig } from "next";

const DEFAULT_BACKEND_URL = "https://gr-hack.onrender.com";

function normalizeBackendUrl(raw: string | undefined): string {
  const trimmed = (raw || DEFAULT_BACKEND_URL).trim().replace(/\/+$/, "");
  if (!trimmed || trimmed.startsWith("/")) {
    return DEFAULT_BACKEND_URL;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

const backendUrl = normalizeBackendUrl(
  process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL,
);

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
