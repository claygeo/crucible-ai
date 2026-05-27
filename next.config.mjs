import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: __dirname,
  // typedRoutes disabled while we stub out internal routes during build.
  // Will re-enable in week-2 once leaderboard / agents / markets pages exist.
  // Eivra runs entirely on Netlify with Next runtime; no static export.
  // OpenGraph image route + dynamic dashboards need server runtime.
};

export default nextConfig;
