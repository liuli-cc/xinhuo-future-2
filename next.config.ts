import type { NextConfig } from "next";

// The web UI is static. Authenticated data operations are performed by the
// CloudBase HTTP function, so this bundle needs no Node server or PostgreSQL
// runtime after deployment.
const nextConfig: NextConfig = {
  output: "export",
  poweredByHeader: false,
  images: { unoptimized: true },
};

export default nextConfig;
