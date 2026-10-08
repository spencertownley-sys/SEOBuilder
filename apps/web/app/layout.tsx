import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rankwell — be found by people and by AI",
  description: "A free SEO + AI visibility audit with a ranked, plain-English fix list.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
            <a href="/" className="text-lg font-semibold tracking-tight">
              Rankwell<span className="text-accent">.</span>
            </a>
            <span className="text-sm text-slate-500">SEO + GEO, one action plan</span>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-10">{children}</main>
      </body>
    </html>
  );
}
