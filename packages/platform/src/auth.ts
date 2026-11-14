import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";
import { promisify } from "node:util";
import { one, q, tx } from "./db.js";
import { appUrl, mailConfigured, sendEmail } from "./mail.js";
import { attemptsInWindow, authThrottled, clearAuthAttempts, emailKey, ipKey, MAX_AUTH_ATTEMPTS_PER_IP, recordAuthAttempt } from "./ratelimit.js";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts?: ScryptOptions) => Promise<Buffer>;

export const SESSION_DAYS = 30;

export interface User {
  id: string;
  email: string;
}

export const TOKEN_MINUTES = 60;

export class AuthError extends Error {
  readonly code: string;
  constructor(message: string, code = "auth_failed") {
    super(message);
    this.code = code;
  }
}

const TOO_MANY = "Too many attempts. Try again in 15 minutes.";
const NO_MATCH = "That email and password don't match.";
export const MAX_PASSWORD_LENGTH = 200;

// OWASP's scrypt guidance (N=2^17, r=8, p=1). Needs 128 MiB per hash, so maxmem is raised.
const SCRYPT = { N: 131072, r: 8, p: 1 } as const;
const MAXMEM = 256 * 1024 * 1024;
const PARAMS = `N=${SCRYPT.N},r=${SCRYPT.r},p=${SCRYPT.p}`;

/** Stored as scrypt$N=131072,r=8,p=1$salt$hash (base64). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, { ...SCRYPT, maxmem: MAXMEM });
  return `scrypt$${PARAMS}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** Reads both the current format and the original scrypt$salt$hash one (Node defaults, N=16384). */
function parseHash(stored: string): { opts: ScryptOptions; salt: Buffer; hash: Buffer; current: boolean } | null {
  const parts = stored.split("$");
  if (parts[0] !== "scrypt") return null;
  if (parts.length === 3 && parts[1] && parts[2]) {
    return { opts: {}, salt: Buffer.from(parts[1], "base64"), hash: Buffer.from(parts[2], "base64"), current: false };
  }
  if (parts.length !== 4 || !parts[1] || !parts[2] || !parts[3]) return null;
  const p = Object.fromEntries(parts[1].split(",").map((kv) => kv.split("=")).map(([k, v]) => [k, Number(v)]));
  const N = p.N ?? 0;
  const r = p.r ?? 0;
  const par = p.p ?? 0;
  // Refuse absurd parameters from a tampered row rather than burning memory on them.
  if (!(N >= 2 && N <= 2 ** 20 && (N & (N - 1)) === 0 && r >= 1 && r <= 32 && par >= 1 && par <= 16)) return null;
  return {
    opts: { N, r, p: par, maxmem: MAXMEM },
    salt: Buffer.from(parts[2], "base64"),
    hash: Buffer.from(parts[3], "base64"),
    current: parts[1] === PARAMS,
  };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseHash(stored);
  if (!parsed || !parsed.hash.length) return false;
  const actual = await scrypt(password, parsed.salt, parsed.hash.length, parsed.opts);
  return timingSafeEqual(actual, parsed.hash);
}

/** True when a stored hash uses older parameters and should be replaced after a good login. */
export function needsRehash(stored: string): boolean {
  return !parseHash(stored)?.current;
}

// Spends the same scrypt work on unknown emails so response time doesn't reveal which emails exist.
const DUMMY_HASH = `scrypt$${PARAMS}$AAAAAAAAAAAAAAAAAAAAAA==$` + Buffer.alloc(64).toString("base64");

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** `ip` is the client address for throttling; omit it for scripts and tests. */
export async function signUp(emailRaw: string, password: string, ip?: string): Promise<User> {
  const email = normalizeEmail(emailRaw);
  if (await authThrottled(email, ip)) throw new AuthError(TOO_MANY, "too_many_attempts");
  // Every signup counts against the IP, so one client can't mass-create accounts.
  if (ip) await recordAuthAttempt([ipKey(ip)]);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AuthError("Enter a valid email address.", "invalid_email");
  if (password.length < 8) throw new AuthError("Use a password of at least 8 characters.", "weak_password");
  if (password.length > MAX_PASSWORD_LENGTH) throw new AuthError("That password is too long.", "long_password");
  const hash = await hashPassword(password);
  return tx(async (c) => {
    const user = await one<User>(
      "insert into users (email, password_hash) values ($1, $2) on conflict (email) do nothing returning id, email",
      [email, hash],
      c,
    );
    if (!user) throw new AuthError("An account with that email already exists. Log in instead.", "account_exists");
    const ws = await one<{ id: string }>("insert into workspaces (name) values ($1) returning id", [`${email.split("@")[0]}'s workspace`], c);
    await q("insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'owner')", [ws!.id, user.id], c);
    return user;
  });
}

