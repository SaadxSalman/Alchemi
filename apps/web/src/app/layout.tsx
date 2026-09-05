import type { Metadata } from "next";
import Script from "next/script";
import { Providers } from "@/providers";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alchemi — Autonomous Chemistry Lab",
  description:
    "AI agents that autonomously design novel molecules, predict synthesis pathways and simulate chemical feasibility.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen">
        {/* RDKit MinimalLib (WASM) — local in-browser 2D structure rendering */}
        <Script src="https://unpkg.com/@rdkit/rdkit/dist/RDKit_minimal.js" strategy="lazyOnload" />
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
