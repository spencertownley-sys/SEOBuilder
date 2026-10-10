import { createHash } from "node:crypto";
import type { PublicAuditResult } from "./audits.js";
import { one } from "./db.js";
import { enqueue, getJob } from "./jobs.js";
import { InputError, normalizeSiteUrl } from "./sites.js";

// Free audit limits: each request is up to 50 page fetches plus a PageSpeed call.
export const PUBLIC_AUDITS_PER_HOUR = Number(process.env.PUBLIC_AUDITS_PER_HOUR ?? 6);
export const MAX_QUEUED_PUBLIC_AUDITS = Number(process.env.MAX_QUEUED_PUBLIC_AUDITS ?? 25);

export class RateLimitError extends Error {}

export function hashRequester(ip: string): string {
  return createHash("sha256")
    .update(`${process.env.REQUESTER_SALT ?? "seobuilder"}|${ip}`)
    .digest("hex")
    .slice(0, 32);
}

export async function requestPublicAudit(rawUrl: string, ip: string): Promise<string> {
  const url = normalizeSiteUrl(rawUrl).toString();
  const requester = hashRequester(ip);
  const recent = await one<{ n: number }>(
    "select count(*)::int as n from jobs where kind = 'public_audit' and requester_hash = $1 and created_at > now() - interval '1 hour'",
    [requester],
  );
  if ((recent?.n ?? 0) >= PUBLIC_AUDITS_PER_HOUR) throw new RateLimitError(`You've run ${PUBLIC_AUDITS_PER_HOUR} free audits in the last hour. Try again later, or sign up to save sites.`);
  const queued = await one<{ n: number }>("select count(*)::int as n from jobs where kind = 'public_audit' and status in ('queued','running')");
  if ((queued?.n ?? 0) >= MAX_QUEUED_PUBLIC_AUDITS) throw new RateLimitError("We're running a lot of audits right now. Please try again in a few minutes.");
  // Reuse a fresh report of the same URL rather than crawling it again.
  const existing = await one<{ id: string }>(
    "select id from jobs where kind = 'public_audit' and payload->>'url' = $1 and status <> 'failed' and created_at > now() - interval '10 minutes' order by created_at desc limit 1",
    [url],
  );
  if (existing) return existing.id;
  return enqueue("public_audit", { url }, { requesterHash: requester });
}

export type PublicReport =
  | { state: "queued" | "running"; url: string; progress: string | null; position?: number }
  | { state: "failed"; url: string; error: string }
  | { state: "done"; url: string; result: PublicAuditResult; createdAt: Date };

export async function getPublicReport(id: string): Promise<PublicReport | null> {
  const job = await getJob(id);
  if (!job || job.kind !== "public_audit") return null;
  const url = job.payload.url ?? "";
  if (job.status === "done") return { state: "done", url, result: job.result as PublicAuditResult, createdAt: job.finished_at ?? job.created_at };
  if (job.status === "failed") return { state: "failed", url, error: job.error ?? "The audit failed." };
  let position: number | undefined;
  if (job.status === "queued") {
    const ahead = await one<{ n: number }>("select count(*)::int as n from jobs where status = 'queued' and kind = 'public_audit' and created_at < $1", [job.created_at]);
    position = (ahead?.n ?? 0) + 1;
  }
  return { state: job.status, url, progress: job.progress, position };
}
