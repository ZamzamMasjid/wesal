import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image (deployment).
  output: "standalone",
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
