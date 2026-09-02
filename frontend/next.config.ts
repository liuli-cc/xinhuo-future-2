import type { NextConfig } from "next";

// The web UI is statically exported. Authenticated data operations are sent
// to FastAPI through NEXT_PUBLIC_API_BASE; browser code never connects to
// MySQL directly.
const nextConfig: NextConfig = {
  output: "export",
  poweredByHeader: false,
  images: { unoptimized: true },
};

export default nextConfig;
