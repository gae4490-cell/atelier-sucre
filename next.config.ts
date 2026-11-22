import type { NextConfig } from "next";

const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Test sur téléphone via le réseau local : autoriser l'IP de l'ordinateur en mode dev
  // (ex. ALLOWED_DEV_ORIGINS=192.168.1.42).
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  images: {
    // Les images sont servies directement par Supabase Storage (balises <img>),
    // on garde ce réglage pour une éventuelle migration vers next/image.
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost }] : [],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // L'espace pâtissier ne doit jamais être intégré dans une iframe.
        source: "/espace/:path*",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
    ];
  },
};

export default nextConfig;
