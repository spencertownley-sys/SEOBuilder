import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

// 'unsafe-inline' stays in script-src because the App Router emits inline bootstrap scripts and
// this app has no nonce setup. The Cloudflare hosts are for the Web Analytics beacon Cloudflare
// injects on betterseobuilder.com; drop them if that is turned off. The app host posts the
// landing page's audit form to mentionful.com, hence form-action. Dev adds eval and the HMR socket.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://static.cloudflareinsights.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "media-src 'self'",
  `connect-src 'self' https://cloudflareinsights.com${dev ? " ws:" : ""}`,
  "form-action 'self' https://mentionful.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const config: NextConfig = {
  // Engine and data packages use Node APIs (dns, crypto, pg) and run only on the server.
  serverExternalPackages: ["@seobuilder/core", "@seobuilder/platform", "cheerio", "pg", "undici"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default config;
