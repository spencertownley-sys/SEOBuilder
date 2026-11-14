import type { Metadata } from "next";
import Script from "next/script";
import { APP_ORIGIN } from "@/lib/host";
import "./globals.css";

// Shared shell only. The Mentionful app chrome lives in app/(main)/layout.tsx and the
// betterseobuilder.com landing page brings its own in app/(promo).
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://mentionful.com"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Cookie notice (public/cookie-banner.*): served from this site, no third party. Notice mode,
            because only strictly necessary cookies and storage are used. The policy URL is absolute
            because the landing host redirects other paths to the app. */}
        <link rel="stylesheet" href="/cookie-banner.css" />
      </head>
      <body className="min-h-screen">
        {children}
        <Script src="/cookie-banner.js" strategy="afterInteractive" data-cookie-banner data-mode="notice" data-policy-url={`${APP_ORIGIN}/cookies`} />
      </body>
    </html>
  );
}
