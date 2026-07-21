import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // `lib/` now lives outside this app dir (moved to REACTOR_js-sdk/lib, shared with
  // the coordinator). Allow webpack to transpile source imported from outside the
  // Next.js root — the `@/lib/*` tsconfig path resolves to ../../lib.
  experimental: { externalDir: true },
  webpack: (config, { dev }) => {
    // Because lib/ is outside the app root, its bare imports (clsx, react,
    // tailwind-merge, …) would resolve from lib's own location, which has no
    // node_modules. Prepend THIS app's node_modules so those resolve regardless
    // of where the importing source file physically lives.
    config.resolve = config.resolve || {};
    config.resolve.modules = [
      path.resolve(process.cwd(), "node_modules"),
      "node_modules",
      ...(config.resolve.modules || []),
    ];
    if (dev) {
      // Phantom Fast Refresh rebuild loops on Windows: an AV real-time scan / Search
      // indexer / OneDrive / the coordinator writing logs + frame taps in the tree can
      // touch files the watcher reads as "changed", triggering endless rebuilds that
      // remount the app and drop the Reactor video session (ready -> disconnected).
      // Narrow the watcher to real source (lib/ app/ components/) by ignoring everything
      // that legitimately churns. require.context on lib/lingbot-cases is unaffected.
      config.watchOptions = {
        ...config.watchOptions,
        aggregateTimeout: 300,
        ignored: [
          "**/node_modules/**",
          "**/.next/**",
          "**/.git/**",
          "**/.venv/**",
          "**/coordinator/**",
          "**/local_server/**",
          "**/outputs/**",
          "**/*.log",
          "**/frame*.png",
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
