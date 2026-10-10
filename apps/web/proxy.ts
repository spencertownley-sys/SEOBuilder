import { NextResponse, type NextRequest } from "next/server";

// One codebase, two sites:
//   mentionful.com            the app (default)
//   betterseobuilder.com      the advertising landing page at app/(promo)/better
// The landing service runs with SITE_MODE=landing (no database). Anything on the landing
// host other than the page and its assets redirects to the app.
const LANDING_HOSTS = new Set(["betterseobuilder.com"]);
const APP_URL = process.env.APP_URL ?? "https://mentionful.com";

function hostOf(req: NextRequest): string {
  return (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0]!.trim().split(":")[0]!.toLowerCase();
}

export function proxy(req: NextRequest) {
  const host = hostOf(req);
  const { pathname, search } = req.nextUrl;

  // www → apex on both domains.
  if (host.startsWith("www.") && (host.endsWith("mentionful.com") || host.endsWith("betterseobuilder.com"))) {
    return NextResponse.redirect(`https://${host.slice(4)}${pathname}${search}`, 308);
  }

  const landing = process.env.SITE_MODE === "landing" || LANDING_HOSTS.has(host);
  if (!landing) return NextResponse.next();

  if (pathname === "/") return NextResponse.rewrite(new URL("/better", req.url));
  if (pathname === "/better") return NextResponse.redirect(new URL("/", req.url), 308);
  if (pathname.startsWith("/better/") || pathname === "/api/health" || pathname === "/robots.txt") return NextResponse.next();
  return NextResponse.redirect(`${APP_URL}${pathname}${search}`, 308);
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"],
};
