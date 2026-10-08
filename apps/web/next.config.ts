import type { NextConfig } from "next";

const config: NextConfig = {
  // The core package uses Node APIs (dns, crypto) and runs only on the server.
  serverExternalPackages: ["@seobuilder/core", "cheerio"],
};

export default config;
