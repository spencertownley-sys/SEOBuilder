import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_DAYS, userFromSession, type User } from "@seobuilder/platform";

export const SESSION_COOKIE = "sb_session";

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  return userFromSession(jar.get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

/**
 * Client IP for rate limiting. Railway's edge appends the address it saw to X-Forwarded-For, so
 * the right-most entry is the one a client can't forge; anything to its left was sent by the
 * client and is ignored.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const parts = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts[parts.length - 1] ?? h.get("x-real-ip") ?? "unknown";
}
