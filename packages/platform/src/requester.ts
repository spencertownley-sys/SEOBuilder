import { createHash } from "node:crypto";

/**
 * The salt for hashing client IPs. IPv4 has only 2^32 values, so a public default salt would let
 * anyone reverse the stored hashes; production must set its own random REQUESTER_SALT.
 */
export function requesterSalt(): string {
  const salt = process.env.REQUESTER_SALT;
  if (salt) return salt;
  if (process.env.NODE_ENV === "production") throw new Error("REQUESTER_SALT must be set in production (a random 32-byte value).");
  return "seobuilder-development-only";
}

/** Hashed client IP for rate limits. The raw IP is never stored. */
export function hashRequester(ip: string): string {
  return createHash("sha256").update(`${requesterSalt()}|${ip}`).digest("hex").slice(0, 32);
}
