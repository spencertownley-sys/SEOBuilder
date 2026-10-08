# Check catalog

Every issue the platform can raise, with its starting impact (1–5), effort (1–5) and
confidence (0–1). Task priority = impact × confidence ÷ effort, ×1.25 when a fix helps both SEO
and GEO. These numbers are first estimates (PRD: "impact estimates labelled as estimates");
tune them against before/after data from real sites.

Sources: site and page rules in `packages/core/src/audit/checks.ts`, speed in
`audit/pagespeed.ts`, AI answer findings in `ai/runner.ts`. Some rules adjust their numbers
to the situation (for example `ai-bots-blocked` is critical only when it blocks bots that feed
live AI answers, and a warning when it blocks training-only crawlers); the table shows the
stronger case.

| Type | Helps | Severity | Impact | Effort | Confidence | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| `no-https` | SEO + GEO | critical | 4 | 2 | 0.9 | Browsers flag HTTP sites as not secure, Google uses HTTPS as a ranking signal, and AI engines prefer secure sources. |
| `ai-bots-blocked` | GEO | critical | 5 | 1 | 0.85 | OAI-SearchBot fetch pages for live AI answers and citations; blocking them keeps you out of those answers. |
| `sitemap-missing` | SEO | warning | 3 | 1 | 0.8 | A sitemap tells search engines which pages exist and when they changed, so new pages get found faster. |
| `broken-links` | SEO | critical | 4 | 2 | 0.9 | Links to missing pages waste crawl budget, leak link value and frustrate visitors. |
| `redirect-chains` | SEO | warning | 2 | 2 | 0.8 | Each extra redirect hop slows the page and can stop crawlers before they reach the content. |
| `title-missing` | SEO + GEO | critical | 4 | 1 | 0.9 | The title is the headline in search results and a key signal of what a page is about. |
| `title-length` | SEO | notice | 2 | 1 | 0.6 | Titles under ~20 characters waste the space; over ~65 get cut off in search results. |
| `title-duplicate` | SEO | warning | 3 | 2 | 0.7 | When pages share a title, search engines can't tell which one to rank and may pick the wrong one. |
| `meta-description-missing` | SEO | warning | 2 | 1 | 0.7 | The meta description is your pitch under the title in search results; without one, Google picks a random snippet. |
| `meta-description-duplicate` | SEO | notice | 1 | 1 | 0.6 | Repeated descriptions make pages look interchangeable in search results. |
| `h1` | SEO + GEO | warning | 2 | 1 | 0.6 | A single clear H1 tells search engines and AI models the page's main topic. |
| `canonical-missing` | SEO | notice | 2 | 1 | 0.6 | Canonical tags tell search engines which URL is the main version, which stops duplicates (tracking parameters, http/https) from splitting ranking signals. |
| `noindex` | SEO + GEO | warning | 3 | 1 | 0.5 | noindex pages are dropped from search results and are unlikely to be cited by AI search. Make sure that's intentional. |
| `image-alt-missing` | SEO | notice | 2 | 2 | 0.7 | Alt text makes images accessible and helps them rank in image search. |
| `thin-content` | SEO + GEO | notice | 3 | 3 | 0.5 | Pages with little text give search engines and AI models little to understand, rank or quote. |
| `orphan-pages` | SEO | notice | 2 | 2 | 0.5 | Pages that only appear in the sitemap get little internal link value and are crawled less. |
| `js-only-content` | GEO | critical | 5 | 4 | 0.7 | Most AI crawlers don't run JavaScript. If the text only appears after scripts run, AI engines see an empty page. |
| `entity-schema-missing` | SEO + GEO | warning | 4 | 2 | 0.7 | Structured data states who you are, where you are and how to contact you in a form search engines and AI models parse reliably, which helps them describe you correctly. |
| `structured-data-coverage` | SEO + GEO | warning | 3 | 3 | 0.6 | Article, Product, Service and FAQ markup gives search engines rich results and helps AI engines extract facts accurately. |
| `citability-direct-answer` | GEO | notice | 3 | 2 | 0.5 | AI engines quote pages that state the answer plainly near the top, with concrete facts such as prices, numbers, places and dates. |
| `citability-dates` | GEO | notice | 2 | 1 | 0.4 | AI engines and readers favor sources that show they're current. |
| `citability-author` | GEO | notice | 2 | 2 | 0.4 | Named authors with credentials are a trust signal for both Google (E-E-A-T) and AI engines choosing what to cite. |
| `faq-missing` | GEO | notice | 3 | 2 | 0.5 | Question-and-answer content maps directly onto how people prompt AI assistants, and is easy for them to quote. |
| `llms-txt-missing` | GEO | notice | 1 | 1 | 0.3 | llms.txt is an emerging convention that gives AI tools a plain-text map of your key pages. Its impact is unproven, so treat it as low priority. |
| `lang-missing` | SEO | notice | 1 | 1 | 0.6 | The html lang attribute helps search engines serve the page to the right audience and helps screen readers. |
| `robots-missing` | SEO + GEO | notice | 2 | 1 | 0.8 | Without robots.txt, crawlers fall back to defaults and you can't point them to your sitemap. |
| `robots-blocks-all` | SEO + GEO | critical | 5 | 1 | 0.95 | A `Disallow: /` for every user agent keeps you out of search results and AI answers entirely. |
| `core-web-vitals` | SEO | critical | 4 | 3 | 0.7 | Core Web Vitals are a Google ranking factor and slow pages lose visitors. LCP 5.0s (good is ≤ 2.5s); CLS 0.30 (good is ≤ 0.1); INP 400ms (good is ≤ 200ms). |
| `ai-competitor-gap` | GEO | warning | 4 | 3 | 0.6 | When AI assistants recommend competitors for a question, the page that answers that question best on your site is missing or not being found. |
| `ai-absent-<engine>` | GEO | warning | 3 | 3 | 0.5 | Each engine draws on different sources. Being absent in claude usually means its crawler can't reach you, or the sites it trusts don't mention you. |
| `ai-fact-errors` | GEO | critical | 5 | 2 | 0.6 | Wrong prices, hours or services in AI answers send customers away or set the wrong expectations. |
| `ai-source-opportunities` | GEO | notice | 3 | 4 | 0.5 | AI answers lean on a small set of third-party sources. Appearing there is often the fastest way into the answers. |
