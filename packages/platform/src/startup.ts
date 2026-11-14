import { mailConfigured } from "./mail.js";
import { requesterSalt } from "./requester.js";

/**
 * Called once when the server starts. Throws on settings production can't run without, and logs
 * settings that weaken it.
 */
export function checkProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") return;
  requesterSalt(); // throws when REQUESTER_SALT is missing
  if (process.env.ALLOW_PRIVATE_NETWORKS === "1") {
    console.warn("[config] ALLOW_PRIVATE_NETWORKS=1 disables the crawler's SSRF guard. It is for tests only; unset it in production.");
  }
  if (process.env.HTTPS_PROXY || process.env.https_proxy) {
    console.warn("[config] HTTPS_PROXY is set: crawler connections go through the proxy and skip connection-time address pinning (only the pre-flight DNS check applies).");
  }
  if (!mailConfigured()) {
    console.warn("[config] RESEND_API_KEY / EMAIL_FROM are not set: signups are not email-verified and password reset emails are not sent.");
  }
}
