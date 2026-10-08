// Audit rules. Each rule turns crawl data into zero or one Issue; the Action Plan engine
// (plan.ts) turns Issues into prioritized Tasks. Impact/effort/confidence values are
// starting estimates (PRD: "impact estimates labelled as estimates") to be tuned against
// before/after data from real customers.

import { AI_ANSWER_BOTS } from "../crawl/robots.js";
import type { Issue, PageData, SiteData } from "../types.js";

type Rule = (site: SiteData, html: PageData[]) => Issue | null;

const MAX_URLS = 25;

function pagesWhere(pages: PageData[], pred: (p: PageData) => boolean): string[] {
  return pages.filter(pred).map((p) => p.finalUrl);
}

function issue(base: Omit<Issue, "urls"> & { urls?: string[] }): Issue {
  return { ...base, urls: (base.urls ?? []).slice(0, MAX_URLS) };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function hostName(site: SiteData): string {
  return new URL(site.origin).hostname.replace(/^www\./, "");
}

// ---------- site-level: technical ----------

const httpsRule: Rule = (site) =>
  site.https
    ? null
    : issue({
        type: "no-https",
        module: "both",
        severity: "critical",
        title: "Serve the site over HTTPS",
        why: "Browsers flag HTTP sites as not secure, Google uses HTTPS as a ranking signal, and AI engines prefer secure sources.",
        steps: ["Turn on HTTPS at your host or CDN (most offer free certificates).", "Redirect every http:// URL to its https:// version with a 301."],
        impact: 4,
        effort: 2,
        confidence: 0.9,
      });

const robotsMissing: Rule = (site) =>
  site.robots.found
    ? null
    : issue({
        type: "robots-missing",
        module: "both",
        severity: "notice",
        title: "Add a robots.txt file",
        why: "Without robots.txt, crawlers fall back to defaults and you can't point them to your sitemap.",
        steps: ["Create /robots.txt at the site root.", "Allow normal crawling and add a Sitemap: line."],
        impact: 2,
        effort: 1,
        confidence: 0.8,
        draftFix: `User-agent: *\nAllow: /\n\nSitemap: ${site.origin}/sitemap.xml\n`,
      });

const robotsBlocksAll: Rule = (site) =>
  site.robots.blocksEverything
    ? issue({
        type: "robots-blocks-all",
        module: "both",
        severity: "critical",
        title: "robots.txt blocks all crawlers from the whole site",
        why: "A `Disallow: /` for every user agent keeps you out of search results and AI answers entirely.",
        steps: ["Open robots.txt and remove `Disallow: /` under `User-agent: *` unless the site is meant to be private."],
        impact: 5,
        effort: 1,
        confidence: 0.95,
        urls: [site.robots.url],
      })
    : null;

const sitemapMissing: Rule = (site) =>
  site.sitemapFound
    ? null
    : issue({
        type: "sitemap-missing",
        module: "seo",
        severity: "warning",
        title: "Publish an XML sitemap",
        why: "A sitemap tells search engines which pages exist and when they changed, so new pages get found faster.",
        steps: ["Generate /sitemap.xml listing every public page (most CMSs have a setting or plugin).", "Reference it in robots.txt and submit it in Google Search Console and Bing Webmaster Tools."],
        impact: 3,
        effort: 1,
        confidence: 0.8,
      });

// ---------- site-level: GEO ----------

const aiBotsBlocked: Rule = (site) => {
  const blocked = Object.entries(site.robots.aiBots).filter(([, b]) => b).map(([bot]) => bot);
  if (!blocked.length || site.robots.blocksEverything) return null;
  const answerBots = blocked.filter((b) => AI_ANSWER_BOTS.includes(b));
  return issue({
    type: "ai-bots-blocked",
    module: "geo",
    severity: answerBots.length ? "critical" : "warning",
    title: `robots.txt blocks ${plural(blocked.length, "AI crawler")}: ${blocked.join(", ")}`,
    why: answerBots.length
      ? `${answerBots.join(", ")} fetch pages for live AI answers and citations; blocking them keeps you out of those answers.`
      : "These bots gather training data. Blocking them is a legitimate choice, but it can reduce how well AI models know your brand. Make sure it's intentional.",
    steps: [
      "Decide which AI crawlers you want to allow (search/answer bots are the ones that lead to citations).",
      "Remove or narrow the matching Disallow rules in robots.txt.",
      "Check your CDN or firewall (e.g. Cloudflare's AI bot blocking) isn't blocking them too.",
    ],
    impact: answerBots.length ? 5 : 2,
    effort: 1,
    confidence: answerBots.length ? 0.85 : 0.5,
    urls: [site.robots.url],
    draftFix: blocked.map((b) => `User-agent: ${b}\nAllow: /`).join("\n\n") + "\n",
  });
};

const llmsTxt: Rule = (site) =>
  site.llmsTxtFound
    ? null
    : issue({
        type: "llms-txt-missing",
        module: "geo",
        severity: "notice",
        title: "Optional: add an llms.txt summary",
        why: "llms.txt is an emerging convention that gives AI tools a plain-text map of your key pages. Its impact is unproven, so treat it as low priority.",
        steps: ["Create /llms.txt with a one-paragraph description of the business and links to your most important pages."],
        impact: 1,
        effort: 1,
        confidence: 0.3,
        draftFix: `# ${hostName(site)}\n\n> One-sentence description of what you do, for whom, and where.\n\n## Key pages\n- [Services](${site.origin}/services): what we offer and prices\n- [About](${site.origin}/about): who we are\n- [Contact](${site.origin}/contact): hours, address, phone\n`,
      });

const orgSchema: Rule = (site, pages) => {
  const all = new Set(pages.flatMap((p) => p.schemaTypes));
  const entityTypes = ["Organization", "LocalBusiness", "Corporation", "ProfessionalService", "Store", "Restaurant", "Person", "WebSite", "NewsMediaOrganization"];
  if (entityTypes.some((t) => all.has(t)) || [...all].some((t) => /Business|Service|Organization/.test(t))) return null;
  return issue({
    type: "entity-schema-missing",
    module: "both",
    severity: "warning",
    title: "Describe your business with Organization / LocalBusiness structured data",
    why: "Structured data states who you are, where you are and how to contact you in a form search engines and AI models parse reliably, which helps them describe you correctly.",
    steps: [
      "Add the JSON-LD below to your homepage <head>, filled in with your real details.",
      "Use the same name, address and phone as your Google Business Profile.",
      "Validate it with Google's Rich Results Test.",
    ],
    impact: 4,
    effort: 2,
    confidence: 0.7,
    urls: [site.startUrl],
    draftFix: JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: hostName(site),
        url: site.origin,
        description: "What you do, for whom, and where.",
        telephone: "+1-000-000-0000",
        address: { "@type": "PostalAddress", streetAddress: "", addressLocality: "", addressRegion: "", postalCode: "", addressCountry: "US" },
        sameAs: ["https://www.facebook.com/…", "https://www.instagram.com/…"],
      },
      null,
      2,
    ),
  });
};

