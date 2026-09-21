import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Marquise · Mon espace d’études",
  description:
    "Un peu chaque jour, à ton rythme. Ton compagnon d’études privé.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", apple: "/icon-192.png" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr-CA">
      <body>{children}</body>
    </html>
  );
}
