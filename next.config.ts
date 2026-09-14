import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // dev: proxy to local uvicorn; prod: Vercel routes /api/* to the Python function at api/index.py
  rewrites: async () => [
    { source: "/api/:path*", destination: process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000/api/:path*" : "/api/" },
  ],
};

export default nextConfig;
