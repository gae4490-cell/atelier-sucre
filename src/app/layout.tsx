import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import "./globals.css";

const fonts = {
  "--font-serif": "Georgia, serif",
  "--font-sans": "Arial, sans-serif",
} as CSSProperties;

export const metadata: Metadata = {
  title: { default: "Atelier Sucré", template: "%s · Atelier Sucré" },
  description:
    "Les demandes de gâteaux sur mesure de vos clients, directement depuis votre bio Instagram.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
  ),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbf5ef",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" style={fonts}>
      <body>{children}</body>
    </html>
  );
}