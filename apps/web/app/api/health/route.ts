import { one } from "@seobuilder/platform";

export const dynamic = "force-dynamic";

export async function GET() {
  // The landing-page service has no database.
  if (process.env.SITE_MODE === "landing") return Response.json({ ok: true, mode: "landing" });
  try {
    await one("select 1");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "database unavailable" }, { status: 503 });
  }
}
