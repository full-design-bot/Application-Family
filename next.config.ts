import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image Docker autonome (serveur Noesia) : .next/standalone contient tout le nécessaire.
  output: "standalone",
  // App 100 % dynamique (données privées par utilisateur) : pas de mise en cache des composants.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  images: { unoptimized: true },
};

export default nextConfig;
