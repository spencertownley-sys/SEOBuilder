import { redirect } from "next/navigation";
import { requestPublicAudit } from "@seobuilder/platform";
import { withMessage } from "@/lib/format";
import { clientIp } from "@/lib/session";

// Old links like /audit?url=example.com start a free audit and go to its report.
export default async function AuditRedirect({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { url } = await searchParams;
  if (!url) redirect("/");
  let id: string;
  try {
    id = await requestPublicAudit(url, await clientIp());
  } catch (e) {
    redirect(withMessage("/", "error", (e as Error).message));
  }
  redirect(`/report/${id}`);
}
