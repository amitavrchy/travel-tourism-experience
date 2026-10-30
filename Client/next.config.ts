import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  images: { qualities: [75, 90] },
  turbopack: {
    root: path.resolve(process.cwd(), ".."),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
