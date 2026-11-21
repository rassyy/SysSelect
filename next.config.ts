import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // puppeteer-core dipakai server hanya untuk export PDF (T16).
  serverExternalPackages: ["puppeteer-core"],
};

export default nextConfig;
