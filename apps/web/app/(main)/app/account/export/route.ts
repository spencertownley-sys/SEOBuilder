import { exportAccountData } from "@seobuilder/platform";
import { currentUser } from "@/lib/session";

// "Download my data": everything stored for the signed-in account as a JSON file (SB-20).
export async function GET(): Promise<Response> {
  const user = await currentUser();
  if (!user) return new Response("Log in to download your data.", { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } });
  const data = await exportAccountData(user.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="mentionful-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