// ---------- page-level: technical ----------

const brokenPages: Rule = (site) => {
  const bad = site.pages.filter((p) => p.statusCode >= 400 || (p.statusCode === 0 && p.fetchError));
  // External sites often answer bots with 401/403/429 (bot protection) while working fine for
  // people, so only definite failures count there.
  const crawled = new Set(site.pages.map((p) => p.url));
  const host = new URL(site.origin).host;
  const brokenLinks = Object.entries(site.checkedLinks)
    .filter(([u, s]) => !crawled.has(u) && (new URL(u).host === host ? s >= 400 : s === 404 || s === 410 || s >= 500))
    .map(([u]) => u);
  const all = [...new Set([...bad.map((p) => p.url), ...brokenLinks])];
  if (!all.length) return null;
  return issue({
    type: "broken-links",
    module: "seo",
    severity: "critical",
    title: `Fix ${plural(all.length, "broken link")}`,
    why: "Links to missing pages waste crawl budget, leak link value and frustrate visitors.",
    steps: ["Update each link to point at a working page, or remove it.", "If a page moved, add a 301 redirect from the old URL to the new one."],
    impact: 4,
    effort: 2,
    confidence: 0.9,
    urls: all,
  });
};

const redirectChains: Rule = (_s, pages) => {
  const urls = pagesWhere(pages, (p) => p.redirectChain.length > 1);
  return urls.length
    ? issue({
        type: "redirect-chains",
        module: "seo",
        severity: "warning",
        title: `Shorten ${plural(urls.length, "redirect chain")}`,
        why: "Each extra redirect hop slows the page and can stop crawlers before they reach the content.",
        steps: ["Point internal links straight at the final URL.", "Make old URLs redirect in a single 301 hop."],
        impact: 2,
        effort: 2,
        confidence: 0.8,
        urls,
      })
    : null;
};

const titleMissing: Rule = (_s, pages) => {
  const urls = pagesWhere(pages, (p) => !p.title);
  return urls.length
    ? issue({
        type: "title-missing",
        module: "both",
        severity: "critical",
        title: `Add a title tag to ${plural(urls.length, "page")}`,
        why: "The title is the headline in search results and a key signal of what a page is about.",
        steps: ["Write a unique 30–60 character title per page: main topic first, brand last."],
        impact: 4,
        effort: 1,
        confidence: 0.9,
        urls,
      })
    : null;
};

