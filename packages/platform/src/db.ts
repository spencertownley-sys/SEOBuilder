import pg from "pg";

// One pool per process. DATABASE_URL comes from Railway's Postgres service (or a local Postgres).
const g = globalThis as unknown as { __seobuilderPool?: pg.Pool };

export function pool(): pg.Pool {
  if (!g.__seobuilderPool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    g.__seobuilderPool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
  }
  return g.__seobuilderPool;
}

export type Db = pg.Pool | pg.PoolClient;

export async function q<T extends pg.QueryResultRow = Record<string, unknown>>(sql: string, params: unknown[] = [], db: Db = pool()): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

export async function one<T extends pg.QueryResultRow = Record<string, unknown>>(sql: string, params: unknown[] = [], db: Db = pool()): Promise<T | undefined> {
  return (await db.query<T>(sql, params)).rows[0];
}

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

export async function closePool(): Promise<void> {
  await g.__seobuilderPool?.end();
  g.__seobuilderPool = undefined;
}
