import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { dev }) => {
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
