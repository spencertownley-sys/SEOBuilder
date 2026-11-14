import { mailConfigured } from "./mail.js";

/** Logs settings that weaken the production setup. Called once when the server starts. */
export function checkProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!mailConfigured()) {
    console.warn("[config] RESEND_API_KEY / EMAIL_FROM are not set: signups are not email-verified and password reset emails are not sent.");
  }
}
