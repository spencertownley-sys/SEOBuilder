import type { MetadataRoute } from "next";
import { APP_ORIGIN, isLandingRequest, LANDING_ORIGIN } from "@/lib/host";

// Only canonical, public pages that return 200 on this host. Never /app, /report or /audit.
const APP_PATHS = ["/", "/signup", "/login", "/privacy", "/terms", "/cookies", "/bot"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (await isLandingRequest()) return [{ url: `${LANDING_ORIGIN}/`, changeFrequency: "monthly", priority: 1 }];
  return APP_PATHS.map((p) => ({ url: `${APP_ORIGIN}${p}`, changeFrequency: p === "/" ? "weekly" : "monthly", priority: p === "/" ? 1 : 0.5 }));
}
