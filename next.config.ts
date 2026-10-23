import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Majoo exports are uploaded through a server action; a month of sales is well over the 1 MB default.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
