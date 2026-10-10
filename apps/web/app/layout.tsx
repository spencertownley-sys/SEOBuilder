import type { Metadata } from "next";
import "./globals.css";

// Shared shell only. The Mentionful app chrome lives in app/(main)/layout.tsx and the
// betterseobuilder.com landing page brings its own in app/(promo).
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://mentionful.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
