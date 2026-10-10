import { one } from "@seobuilder/platform";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await one("select 1");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "database unavailable" }, { status: 503 });
  }
}
