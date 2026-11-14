import { createHash } from "node:crypto";

/** Hashed client IP for rate limits. The raw IP is never stored. */
export function hashRequester(ip: string): string {
  return createHash("sha256")
    .update(`${process.env.REQUESTER_SALT ?? "seobuilder"}|${ip}`)
    .digest("hex")
    .slice(0, 32);
}
