import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle.
  output: "standalone",
  // Migrations are read from disk at startup.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
  images: {
    remotePatterns: [new URL("https://assets.axfood.se/**"), new URL("https://handlaprivatkund.ica.se/images-v3/**")],
  },
};

export default nextConfig;
