import type { NextConfig } from "next";

// API_BASE_URL is the gateway, e.g. http://localhost:8080.
// Unset, the app runs on the mock layer in lib/api/mock.
const gateway = process.env.API_BASE_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  env: {
    // Lets browser code know which adapter to use without exposing the URL.
    NEXT_PUBLIC_API_MODE: gateway ? "gateway" : "mock",
  },
  async rewrites() {
    // The browser only ever calls same-origin /api/*, so there is no CORS and
    // the session cookie travels by itself. Route handlers under app/api are
    // checked first, so the sign-in handler can still set the cookie.
    return gateway
      ? [{ source: "/api/:path*", destination: `${gateway}/:path*` }]
      : [];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