const titleLength: Rule = (_s, pages) => {
  const urls = pagesWhere(pages, (p) => !!p.title && (p.title.length < 20 || p.title.length > 65));
  return urls.length
    ? issue({
        type: "title-length",
        module: "seo",
        severity: "notice",
        title: `Rewrite ${plural(urls.length, "title")} that are too short or too long`,
        why: "Titles under ~20 characters waste the space; over ~65 get cut off in search results.",
        steps: ["Aim for 30–60 characters that say what the page offers and where."],
        impact: 2,
        effort: 1,
        confidence: 0.6,
        urls,
      })
    : null;
};

function duplicates(pages: PageData[], key: (p: PageData) => string | undefined): string[] {
  const by = new Map<string, string[]>();
  for (const p of pages) {
    const k = key(p);
    if (!k) continue;
    by.set(k, [...(by.get(k) ?? []), p.finalUrl]);
  }
  return [...by.values()].filter((v) => v.length > 1).flat();
}

const titleDuplicate: Rule = (_s, pages) => {
  const urls = duplicates(pages, (p) => p.title);
  return urls.length
    ? issue({
        type: "title-duplicate",
        module: "seo",
        severity: "warning",
        title: `Make ${plural(urls.length, "duplicate title")} unique`,
        why: "When pages share a title, search engines can't tell which one to rank and may pick the wrong one.",
        steps: ["Give every page a title that names its own specific topic."],
        impact: 3,
        effort: 2,
        confidence: 0.7,
        urls,
      })
    : null;
};

const metaMissing: Rule = (_s, pages) => {
  const urls = pagesWhere(pages, (p) => !p.metaDescription);
  return urls.length
    ? issue({
        type: "meta-description-missing",
        module: "seo",
        severity: "warning",
        title: `Write meta descriptions for ${plural(urls.length, "page")}`,
        why: "The meta description is your pitch under the title in search results; without one, Google picks a random snippet.",
        steps: ["Write 120–160 characters per page that answer 'why click this?'."],
        impact: 2,
        effort: 1,
        confidence: 0.7,
        urls,
      })
    : null;
};

const metaDuplicate: Rule = (_s, pages) => {
  const urls = duplicates(pages, (p) => p.metaDescription);
  return urls.length
    ? issue({
        type: "meta-description-duplicate",
        module: "seo",
        severity: "notice",
        title: `Make ${plural(urls.length, "duplicate meta description")} unique`,
        why: "Repeated descriptions make pages look interchangeable in search results.",
        steps: ["Rewrite each description to match its own page."],
        impact: 1,
        effort: 1,
        confidence: 0.6,
        urls,
      })
    : null;
};

const h1Rule: Rule = (_s, pages) => {
  const urls = pagesWhere(pages, (p) => p.h1.length !== 1);
  return urls.length
    ? issue({
        type: "h1",
        module: "both",
        severity: "warning",
        title: `Give ${plural(urls.length, "page")} exactly one H1 heading`,
        why: "A single clear H1 tells search engines and AI models the page's main topic.",
        steps: ["Add one H1 that states the page topic; turn any extra H1s into H2s."],
        impact: 2,
        effort: 1,
        confidence: 0.6,
        urls,
      })
    : null;
};

const canonicalRule: Rule = (_s, pages) => {
  const urls = pagesWhere(pages, (p) => !p.canonical);
  return urls.length
    ? issue({
        type: "canonical-missing",
        module: "seo",
        severity: "notice",
        title: `Add canonical tags to ${plural(urls.length, "page")}`,
        why: "Canonical tags tell search engines which URL is the main version, which stops duplicates (tracking parameters, http/https) from splitting ranking signals.",
        steps: ['Add <link rel="canonical" href="…"> pointing at each page\'s preferred URL.'],
        impact: 2,
        effort: 1,
        confidence: 0.6,
        urls,
      })
    : null;
};

const noindex: Rule = (_s, pages) => {
  const urls = pagesWhere(pages, (p) => !!p.metaRobots?.includes("noindex"));
  return urls.length
    ? issue({
        type: "noindex",
        module: "both",
        severity: "warning",
        title: `Check ${plural(urls.length, "page")} marked noindex`,
        why: "noindex pages are dropped from search results and are unlikely to be cited by AI search. Make sure that's intentional.",
        steps: ["Remove the noindex robots meta tag from any page you want found."],
        impact: 3,
        effort: 1,
        confidence: 0.5,
        urls,
      })
    : null;
};

