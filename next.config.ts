import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Same job as the Vite proxy: /api goes to the Express server (only used if you switch back to it).
  async rewrites() {
    return [{ source: "/api/:path*", destination: "http://localhost:4000/api/:path*" }];
  },
};

export default nextConfig;
