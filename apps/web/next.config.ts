import type { NextConfig } from "next";

const config: NextConfig = {
  // Engine and data packages use Node APIs (dns, crypto, pg) and run only on the server.
  serverExternalPackages: ["@seobuilder/core", "@seobuilder/platform", "cheerio", "pg", "undici"],
  poweredByHeader: false,
};

export default config;
