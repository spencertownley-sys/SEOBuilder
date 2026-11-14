import { NextResponse, type NextRequest } from "next/server";

// One codebase, two sites:
//   mentionful.com            the app (default)
//   betterseobuilder.com      the advertising landing page at app/(promo)/better
// The landing service runs with SITE_MODE=landing (no database). Anything on the landing
// host other than the page and its assets redirects to the app.
const LANDING_HOSTS = new Set(["betterseobuilder.com"]);
const APP_URL = process.env.APP_URL ?? "https://mentionful.com";
const APP_HOST = new URL(APP_URL).hostname;
const LANDING_URL = "https://betterseobuilder.com/";
// Served by the landing host itself instead of redirecting to the app.
const LANDING_LOCAL_PATHS = new Set(["/api/health", "/robots.txt", "/sitemap.xml", "/.well-known/security.txt", "/cookie-banner.js", "/cookie-banner.css"]);

const WWW = new Map([
  ["www.mentionful.com", "mentionful.com"],
  ["www.betterseobuilder.com", "betterseobuilder.com"],
]);

function hostOf(req: NextRequest): string {
  return (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0]!.trim().split(":")[0]!.toLowerCase();
}

export function proxy(req: NextRequest) {
  const host = hostOf(req);
  const { pathname, search } = req.nextUrl;

  // www to apex on both domains. Exact matches only: the host header is client-controlled, so a
  // suffix check would let www.evilmentionful.com redirect to evilmentionful.com.
  const apex = WWW.get(host);
  if (apex) return NextResponse.redirect(`https://${apex}${pathname}${search}`, 308);

  const landing = process.env.SITE_MODE === "landing" || LANDING_HOSTS.has(host);
  if (!landing) {
    // The landing page lives on one host only (SB-12): duplicate copies split ranking signals.
    if (pathname === "/better" && host === APP_HOST) return NextResponse.redirect(LANDING_URL, 308);
    return NextResponse.next();
  }

  if (pathname === "/") return NextResponse.rewrite(new URL("/better", req.url));
  if (pathname === "/better") return NextResponse.redirect(new URL("/", req.url), 308);
  if (pathname.startsWith("/better/") || LANDING_LOCAL_PATHS.has(pathname)) return NextResponse.next();
  return NextResponse.redirect(`${APP_URL}${pathname}${search}`, 308);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