const altText: Rule = (_s, pages) => {
  const affected = pages.filter((p) => p.imagesMissingAlt.length);
  const count = affected.reduce((n, p) => n + p.imagesMissingAlt.length, 0);
  return count
    ? issue({
        type: "image-alt-missing",
        module: "seo",
        severity: "notice",
        title: `Add alt text to ${plural(count, "image")}`,
        why: "Alt text makes images accessible and helps them rank in image search.",
        steps: ["Describe what each meaningful image shows in a short phrase; use alt=\"\" for purely decorative images."],
        impact: 2,
        effort: 2,
        confidence: 0.7,
        urls: affected.map((p) => p.finalUrl),
      })
    : null;
};

const thinContent: Rule = (_s, pages) => {
  const urls = pagesWhere(pages, (p) => p.statusCode === 200 && p.wordCount > 0 && p.wordCount < 200);
  return urls.length
    ? issue({
        type: "thin-content",
        module: "both",
        severity: "notice",
        title: `Expand ${plural(urls.length, "thin page")} (under 200 words)`,
        why: "Pages with little text give search engines and AI models little to understand, rank or quote.",
        steps: ["Add the specifics a customer would ask about: what, who it's for, price range, process, location, FAQs."],
        impact: 3,
        effort: 3,
        confidence: 0.5,
        urls,
      })
    : null;
};

const orphanish: Rule = (_s, pages) => {
  const inbound = new Map<string, number>();
  for (const p of pages) for (const l of p.links) if (l.internal) inbound.set(l.href, (inbound.get(l.href) ?? 0) + 1);
  const urls = pagesWhere(pages, (p) => p.depth > 0 && !inbound.get(p.url) && !inbound.get(p.finalUrl));
  return urls.length
    ? issue({
        type: "orphan-pages",
        module: "seo",
        severity: "notice",
        title: `Link to ${plural(urls.length, "orphan page")} from elsewhere on the site`,
        why: "Pages that only appear in the sitemap get little internal link value and are crawled less.",
        steps: ["Link to each page from a related page or from your navigation."],
        impact: 2,
        effort: 2,
        confidence: 0.5,
        urls,
      })
    : null;
};

// ---------- page-level: GEO / AI readiness ----------

const jsOnly: Rule = (_s, pages) => {
  const urls = pagesWhere(pages, (p) => p.statusCode === 200 && p.wordCount < 50 && p.scriptCount >= 3);
  return urls.length
    ? issue({
        type: "js-only-content",
        module: "geo",
        severity: "critical",
        title: `Make ${plural(urls.length, "page")} readable without JavaScript`,
        why: "Most AI crawlers don't run JavaScript. If the text only appears after scripts run, AI engines see an empty page.",
        steps: ["Use server-side rendering or static generation so the HTML already contains the text.", "Check by viewing the page source (not the inspector): your key text should be there."],
        impact: 5,
        effort: 4,
        confidence: 0.7,
        urls,
      })
    : null;
};

const noStructuredData: Rule = (_s, pages) => {
  const content = pages.filter((p) => p.statusCode === 200 && p.wordCount >= 200);
  const urls = content.filter((p) => !p.schemaTypes.length).map((p) => p.finalUrl);
  return urls.length && urls.length >= Math.ceil(content.length / 2)
    ? issue({
        type: "structured-data-coverage",
        module: "both",
        severity: "warning",
        title: `Add structured data to ${plural(urls.length, "content page")}`,
        why: "Article, Product, Service and FAQ markup gives search engines rich results and helps AI engines extract facts accurately.",
        steps: ["Add the matching schema.org JSON-LD type per page template (Article for posts, Product/Service for offerings, FAQPage for Q&A)."],
        impact: 3,
        effort: 3,
        confidence: 0.6,
        urls,
      })
    : null;
};

const citabilityLead: Rule = (_s, pages) => {
  // A citable page answers up front: a sentence near the top with a concrete fact (number, price, place, date).
  const content = pages.filter((p) => p.statusCode === 200 && p.wordCount >= 200);
  const urls = content
    .filter((p) => !/\d/.test(p.leadText.slice(0, 300)) || p.leadText.length < 80)
    .map((p) => p.finalUrl);
  return urls.length
    ? issue({
        type: "citability-direct-answer",
        module: "geo",
        severity: "notice",
        title: `Open ${plural(urls.length, "page")} with a direct, specific answer`,
        why: "AI engines quote pages that state the answer plainly near the top, with concrete facts such as prices, numbers, places and dates.",
        steps: [
          "Add a 2–3 sentence summary under the H1 that directly answers the page's main question.",
          "Include at least one specific, checkable fact (a price range, a count, a location, a date).",
        ],
        impact: 3,
        effort: 2,
        confidence: 0.5,
        urls,
      })
    : null;
};

