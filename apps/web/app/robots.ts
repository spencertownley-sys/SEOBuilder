import type { MetadataRoute } from "next";
import { APP_ORIGIN, isLandingRequest, LANDING_ORIGIN } from "@/lib/host";

// One file, two hosts. Everything public is crawlable, AI crawlers included (the product is
// about being found by them); private and state-changing paths are not.
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (await isLandingRequest()) {
    return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }], sitemap: `${LANDING_ORIGIN}/sitemap.xml` };
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/api/", "/report/", "/audit"] }],
    sitemap: `${APP_ORIGIN}/sitemap.xml`,
  };
}
