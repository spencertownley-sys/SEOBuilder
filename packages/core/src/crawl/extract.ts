import * as cheerio from "cheerio";
import type { LinkRef, PageData } from "../types.js";

const DATE_RE =
  /\b(updated|published|last (?:reviewed|modified))\b|\b(19|20)\d{2}-\d{2}-\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2},? (19|20)\d{2}\b/i;

function collectSchemaTypes(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) {
    for (const n of node) collectSchemaTypes(n, out);
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (typeof t === "string") out.add(t);
    else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && out.add(x));
    for (const v of Object.values(obj)) if (v && typeof v === "object") collectSchemaTypes(v, out);
  }
}

export function extractPage(
  html: string,
  base: { url: string; finalUrl: string; statusCode: number; redirectChain: string[]; contentType: string; depth: number },
): PageData {
  const $ = cheerio.load(html);
  const pageUrl = new URL(base.finalUrl);

  const schemaTypes = new Set<string>();
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      collectSchemaTypes(JSON.parse($(el).text()), schemaTypes);
    } catch {
      schemaTypes.add("(invalid JSON-LD)");
    }
  });
  $("[itemtype]").each((_, el) => {
    const t = $(el).attr("itemtype")?.split("/").pop();
    if (t) schemaTypes.add(t);
  });

  const scriptCount = $("script").length;
  const hasAuthorSignal =
    $('meta[name="author"], [rel="author"], [itemprop="author"], .author, .byline').length > 0 ||
    schemaTypes.has("Person");

  const links: LinkRef[] = [];
  $("a[href]").each((_, el) => {
    const raw = $(el).attr("href")!.trim();
    if (!raw || raw.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(raw)) return;
    try {
      const abs = new URL(raw, pageUrl);
      abs.hash = "";
      if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
      links.push({ href: abs.toString(), text: $(el).text().trim().slice(0, 120), internal: abs.host === pageUrl.host });
    } catch {
      /* malformed href: ignore */
    }
  });

  const imagesMissingAlt: string[] = [];
  const imgs = $("img");
  imgs.each((_, el) => {
    const alt = $(el).attr("alt");
    if (alt === undefined) imagesMissingAlt.push($(el).attr("src") ?? "(inline)");
  });

  const canonicalHref = $('link[rel="canonical"]').attr("href");
  let canonical: string | undefined;
  if (canonicalHref) {
    try {
      canonical = new URL(canonicalHref, pageUrl).toString();
    } catch {
      canonical = canonicalHref;
    }
  }

  // Visible text: drop non-content elements before measuring.
  const body = $("body").clone();
  body.find("script, style, noscript, template, svg, nav, header, footer").remove();
  const text = body.text().replace(/\s+/g, " ").trim();
  const mainText = ($("main").text() || $("article").text() || text).replace(/\s+/g, " ").trim();

  return {
    ...base,
    title: $("head > title").first().text().trim() || undefined,
    metaDescription: $('meta[name="description"]').attr("content")?.trim() || undefined,
    metaRobots: $('meta[name="robots"]').attr("content")?.toLowerCase() || undefined,
    canonical,
    lang: $("html").attr("lang") || undefined,
    h1: $("h1").map((_, el) => $(el).text().trim()).get(),
    h2: $("h2").map((_, el) => $(el).text().trim()).get(),
    wordCount: text ? text.split(" ").length : 0,
    leadText: mainText.slice(0, 600),
    scriptCount,
    imagesMissingAlt,
    imageCount: imgs.length,
    links,
    schemaTypes: [...schemaTypes],
    hasDateSignal: DATE_RE.test(text) || $("time[datetime]").length > 0 || $('meta[property="article:modified_time"]').length > 0,
    hasAuthorSignal,
    hasFaqMarkup: schemaTypes.has("FAQPage") || $("details summary").length >= 2,
  };
}

export function extractSitemapUrls(xml: string): { urls: string[]; childSitemaps: string[] } {
  const $ = cheerio.load(xml, { xml: true });
  return {
    urls: $("urlset > url > loc").map((_, el) => $(el).text().trim()).get(),
    childSitemaps: $("sitemapindex > sitemap > loc").map((_, el) => $(el).text().trim()).get(),
  };
}