const freshness: Rule = (_s, pages) => {
  const content = pages.filter((p) => p.statusCode === 200 && p.wordCount >= 300);
  const urls = content.filter((p) => !p.hasDateSignal).map((p) => p.finalUrl);
  return urls.length && content.length
    ? issue({
        type: "citability-dates",
        module: "geo",
        severity: "notice",
        title: `Show a published or updated date on ${plural(urls.length, "page")}`,
        why: "AI engines and readers favor sources that show they're current.",
        steps: ['Show "Updated <month day, year>" on articles and key pages, and add dateModified to their structured data.'],
        impact: 2,
        effort: 1,
        confidence: 0.4,
        urls,
      })
    : null;
};

const authorship: Rule = (_s, pages) => {
  const articles = pages.filter((p) => p.statusCode === 200 && (p.schemaTypes.some((t) => /Article|BlogPosting/.test(t)) || p.wordCount >= 600));
  const urls = articles.filter((p) => !p.hasAuthorSignal).map((p) => p.finalUrl);
  return urls.length
    ? issue({
        type: "citability-author",
        module: "geo",
        severity: "notice",
        title: `Add author bylines to ${plural(urls.length, "article")}`,
        why: "Named authors with credentials are a trust signal for both Google (E-E-A-T) and AI engines choosing what to cite.",
        steps: ["Add a byline linking to an author page with credentials, and an author Person in the Article JSON-LD."],
        impact: 2,
        effort: 2,
        confidence: 0.4,
        urls,
      })
    : null;
};

const faq: Rule = (site, pages) => {
  if (pages.some((p) => p.hasFaqMarkup)) return null;
  return issue({
    type: "faq-missing",
    module: "geo",
    severity: "notice",
    title: "Answer common customer questions in an FAQ",
    why: "Question-and-answer content maps directly onto how people prompt AI assistants, and is easy for them to quote.",
    steps: ["Add an FAQ section (on the homepage or a dedicated page) with the 5–10 questions customers ask most.", "Mark it up as FAQPage JSON-LD."],
    impact: 3,
    effort: 2,
    confidence: 0.5,
    urls: [site.startUrl],
    draftFix: JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [{ "@type": "Question", name: "How much does … cost?", acceptedAnswer: { "@type": "Answer", text: "Specific answer with a price range." } }],
      },
      null,
      2,
    ),
  });
};

const langRule: Rule = (_s, pages) => {
  const urls = pagesWhere(pages, (p) => p.statusCode === 200 && !p.lang);
  return urls.length
    ? issue({
        type: "lang-missing",
        module: "seo",
        severity: "notice",
        title: `Declare the language on ${plural(urls.length, "page")}`,
        why: "The html lang attribute helps search engines serve the page to the right audience and helps screen readers.",
        steps: ['Add lang="en" (or your language) to the <html> tag.'],
        impact: 1,
        effort: 1,
        confidence: 0.6,
        urls,
      })
    : null;
};

export const RULES: Rule[] = [
  httpsRule,
  robotsBlocksAll,
  aiBotsBlocked,
  robotsMissing,
  sitemapMissing,
  brokenPages,
  redirectChains,
  titleMissing,
  titleLength,
  titleDuplicate,
  metaMissing,
  metaDuplicate,
  h1Rule,
  canonicalRule,
  noindex,
  altText,
  thinContent,
  orphanish,
  jsOnly,
  orgSchema,
  noStructuredData,
  citabilityLead,
  freshness,
  authorship,
  faq,
  llmsTxt,
  langRule,
];

/** Issue types counted toward the AI Readiness score (the on-site half of AI Visibility). */
export const GEO_READINESS_TYPES = new Set([
  "robots-blocks-all",
  "ai-bots-blocked",
  "js-only-content",
  "entity-schema-missing",
  "structured-data-coverage",
  "citability-direct-answer",
  "citability-dates",
  "citability-author",
  "faq-missing",
  "llms-txt-missing",
  "noindex",
  "no-https",
]);

export function runChecks(site: SiteData): Issue[] {
  // Content rules look only at pages that returned HTML; brokenPages reads site.pages itself.
  const htmlPages = site.pages.filter((p) => p.statusCode >= 200 && p.statusCode < 300 && /html/i.test(p.contentType));
  const out: Issue[] = [];
  for (const rule of RULES) {
    const i = rule(site, htmlPages);
    if (i) out.push(i);
  }
  return out;
}
