// Postgres-backed throttle for login and signup. Checked before any scrypt work, so a flood of
// attempts can neither guess passwords nor burn the server's CPU.

import { one, q } from "./db.js";
import { hashRequester } from "./requester.js";

export const AUTH_WINDOW_MINUTES = 15;
export const MAX_AUTH_ATTEMPTS_PER_EMAIL = 10;
export const MAX_AUTH_ATTEMPTS_PER_IP = 30;

export const emailKey = (email: string) => `email:${email}`;
export const ipKey = (ip: string) => `ip:${hashRequester(ip)}`;

export async function attemptsInWindow(key: string): Promise<number> {
  const row = await one<{ n: number }>(
    "select count(*)::int as n from auth_attempts where key = $1 and created_at > now() - make_interval(mins => $2)",
    [key, AUTH_WINDOW_MINUTES],
  );
  return row?.n ?? 0;
}

/** True when either key has used up its attempts in the current window. */
export async function authThrottled(email: string, ip?: string): Promise<boolean> {
  if ((await attemptsInWindow(emailKey(email))) >= MAX_AUTH_ATTEMPTS_PER_EMAIL) return true;
  return !!ip && (await attemptsInWindow(ipKey(ip))) >= MAX_AUTH_ATTEMPTS_PER_IP;
}

export async function recordAuthAttempt(keys: string[]): Promise<void> {
  if (keys.length) await q("insert into auth_attempts (key) select unnest($1::text[])", [keys]);
}

export async function clearAuthAttempts(key: string): Promise<void> {
  await q("delete from auth_attempts where key = $1", [key]);
}

export async function purgeAuthAttempts(): Promise<void> {
  await q("delete from auth_attempts where created_at < now() - interval '1 day'");
}
