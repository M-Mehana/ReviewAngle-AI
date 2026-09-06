import type { NextConfig } from "next";
if (
  process.env.LOCAL_STAGING_MODE === "true" &&
  process.env.NODE_ENV === "production"
) {
  throw new Error(
    "Local staging cannot run in production. Set LOCAL_STAGING_MODE=false.",
  );
}
const config: NextConfig = {
  // Turbopack persists environment values in its disk cache. Keep secrets
  // exclusively in the ignored env file and process memory.
  experimental: {
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
  output: "standalone",
  outputFileTracingExcludes: { "/*": ["./.env*", "./.local/**/*"] },
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};
export default config;
