import { messageText } from "@/lib/messages";

/**
 * Shows the alert for a message code from the URL (?error=<code> / ?notice=<code>). Unknown codes
 * and free text render nothing, so links can't inject their own words (SB-16). Pages that need a
 * fixed sentence of their own pass it as errorText.
 */
export function Messages({ error, notice, errorText }: { error?: string; notice?: string; errorText?: string }) {
  const err = errorText ?? messageText(error);
  const note = err ? null : messageText(notice);
  if (!err && !note) return null;
  return (
    <div
      role={err ? "alert" : "status"}
      className={`rounded-lg border px-4 py-3 text-sm ${err ? "border-rose-200 bg-rose-50 text-rose-800" : "border-teal-200 bg-teal-50 text-teal-900"}`}
    >
      {err ?? note}
    </div>
  );
}
