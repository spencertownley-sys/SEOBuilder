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
  deleteAccount,
  deletePrompt,
  deleteSite,
  destroyAllSessions,
  destroySession,
  enqueue,
  InputError,
  logIn,
  NotFoundError,
  one,
  RateLimitError,
  removeCompetitor,
  requestPasswordReset,
  requestPromptRun,
  requestPublicAudit,
  requireSite,
  resendVerification,
  resetPassword,
  setPromptActive,
  setTaskStatus,
  startSignUp,
  suggestMorePrompts,
  updateSiteProfile,
  verifyEmail,
  verifySite,
} from "@seobuilder/platform";
import type { TaskStatus } from "@seobuilder/core";
import { isMessageCode, withMessage, type MessageCode } from "@/lib/messages";
import { clientIp, requireUser, SESSION_COOKIE, setSessionCookie } from "@/lib/session";

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

/**
 * Errors users can act on become a message code on the page (the page shows its own text for the
 * code, never the error's); anything else is a real failure and is thrown (and logged by Next).
 */
function userMessage(e: unknown, fallback: MessageCode): MessageCode | null {
  if (e instanceof AuthError || e instanceof InputError || e instanceof RateLimitError || e instanceof NotFoundError) {
    if (isMessageCode(e.code)) return e.code;
    console.warn(`[actions] no message for error code ${e.code}: ${e.message}`);
    return fallback;
  }
  return null;
}

async function attempt(fn: () => Promise<void>, onErrorPath: string, fallback: MessageCode = "input_invalid"): Promise<void> {
  let code: MessageCode | null = null;
  try {
    await fn();
  } catch (e) {
    code = userMessage(e, fallback);
    if (code === null) throw e;
  }
  if (code !== null) redirect(withMessage(onErrorPath, "error", code));
}

// ---------- public audit ----------

export async function startAudit(formData: FormData): Promise<void> {
  let id = "";
  await attempt(async () => {
    id = await requestPublicAudit(str(formData, "url"), await clientIp());
  }, "/", "audit_failed");
  redirect(`/report/${id}`);
}

// ---------- accounts ----------

function safeNext(next: string): string {
  return next.startsWith("/app") ? next : "/app";
}

export async function signUpAction(formData: FormData): Promise<void> {
  let signedIn = false;
  await attempt(async () => {
    const { user } = await startSignUp(str(formData, "email"), str(formData, "password"), await clientIp());
    if (user) {
      await setSessionCookie(await createSession(user.id));
      signedIn = true;
    }
  }, "/signup");
  // With email verification on, new and existing addresses get the same answer (SB-06).
  if (!signedIn) redirect(withMessage("/signup", "notice", "check_email"));
  redirect(safeNext(str(formData, "next")));
}

export async function verifyEmailAction(formData: FormData): Promise<void> {
  await attempt(async () => {
    const user = await verifyEmail(str(formData, "token"));
    await setSessionCookie(await createSession(user.id));
  }, "/login");
  redirect(withMessage("/app/new", "notice", "email_confirmed"));
}

export async function resendVerificationAction(): Promise<void> {
  const user = await requireUser();
  await attempt(() => resendVerification(user.id), "/app");
  redirect(withMessage("/app", "notice", "verification_sent"));
}

export async function forgotPasswordAction(formData: FormData): Promise<void> {
  const ip = await clientIp();
  await attempt(() => requestPasswordReset(str(formData, "email"), ip), "/forgot");
  redirect(withMessage("/forgot", "notice", "reset_sent"));
}

export async function resetPasswordAction(formData: FormData): Promise<void> {
  const token = str(formData, "token");
  await attempt(async () => {
    const user = await resetPassword(token, str(formData, "password"));
    await setSessionCookie(await createSession(user.id));
  }, `/reset?token=${encodeURIComponent(token)}`);
  redirect(withMessage("/app", "notice", "password_changed"));
}

export async function logInAction(formData: FormData): Promise<void> {
  await attempt(async () => {
    const user = await logIn(str(formData, "email"), str(formData, "password"), await clientIp());
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

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  if (str(formData, "confirm").trim().toLowerCase() !== user.email) redirect(withMessage("/app/account", "error", "confirm_email_to_delete"));
  await deleteAccount(user.id);
  (await cookies()).delete(SESSION_COOKIE);
  redirect(withMessage("/", "notice", "account_deleted"));
}

export async function logOutEverywhereAction(): Promise<void> {
  const user = await requireUser();
  await destroyAllSessions(user.id);
  (await cookies()).delete(SESSION_COOKIE);
  redirect(withMessage("/login", "notice", "logged_out_everywhere"));
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
  if (recheckQueued) redirect(withMessage(returnTo, "notice", "recheck_queued"));
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
  redirect(withMessage(`/app/sites/${siteId}/settings`, "notice", "saved"));
}

export async function verifySiteAction(siteId: string): Promise<void> {
  const user = await requireUser();
  const r = await verifySite(user.id, siteId);
  redirect(withMessage(`/app/sites/${siteId}/settings`, r.verified ? "notice" : "error", r.verified ? "site_verified" : "site_not_verified"));
}

export async function deleteSiteAction(siteId: string, formData: FormData): Promise<void> {
  const user = await requireUser();
  const site = await requireSite(user.id, siteId);
  if (str(formData, "confirm").trim().toLowerCase() !== site.domain) {
    redirect(withMessage(`/app/sites/${siteId}/settings`, "error", "confirm_domain"));
  }
  await deleteSite(user.id, siteId);
  redirect(withMessage("/app", "notice", "site_deleted"));
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
  redirect(withMessage(`/app/sites/${siteId}/ai`, "notice", n ? "prompts_added" : "no_prompt_suggestions"));
}

export async function runPromptsAction(siteId: string): Promise<void> {
  const user = await requireUser();
  let id: string | null = "";
  await attempt(async () => {
    id = await requestPromptRun(user.id, siteId);
  }, `/app/sites/${siteId}/ai`);
  if (!id) redirect(withMessage(`/app/sites/${siteId}/ai`, "error", "ai_not_configured"));
  revalidatePath(`/app/sites/${siteId}/ai`);
}