export async function logIn(emailRaw: string, password: string, ip?: string): Promise<User> {
  const email = normalizeEmail(emailRaw);
  // Checked before scrypt: once a key is throttled even the right password is refused until the
  // window passes, so guessing can't continue and floods don't cost CPU.
  if (await authThrottled(email, ip)) throw new AuthError(TOO_MANY, "too_many_attempts");
  const failed = async () => {
    await recordAuthAttempt(ip ? [emailKey(email), ipKey(ip)] : [emailKey(email)]);
    return new AuthError(NO_MATCH, "login_failed");
  };
  // No account can have a longer password (signup caps it), so don't spend scrypt on one.
  if (password.length > MAX_PASSWORD_LENGTH) throw await failed();
  const row = await one<User & { password_hash: string }>("select id, email, password_hash from users where email = $1", [email]);
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) throw await failed();
  await clearAuthAttempts(emailKey(email));
  // Upgrade hashes made with older scrypt parameters now that we know the password.
  if (needsRehash(row.password_hash)) await q("update users set password_hash = $2 where id = $1", [row.id, await hashPassword(password)]);
  return { id: row.id, email: row.email };
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// ---------- email verification and password reset ----------

/** Verification is required once the app can send email (see mail.ts). */
export function emailVerificationRequired(): boolean {
  return mailConfigured();
}

type TokenPurpose = "verify" | "reset";

async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  // One live token per purpose: a new email replaces the old link.
  await q("delete from auth_tokens where user_id = $1 and purpose = $2", [userId, purpose]);
  await q("insert into auth_tokens (token_hash, user_id, purpose, expires_at) values ($1, $2, $3, now() + make_interval(mins => $4))", [
    sha256(token),
    userId,
    purpose,
    TOKEN_MINUTES,
  ]);
  return token;
}

/** Marks the token used and returns its user, or null when it is unknown, expired or already used. */
async function consumeToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  if (!token || token.length > 100) return null;
  const row = await one<{ user_id: string }>(
    "update auth_tokens set used_at = now() where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now() returning user_id",
    [sha256(token), purpose],
  );
  return row?.user_id ?? null;
}

async function sendVerification(user: User): Promise<void> {
  const token = await issueToken(user.id, "verify");
  await sendEmail({
    to: user.email,
    subject: "Confirm your email for Mentionful",
    text: `Confirm your email address to finish setting up your Mentionful account:\n\n${appUrl()}/verify?token=${token}\n\nThe link works once and expires in ${TOKEN_MINUTES} minutes. If you did not sign up, ignore this email.`,
  });
}

/**
 * Signup as the web form uses it. Once email works, a new address and one that already has an
 * account get the same response ("check your email") so the form can't be used to test which
 * emails are registered; the existing owner gets a note instead of a verification link.
 * Without email (local development, or before the owner sets up a provider) it falls back to
 * creating the account and signing in straight away.
 */
export async function startSignUp(emailRaw: string, password: string, ip?: string): Promise<{ user: User | null }> {
  if (!emailVerificationRequired()) return { user: await signUp(emailRaw, password, ip) };
  try {
    const user = await signUp(emailRaw, password, ip);
    await sendVerification(user);
  } catch (e) {
    if (!(e instanceof AuthError) || e.code !== "account_exists") throw e;
    const email = normalizeEmail(emailRaw);
    await sendEmail({
      to: email,
      subject: "Someone tried to sign up to Mentionful with your email",
      text: `Someone, probably you, tried to create a Mentionful account with this email address, but you already have one.\n\nLog in: ${appUrl()}/login\nForgot your password? ${appUrl()}/forgot\n\nIf this wasn't you, you can ignore this email.`,
    });
  }
  return { user: null };
}

export async function isEmailVerified(userId: string): Promise<boolean> {
  const row = await one<{ verified: boolean }>("select email_verified_at is not null as verified from users where id = $1", [userId]);
  return !!row?.verified;
}

