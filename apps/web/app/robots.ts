import type { MetadataRoute } from "next";

// Same rules for both hosts: everything public is crawlable, AI crawlers included.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/api/", "/report/"] }],
  };
}
