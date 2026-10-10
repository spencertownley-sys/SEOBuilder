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

/** Client IP for rate limiting. Railway's edge sets X-Forwarded-For; the first entry is the client. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
