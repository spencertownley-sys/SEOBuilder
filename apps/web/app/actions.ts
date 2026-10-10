"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addCompetitor,
  addPrompt,
  AuthError,
  createSession,
  createSite,
  deletePrompt,
  deleteSite,
  destroySession,
  enqueue,
  InputError,
  logIn,
  NotFoundError,
  one,
  RateLimitError,
  removeCompetitor,
  requestPromptRun,
  requestPublicAudit,
  requireSite,
  setPromptActive,
  setTaskStatus,
  signUp,
  suggestMorePrompts,
  updateSiteProfile,
  verifySite,
} from "@seobuilder/platform";
import type { TaskStatus } from "@seobuilder/core";
import { withMessage } from "@/lib/format";
import { clientIp, requireUser, SESSION_COOKIE, setSessionCookie } from "@/lib/session";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Errors users can act on become a message on the page; anything else is a real failure. */
function userMessage(e: unknown): string | null {
  if (e instanceof AuthError || e instanceof InputError || e instanceof RateLimitError || e instanceof NotFoundError) return e.message;
  return null;
}

async function attempt(fn: () => Promise<void>, onErrorPath: string): Promise<void> {
  let msg: string | null = null;
  try {
    await fn();
  } catch (e) {
    msg = userMessage(e);
    if (msg === null) throw e;
  }
  if (msg !== null) redirect(withMessage(onErrorPath, "error", msg));
}

// ---------- public audit ----------

export async function startAudit(formData: FormData): Promise<void> {
  let id = "";
  await attempt(async () => {
    id = await requestPublicAudit(str(formData, "url"), await clientIp());
  }, "/");
  redirect(`/report/${id}`);
}

// ---------- accounts ----------

function safeNext(next: string): string {
  return next.startsWith("/app") ? next : "/app";
}

export async function signUpAction(formData: FormData): Promise<void> {
  await attempt(async () => {
    const user = await signUp(str(formData, "email"), str(formData, "password"));
    await setSessionCookie(await createSession(user.id));
  }, "/signup");
  redirect(safeNext(str(formData, "next")));
}

export async function logInAction(formData: FormData): Promise<void> {
  await attempt(async () => {
    const user = await logIn(str(formData, "email"), str(formData, "password"));
    await setSessionCookie(await createSession(user.id));
  }, "/login");
  redirect(safeNext(str(formData, "next")));
}

export async function logOutAction(): Promise<void> {
  const jar = await cookies();
  await destroySession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  redirect("/");
}

// ---------- sites ----------

export async function createSiteAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  let id = "";
  await attempt(async () => {
    id = await createSite(user.id, {
      url: str(formData, "url"),
      name: str(formData, "name"),
      kind: str(formData, "kind"),
      businessType: str(formData, "businessType"),
      services: str(formData, "services"),
      locations: str(formData, "locations"),
      competitors: str(formData, "competitors"),
    });
  }, "/app/new");
  redirect(`/app/sites/${id}`);
}

export async function recrawlAction(siteId: string): Promise<void> {
  const user = await requireUser();
  const site = await requireSite(user.id, siteId);
  const pending = await one("select 1 from jobs where kind = 'site_crawl' and status in ('queued','running') and payload->>'siteId' = $1", [site.id]);
  if (!pending) await enqueue("site_crawl", { siteId: site.id, reason: "manual" });
  revalidatePath(`/app/sites/${site.id}`);
}

export async function setTaskStatusAction(siteId: string, returnTo: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const { recheckQueued } = await setTaskStatus(user.id, siteId, str(formData, "taskId"), str(formData, "status") as TaskStatus);
  revalidatePath(`/app/sites/${siteId}`, "layout");
  if (recheckQueued) redirect(withMessage(returnTo, "notice", "Marked done. A re-check of the site starts in about a minute; fixed tasks move to Done automatically."));
}

export async function updateProfileAction(siteId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  await updateSiteProfile(user.id, siteId, {
    name: str(formData, "name"),
    kind: str(formData, "kind"),
    businessType: str(formData, "businessType"),
    services: str(formData, "services"),
    locations: str(formData, "locations"),
    aliases: str(formData, "aliases"),
    facts: str(formData, "facts"),
  });
  redirect(withMessage(`/app/sites/${siteId}/settings`, "notice", "Saved."));
}

export async function verifySiteAction(siteId: string): Promise<void> {
  const user = await requireUser();
  const r = await verifySite(user.id, siteId);
  redirect(
    withMessage(
      `/app/sites/${siteId}/settings`,
      r.verified ? "notice" : "error",
      r.verified ? "Ownership verified." : "We couldn't find the verification tag or DNS record yet. DNS changes can take a while to appear.",
    ),
  );
}

export async function deleteSiteAction(siteId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const site = await requireSite(user.id, siteId);
  if (str(formData, "confirm").trim().toLowerCase() !== site.domain) {
    redirect(withMessage(`/app/sites/${siteId}/settings`, "error", `Type ${site.domain} to confirm.`));
  }
  await deleteSite(user.id, siteId);
  redirect(withMessage("/app", "notice", `Deleted ${site.domain}.`));
}

// ---------- competitors ----------

export async function addCompetitorAction(siteId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  await attempt(() => addCompetitor(user.id, siteId, str(formData, "competitor")), `/app/sites/${siteId}/competitors`);
  revalidatePath(`/app/sites/${siteId}/competitors`);
}

export async function removeCompetitorAction(siteId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  await removeCompetitor(user.id, siteId, str(formData, "competitorId"));
  revalidatePath(`/app/sites/${siteId}/competitors`);
}

// ---------- AI visibility ----------

export async function addPromptAction(siteId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  await attempt(() => addPrompt(user.id, siteId, str(formData, "text"), str(formData, "intent")), `/app/sites/${siteId}/ai`);
  revalidatePath(`/app/sites/${siteId}/ai`);
}

export async function togglePromptAction(siteId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  await setPromptActive(user.id, siteId, str(formData, "promptId"), str(formData, "active") === "1");
  revalidatePath(`/app/sites/${siteId}/ai`);
}

export async function deletePromptAction(siteId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  await deletePrompt(user.id, siteId, str(formData, "promptId"));
  revalidatePath(`/app/sites/${siteId}/ai`);
}

export async function suggestPromptsAction(siteId: string): Promise<void> {
  const user = await requireUser();
  const n = await suggestMorePrompts(user.id, siteId);
  redirect(withMessage(`/app/sites/${siteId}/ai`, "notice", n ? `Added ${n} suggested prompts.` : "No new suggestions. Add services, locations or competitors in Settings for more."));
}

export async function runPromptsAction(siteId: string): Promise<void> {
  const user = await requireUser();
  const id = await requestPromptRun(user.id, siteId);
  if (!id) redirect(withMessage(`/app/sites/${siteId}/ai`, "error", "No AI engines are connected yet. Add an API key (see below), then run again."));
  revalidatePath(`/app/sites/${siteId}/ai`);
}
