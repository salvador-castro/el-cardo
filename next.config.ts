import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App interna: todas las páginas dependen de la sesión, así que no usamos Cache Components.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      // Fotos y documentos (los límites reales los pone cada bucket de Storage).
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
