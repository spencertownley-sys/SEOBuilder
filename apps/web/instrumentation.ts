// Runs once when the Node server starts: apply migrations, then start the background worker
// (crawls, AI prompt runs, competitor audits, weekly scheduling).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL) return;
  const { checkProductionConfig, migrate, startBackgroundWorker } = await import("@seobuilder/platform");
  checkProductionConfig();
  const applied = await migrate();
  if (applied.length) console.log(`[db] applied migrations: ${applied.join(", ")}`);
  if (process.env.DISABLE_WORKER !== "1") startBackgroundWorker();
}
