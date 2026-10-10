import { resolveTxt } from "node:dns/promises";
import { politeFetch, suggestPrompts, type BrandProfile, type BusinessKind } from "@seobuilder/core";
import { primaryWorkspace } from "./auth.js";
import { one, q, tx, type Db } from "./db.js";
import { enqueue } from "./jobs.js";

export class NotFoundError extends Error {}
export class InputError extends Error {}

export interface SiteRow {
  id: string;
  workspace_id: string;
  url: string;
  domain: string;
  name: string;
  aliases: string[];
  verified_at: Date | null;
  verification_token: string;
  business_kind: BusinessKind;
  business_type: string;
  services: string[];
  locations: string[];
  brand_facts: Record<string, string>;
  next_crawl_at: Date;
  next_prompt_run_at: Date | null;
  created_at: Date;
}

export interface CompetitorRow {
  id: string;
  site_id: string;
  domain: string | null;
  name: string;
  aliases: string[];
  scores: { technical: number; search: number | null; aiVisibility: number; aiReadiness: number } | null;
  audited_at: Date | null;
}

/** Normalizes user input to an http(s) URL with a real hostname, or throws InputError. */
export function normalizeSiteUrl(raw: string): URL {
  const s = raw.trim();
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    throw new InputError("That doesn't look like a website address.");
  }
  if ((u.protocol !== "http:" && u.protocol !== "https:") || !u.hostname.includes(".") || u.username || u.password) {
    throw new InputError("That doesn't look like a website address.");
  }
  u.hash = "";
  return u;
}

export const domainOf = (u: URL) => u.hostname.replace(/^www\./, "").toLowerCase();

const list = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : (v ?? "").split(/[,\n]/))
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 20);

/** Membership check: every read or write of site data goes through this. */
export async function requireSite(userId: string, siteId: string, db?: Db): Promise<SiteRow> {
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) throw new NotFoundError("Site not found");
  const site = await one<SiteRow>(
    `select s.* from sites s join workspace_members m on m.workspace_id = s.workspace_id
      where s.id = $1 and m.user_id = $2`,
    [siteId, userId],
    db,
  );
  if (!site) throw new NotFoundError("Site not found");
  return site;
}

export interface NewSiteInput {
  url: string;
  name?: string;
  kind?: string;
  businessType?: string;
  services?: string | string[];
  locations?: string | string[];
  competitors?: string | string[]; // "Name" or "Name | domain.com" or "domain.com"
}

const KINDS: BusinessKind[] = ["service", "store", "publisher"];
const kindOf = (v: string | undefined): BusinessKind => (KINDS.includes(v as BusinessKind) ? (v as BusinessKind) : "service");

