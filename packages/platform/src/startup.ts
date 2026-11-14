import { mailConfigured } from "./mail.js";
import { requesterSalt } from "./requester.js";

/**
 * Called once when the server starts. Throws on settings production can't run without, and logs
 * settings that weaken it.
 */
export function checkProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  requesterSalt(); // throws when REQUESTER_SALT is missing
  if (!mailConfigured()) {
    console.warn("[config] RESEND_API_KEY / EMAIL_FROM are not set: signups are not email-verified and password reset emails are not sent.");
  }
}
