import Link from "next/link";
import { Messages } from "./messages";
import { SubmitButton } from "./submit-button";

export function AuthForm({ mode, action, error, notice, next }: { mode: "login" | "signup"; action: (f: FormData) => Promise<void>; error?: string; notice?: string; next?: string }) {
  const signup = mode === "signup";
  return (
    <div className="mx-auto max-w-sm space-y-6">
      <h1 className="text-2xl font-bold">{signup ? "Create your free account" : "Log in"}</h1>
      <Messages error={error} notice={notice} />
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/app"} />
        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" required autoComplete="email" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={signup ? 8 : undefined}
            autoComplete={signup ? "new-password" : "current-password"}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
          {signup && <span className="text-xs text-slate-500">At least 8 characters.</span>}
          {!signup && (
            <Link href="/forgot" className="block text-xs font-medium text-accent">
              Forgot your password?
            </Link>
          )}
        </label>
        <SubmitButton className="w-full py-2.5" pending={signup ? "Creating account…" : "Logging in…"}>
          {signup ? "Create account" : "Log in"}
        </SubmitButton>
        {signup && (
          <p className="text-xs text-slate-500">
            By creating an account you agree to the{" "}
            <Link href="/terms" className="font-medium text-accent underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-medium text-accent underline">
              Privacy Policy
            </Link>
            .
          </p>
        )}
      </form>
      <p className="text-sm text-slate-600">
        {signup ? (
          <>Already have an account? <Link href="/login" className="font-medium text-accent">Log in</Link></>
        ) : (
          <>New here? <Link href="/signup" className="font-medium text-accent">Create a free account</Link></>
        )}
      </p>
    </div>
  );
}
