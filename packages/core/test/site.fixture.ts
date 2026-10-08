import { createServer, type Server } from "node:http";

// A small site with a known set of problems, served on localhost for crawler/audit tests.
export const FILES: Record<string, { status?: number; type?: string; body: string; location?: string }> = {
  "/robots.txt": { type: "text/plain", body: "User-agent: *\nAllow: /\n\nUser-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: GPTBot\nDisallow: /\n\nSitemap: {origin}/sitemap.xml\n" },
  "/sitemap.xml": {
    type: "application/xml",
    body: `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{origin}/</loc></url><url><loc>{origin}/orphan</loc></url></urlset>`,
  },
  "/": {
    body: `<!doctype html><html lang="en"><head><title>Tacoma Wedding Photographer | Example Studio</title>
<meta name="description" content="Wedding and portrait photography in Tacoma and Seattle, from $1,800.">
<link rel="canonical" href="{origin}/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Example Studio"}</script>
</head><body><main><h1>Wedding photography in Tacoma</h1>
<p>Example Studio photographs about 40 weddings a year in Tacoma and Seattle. Packages start at $1,800 and include 8 hours of coverage.</p>
${"<p>More detail about our approach, our process and what to expect on the day. </p>".repeat(20)}
<a href="/pricing">Pricing</a> <a href="/old">Old page</a> <a href="/missing">Missing</a> <a href="/app">App</a> <a href="{alt}/forbidden">Bot-blocked news site</a> <a href="{alt}/gone">Dead external</a>
<img src="a.jpg"><img src="b.jpg" alt="Couple at Point Defiance">
</main></body></html>`,
  },
  "/pricing": {
    body: `<!doctype html><html lang="en"><head><title>Tacoma Wedding Photographer | Example Studio</title></head><body><h1>Pricing</h1><h1>Packages</h1><p>Short.</p></body></html>`,
  },
  "/old": { status: 301, location: "/older", body: "" },
  "/older": { status: 301, location: "/pricing", body: "" },
  "/app": { body: `<!doctype html><html><head><title>App</title></head><body><div id="root"></div><script src="a.js"></script><script src="b.js"></script><script>boot()</script></body></html>` },
  "/forbidden": { status: 403, body: "blocked" },
  "/orphan": { body: `<!doctype html><html lang="en"><head><title>A page only the sitemap knows about</title></head><body><h1>Orphan</h1><p>Hello.</p></body></html>` },
};

export async function startSite(): Promise<{ origin: string; server: Server }> {
  const server = createServer((req, res) => {
    const f = FILES[req.url ?? "/"];
    const origin = `http://${req.headers.host}`;
    if (!f) {
      res.writeHead(404, { "content-type": "text/html" }).end("<h1>Not found</h1>");
      return;
    }
    res.writeHead(f.status ?? 200, { "content-type": f.type ?? "text/html; charset=utf-8", ...(f.location ? { location: f.location } : {}) });
    res.end(f.body.replaceAll("{origin}", origin).replaceAll("{alt}", origin.replace("127.0.0.1", "localhost")));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return { origin: `http://127.0.0.1:${addr.port}`, server };
}
