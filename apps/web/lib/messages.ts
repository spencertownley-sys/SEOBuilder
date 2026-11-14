import { limits, MAX_QUEUED_PUBLIC_AUDITS_PER_REQUESTER, PUBLIC_AUDITS_PER_HOUR } from "@seobuilder/platform";

// Every alert the app can show, by code. Pages get ?error=<code> or ?notice=<code> and render
// only codes listed here, so a crafted link can't put its own words in an official-looking box
// and internal error text never reaches the page (SB-16).
const MESSAGES = {
  // free audit
  audit_failed: "We could not start that audit. Check the address and try again.",
  bad_url: "That doesn't look like a website address. Check it and try again.",
  audit_hourly_limit: () => `You've run ${PUBLIC_AUDITS_PER_HOUR} free audits in the last hour. Try again later, or sign up to save sites.`,
  audits_running: () => `You already have ${MAX_QUEUED_PUBLIC_AUDITS_PER_REQUESTER} free audits running. Wait for them to finish, then try again.`,
  audits_busy: "We're running a lot of audits right now. Please try again in a few minutes.",
  rate_limited: "That's too many requests for now. Please try again in a few minutes.",

  // accounts
  login_failed: "That email and password don't match.",
  too_many_attempts: "Too many attempts. Try again in 15 minutes.",
  invalid_email: "Enter a valid email address.",
  weak_password: "Use a password of at least 8 characters.",
  long_password: "That password is too long. Use 200 characters or fewer.",
  account_exists: "An account with that email already exists. Log in instead.",
  auth_failed: "We couldn't do that with this account. Please try again.",
  check_email: "Check your email to finish signing up.",
  email_confirmed: "Email confirmed. Add your first site.",
  verify_email_first: "Confirm your email address first. The link is in your inbox, or send a new one from your sites page.",
  verification_sent: "We sent a new confirmation link. Check your inbox.",
  link_invalid: "That link is invalid or has expired. Log in to send a new one.",
  reset_link_invalid: "That link is invalid or has expired. Ask for a new one.",
  reset_sent: "If that email has an account, a reset link is on its way. It expires in 60 minutes.",
  password_changed: "Your password is changed and other devices are signed out.",
  logged_out_everywhere: "You are logged out of all devices.",
  account_deleted: "Your account and all its data are deleted.",
  confirm_email_to_delete: "Type your account email exactly to confirm.",

  // sites
  site_limit: () => `You can track up to ${limits.sitesPerWorkspace()} sites. Delete one to add another.`,
  site_exists: "You've already added that site.",
  site_deleted: "Site deleted.",
  confirm_domain: "Type the site's domain exactly to confirm.",
  saved: "Saved.",
  site_verified: "Ownership verified.",
  site_not_verified: "We couldn't find the verification tag or DNS record yet. DNS changes can take a while to appear.",
  recheck_queued: "Marked done. A re-check of the site starts in about a minute; fixed tasks move to Done automatically.",
  not_found: "We couldn't find that. It may have been deleted.",
  input_invalid: "Check what you entered and try again.",

  // competitors
  competitor_missing: "Enter a competitor name or website.",
  competitor_limit: "You can compare up to 5 competitors.",
  competitor_invalid: "We couldn't find that competitor. Refresh the page and try again.",

  // AI tracking
  prompt_length: "Prompts should be 3 to 300 characters.",
  prompt_intent: "Pick an intent.",
  prompt_limit: "A site can have up to 100 prompts.",
  prompt_invalid: "We couldn't find that prompt. Refresh the page and try again.",
  prompts_added: "Added new suggested prompts.",
  no_prompt_suggestions: "No new suggestions. Add services, locations or competitors in Settings for more.",
  ai_not_configured: "AI tracking is not configured yet, so runs can't start.",
  workspace_ai_limit: () => `Your workspace has used its ${limits.promptRunsPerWorkspacePerDay()} AI tracking runs for today. Try again tomorrow.`,
  ai_daily_limit: "AI tracking has reached its daily limit. Please try again tomorrow.",
} satisfies Record<string, string | (() => string)>;

export type MessageCode = keyof typeof MESSAGES;

export function isMessageCode(code: unknown): code is MessageCode {
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(MESSAGES, code);
}

/** The text for a known code; anything else (including free text in the URL) shows nothing. */
export function messageText(code: string | undefined): string | null {
  if (!isMessageCode(code)) return null;
  const m = MESSAGES[code];
  return typeof m === "function" ? m() : m;
}

export function withMessage(path: string, kind: "error" | "notice", code: MessageCode): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${kind}=${code}`;
}