export function parseCompetitor(line: string): { name: string; domain: string | null } {
  const [a, b] = line.split("|").map((x) => x.trim());
  const looksLikeDomain = (x?: string) => !!x && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(x.replace(/^https?:\/\//, ""));
  if (b && looksLikeDomain(b)) return { name: a!, domain: domainOf(normalizeSiteUrl(b)) };
  if (looksLikeDomain(a)) return { name: a!.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""), domain: domainOf(normalizeSiteUrl(a!)) };
  return { name: a!, domain: null };
}

export async function createSite(userId: string, input: NewSiteInput): Promise<string> {
  const u = normalizeSiteUrl(input.url);
  const domain = domainOf(u);
  const workspaceId = await primaryWorkspace(userId);
  const name = input.name?.trim() || domain;
  const services = list(input.services);
  const locations = list(input.locations);
  const competitors = list(input.competitors).slice(0, 5).map(parseCompetitor);
  const businessType = input.businessType?.trim() ?? "";

  const siteId = await tx(async (c) => {
    const site = await one<{ id: string }>(
      `insert into sites (workspace_id, url, domain, name, business_kind, business_type, services, locations)
       values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (workspace_id, domain) do nothing returning id`,
      [workspaceId, u.toString(), domain, name, kindOf(input.kind), businessType, services, locations],
      c,
    );
    if (!site) throw new InputError(`You've already added ${domain}.`);
    for (const comp of competitors) {
      await q("insert into competitors (site_id, name, domain) values ($1, $2, $3)", [site.id, comp.name, comp.domain], c);
    }
    await seedPrompts(site.id, c);
    return site.id;
  });
  await enqueue("site_crawl", { siteId });
  for (const comp of await q<{ id: string }>("select id from competitors where site_id = $1 and domain is not null", [siteId])) {
    await enqueue("competitor_audit", { competitorId: comp.id });
  }
  return siteId;
}

export async function brandProfile(siteId: string, db?: Db): Promise<BrandProfile & { facts: Record<string, string> }> {
  const s = await one<SiteRow>("select * from sites where id = $1", [siteId], db);
  if (!s) throw new NotFoundError("Site not found");
  const comps = await q<CompetitorRow>("select * from competitors where site_id = $1 order by name", [siteId], db);
  return {
    name: s.name,
    domain: s.domain,
    aliases: s.aliases,
    kind: s.business_kind,
    businessType: s.business_type || "business",
    services: s.services,
    locations: s.locations,
    competitors: comps.map((c) => ({ name: c.name, domain: c.domain ?? undefined, aliases: c.aliases })),
    facts: s.brand_facts ?? {},
  };
}

/** Adds suggested prompts (PRD: AI suggests 20–50) without touching ones the user already has. */
export async function seedPrompts(siteId: string, db?: Db, max = 25): Promise<number> {
  const profile = await brandProfile(siteId, db);
  let added = 0;
  for (const p of suggestPrompts(profile, max)) {
    const r = await q("insert into prompts (site_id, text, intent, location) values ($1, $2, $3, $4) on conflict do nothing returning id", [siteId, p.text, p.intent, p.location ?? null], db);
    added += r.length;
  }
  return added;
}

export async function listSites(userId: string) {
  return q<{
    id: string;
    name: string;
    domain: string;
    verified_at: Date | null;
    technical: number | null;
    ai_visibility: number | null;
    open_tasks: number;
    last_crawl: Date | null;
    crawling: boolean;
  }>(
    `select s.id, s.name, s.domain, s.verified_at,
            sc.technical, sc.ai_visibility,
            (select count(*)::int from tasks t where t.site_id = s.id and not t.resolved and t.status in ('todo','in_progress')) as open_tasks,
            (select max(finished_at) from crawls c where c.site_id = s.id and c.status = 'done') as last_crawl,
            exists (select 1 from jobs j where j.kind = 'site_crawl' and j.status in ('queued','running') and j.payload->>'siteId' = s.id::text) as crawling
       from sites s
       join workspace_members m on m.workspace_id = s.workspace_id and m.user_id = $1
       left join lateral (select technical, ai_visibility from score_snapshots where site_id = s.id order by taken_at desc limit 1) sc on true
      order by s.created_at`,
    [userId],
  );
}

export async function updateSiteProfile(
  userId: string,
  siteId: string,
  input: { name?: string; kind?: string; businessType?: string; services?: string; locations?: string; aliases?: string; facts?: string },
): Promise<void> {
  const site = await requireSite(userId, siteId);
  const facts: Record<string, string> = {};
  for (const line of (input.facts ?? "").split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) {
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (k && v) facts[k] = v;
    }
  }
  await q(
    `update sites set name = $2, business_type = $3, services = $4, locations = $5, aliases = $6, brand_facts = $7, business_kind = $8 where id = $1`,
    [
      site.id,
      input.name?.trim() || site.name,
      input.businessType?.trim() ?? site.business_type,
      input.services !== undefined ? list(input.services) : site.services,
      input.locations !== undefined ? list(input.locations) : site.locations,
      input.aliases !== undefined ? list(input.aliases) : site.aliases,
      input.facts !== undefined ? facts : site.brand_facts,
      input.kind !== undefined ? kindOf(input.kind) : site.business_kind,
    ],
  );
}

export async function addCompetitor(userId: string, siteId: string, line: string): Promise<void> {
  const site = await requireSite(userId, siteId);
  if (!line.trim()) throw new InputError("Enter a competitor name or website.");
  const count = await one<{ n: number }>("select count(*)::int as n from competitors where site_id = $1", [site.id]);
  if ((count?.n ?? 0) >= 5) throw new InputError("You can compare up to 5 competitors.");
  const comp = parseCompetitor(line);
  const row = await one<{ id: string }>("insert into competitors (site_id, name, domain) values ($1, $2, $3) returning id", [site.id, comp.name, comp.domain]);
  if (comp.domain) await enqueue("competitor_audit", { competitorId: row!.id });
}

export async function removeCompetitor(userId: string, siteId: string, competitorId: string): Promise<void> {
  const site = await requireSite(userId, siteId);
  await q("delete from competitors where id = $1 and site_id = $2", [competitorId, site.id]);
}

export async function deleteSite(userId: string, siteId: string): Promise<void> {
  const site = await requireSite(userId, siteId);
  await q("delete from sites where id = $1", [site.id]);
}

/**
 * Ownership verification (PRD P0): a meta tag on the homepage or a DNS TXT record.
 *   <meta name="seobuilder-verification" content="TOKEN">
 *   TXT  seobuilder-verification=TOKEN
 */
export async function verifySite(userId: string, siteId: string): Promise<{ verified: boolean; method?: "meta" | "dns" }> {
  const site = await requireSite(userId, siteId);
  if (site.verified_at) return { verified: true };
  const res = await politeFetch(site.url, { timeoutMs: 10000, maxBytes: 1_000_000 });
  const meta = new RegExp(`<meta[^>]+name=["']seobuilder-verification["'][^>]+content=["']${site.verification_token}["']`, "i");
  const metaRev = new RegExp(`<meta[^>]+content=["']${site.verification_token}["'][^>]+name=["']seobuilder-verification["']`, "i");
  let method: "meta" | "dns" | undefined;
  if (meta.test(res.body) || metaRev.test(res.body)) method = "meta";
  else {
    try {
      const records = (await resolveTxt(site.domain)).map((r) => r.join(""));
      if (records.includes(`seobuilder-verification=${site.verification_token}`)) method = "dns";
    } catch {
      /* no TXT records */
    }
  }
  if (method) await q("update sites set verified_at = now() where id = $1", [site.id]);
  return { verified: !!method, method };
}
