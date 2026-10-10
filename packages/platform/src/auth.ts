import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { one, q, tx } from "./db.js";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_DAYS = 30;

export interface User {
  id: string;
  email: string;
}

export class AuthError extends Error {}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

// Spends the same scrypt work on unknown emails so response time doesn't reveal which emails exist.
const DUMMY_HASH = "scrypt$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function signUp(emailRaw: string, password: string): Promise<User> {
  const email = normalizeEmail(emailRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AuthError("Enter a valid email address.");
  if (password.length < 8) throw new AuthError("Use a password of at least 8 characters.");
  if (password.length > 200) throw new AuthError("That password is too long.");
  const hash = await hashPassword(password);
  return tx(async (c) => {
    const user = await one<User>(
      "insert into users (email, password_hash) values ($1, $2) on conflict (email) do nothing returning id, email",
      [email, hash],
      c,
    );
    if (!user) throw new AuthError("An account with that email already exists. Log in instead.");
    const ws = await one<{ id: string }>("insert into workspaces (name) values ($1) returning id", [`${email.split("@")[0]}'s workspace`], c);
    await q("insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'owner')", [ws!.id, user.id], c);
    return user;
  });
}

export async function logIn(emailRaw: string, password: string): Promise<User> {
  const row = await one<User & { password_hash: string }>("select id, email, password_hash from users where email = $1", [normalizeEmail(emailRaw)]);
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) throw new AuthError("That email and password don't match.");
  return { id: row.id, email: row.email };
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

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

export async function primaryWorkspace(userId: string): Promise<string> {
  const row = await one<{ workspace_id: string }>(
    "select workspace_id from workspace_members where user_id = $1 order by role = 'owner' desc limit 1",
    [userId],
  );
  if (!row) throw new AuthError("No workspace for this account.");
  return row.workspace_id;
}
