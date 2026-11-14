// Transactional email (verification and password reset links). The provider is chosen by the
// owner; this sends through Resend's HTTP API when RESEND_API_KEY and EMAIL_FROM are set, with no
// extra dependency. To use another provider, replace sendWithProvider.

export interface Email {
  to: string;
  subject: string;
  text: string;
}

export type Mailer = (email: Email) => Promise<void>;

const g = globalThis as unknown as { __seobuilderMailer?: Mailer };

/** Overrides the provider (tests capture messages this way). Pass undefined to restore it. */
export function setMailer(mailer: Mailer | undefined): void {
  g.__seobuilderMailer = mailer;
}

/** True when the app can actually deliver email, which switches on email verification. */
export function mailConfigured(): boolean {
  return !!g.__seobuilderMailer || !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

async function sendWithProvider(email: Email): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email.to], subject: email.subject, text: email.text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Email provider returned HTTP ${res.status}`);
}

export async function sendEmail(email: Email): Promise<void> {
  if (g.__seobuilderMailer) return g.__seobuilderMailer(email);
  if (mailConfigured()) {
    try {
      await sendWithProvider(email);
    } catch (e) {
      // Logged, not shown: the visitor sees the same "check your email" message either way.
      console.error(`[mail] could not send "${email.subject}":`, (e as Error).message);
    }
    return;
  }
  if (process.env.NODE_ENV !== "production") console.info(`[mail] (not configured) to ${email.to}: ${email.subject}\n${email.text}`);
}

export const appUrl = () => (process.env.APP_URL ?? "https://mentionful.com").replace(/\/$/, "");
