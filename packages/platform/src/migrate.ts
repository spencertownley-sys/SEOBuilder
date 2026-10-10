import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pool } from "./db.js";

/** db/migrations at or above the working directory (the repo root, or apps/web under npm -w). */
function findMigrationsDir(): string {
  let dir = process.cwd();
  for (;;) {
    const candidate = join(dir, "db", "migrations");
    if (existsSync(candidate)) return candidate;
    const up = dirname(dir);
    if (up === dir) throw new Error("db/migrations not found; set MIGRATIONS_DIR");
    dir = up;
  }
}

/** Applies db/migrations/*.sql in name order, once each, under an advisory lock. */
export async function migrate(dir = process.env.MIGRATIONS_DIR ?? findMigrationsDir()): Promise<string[]> {
  const c = await pool().connect();
  const applied: string[] = [];
  try {
    await c.query("select pg_advisory_lock(726354)");
    await c.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
    const done = new Set((await c.query<{ name: string }>("select name from schema_migrations")).rows.map((r) => r.name));
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = await readFile(`${dir}/${f}`, "utf8");
      await c.query("begin");
      try {
        await c.query(sql);
        await c.query("insert into schema_migrations (name) values ($1)", [f]);
        await c.query("commit");
        applied.push(f);
      } catch (e) {
        await c.query("rollback");
        throw new Error(`Migration ${f} failed: ${(e as Error).message}`);
      }
    }
  } finally {
    await c.query("select pg_advisory_unlock(726354)").catch(() => {});
    c.release();
  }
  return applied;
}
