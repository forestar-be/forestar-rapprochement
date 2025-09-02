import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Commenté l'export statique car nous avons des pages dynamiques avec données en base
  // output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
