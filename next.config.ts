import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // A self-contained server for the Docker image. Only the image build sets
  // this: `next start`, used by local runs and the Playwright suite, does not
  // work with standalone output.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  reactStrictMode: true,
};

export default withNextIntl(nextConfig);