/** Throws unless the account's email is confirmed (when verification is switched on). */
export async function requireVerifiedEmail(userId: string): Promise<void> {
  if (!emailVerificationRequired()) return;
  if (!(await isEmailVerified(userId))) throw new AuthError("Confirm your email address first. Check your inbox for the link, or send a new one from your sites page.", "verify_email_first");
}

/** Sends a fresh verification link, at most 3 times per 15 minutes. */
export async function resendVerification(userId: string): Promise<void> {
  const user = await one<User & { verified: boolean }>("select id, email, email_verified_at is not null as verified from users where id = $1", [userId]);
  if (!user || user.verified) return;
  const key = `verify:${user.id}`;
  if ((await attemptsInWindow(key)) >= 3) throw new AuthError(TOO_MANY, "too_many_attempts");
  await recordAuthAttempt([key]);
  await sendVerification({ id: user.id, email: user.email });
}

/** Confirms the email behind a verification link. Returns the user so the caller can sign them in. */
export async function verifyEmail(token: string): Promise<User> {
  const userId = await consumeToken(token, "verify");
  if (!userId) throw new AuthError("That link is invalid or has expired.", "link_invalid");
  const user = await one<User>("update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1 returning id, email", [userId]);
  if (!user) throw new AuthError("That link is invalid or has expired.", "link_invalid");
  return user;
}

/** Emails a reset link when the address has an account. The caller shows the same message either way. */
export async function requestPasswordReset(emailRaw: string, ip?: string): Promise<void> {
  const email = normalizeEmail(emailRaw);
  const key = `reset:${email}`;
  // Quietly stop after 3 links per address (and the usual per-IP cap) so this can't flood an inbox.
  if ((await attemptsInWindow(key)) >= 3 || (ip && (await attemptsInWindow(ipKey(ip))) >= MAX_AUTH_ATTEMPTS_PER_IP)) return;
  await recordAuthAttempt(ip ? [key, ipKey(ip)] : [key]);
  const user = await one<User>("select id, email from users where email = $1", [email]);
  if (!user) return;
  const token = await issueToken(user.id, "reset");
  await sendEmail({
    to: user.email,
    subject: "Reset your Mentionful password",
    text: `Someone asked to reset the password for this Mentionful account. To choose a new password, open:\n\n${appUrl()}/reset?token=${token}\n\nThe link works once and expires in ${TOKEN_MINUTES} minutes. If you didn't ask for this, ignore this email; your password stays the same.`,
  });
}

/** Sets a new password from a reset link (single use), signs out every session and confirms the email. */
export async function resetPassword(token: string, password: string): Promise<User> {
  if (password.length < 8) throw new AuthError("Use a password of at least 8 characters.", "weak_password");
  if (password.length > MAX_PASSWORD_LENGTH) throw new AuthError("That password is too long.", "long_password");
  const userId = await consumeToken(token, "reset");
  if (!userId) throw new AuthError("That link is invalid or has expired. Ask for a new one.", "reset_link_invalid");
  const hash = await hashPassword(password);
  const user = await one<User>(
    "update users set password_hash = $2, email_verified_at = coalesce(email_verified_at, now()) where id = $1 returning id, email",
    [userId, hash],
  );
  if (!user) throw new AuthError("That link is invalid or has expired. Ask for a new one.", "reset_link_invalid");
  await destroyAllSessions(user.id);
  await clearAuthAttempts(emailKey(user.email));
  return user;
}

/** Returns the raw session token for the cookie; only its hash is stored. */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await q("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + make_interval(days => $3))", [sha256(token), userId, SESSION_DAYS]);
  return token;
}

export async function userFromSession(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const row = await one<User>(
    "select u.id, u.email from sessions s join users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now()",
    [sha256(token)],
  );
  return row ?? null;
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (token) await q("delete from sessions where token_hash = $1", [sha256(token)]);
}

/** "Log out of all devices": removes every session of this user. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await q("delete from sessions where user_id = $1", [userId]);
}

export async function purgeExpiredSessions(): Promise<void> {
  await q("delete from sessions where expires_at < now()");
}

export async function primaryWorkspace(userId: string): Promise<string> {
  const row = await one<{ workspace_id: string }>(
    "select workspace_id from workspace_members where user_id = $1 order by role = 'owner' desc limit 1",
    [userId],
  );
  if (!row) throw new AuthError("No workspace for this account.");
  return row.workspace_id;
}
