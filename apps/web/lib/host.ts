import { headers } from "next/headers";

// The two public hosts this codebase serves (see proxy.ts).
export const APP_ORIGIN = (process.env.APP_URL ?? "https://mentionful.com").replace(/\/$/, "");
export const LANDING_ORIGIN = "https://betterseobuilder.com";
export const LANDING_HOSTS = new Set(["betterseobuilder.com", "www.betterseobuilder.com"]);

/** Lower-case host name the request was made to, without port. */
export function normalizeHost(raw: string | null | undefined): string {
  return (raw ?? "").split(",")[0]!.trim().split(":")[0]!.toLowerCase();
}

/** True when this request is for the betterseobuilder.com landing page. */
export async function isLandingRequest(): Promise<boolean> {
  if (process.env.SITE_MODE === "landing") return true;
  const h = await headers();
  return LANDING_HOSTS.has(normalizeHost(h.get("x-forwarded-host") ?? h.get("host")));
}
