"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pending, className = "", variant = "primary" }: { children: React.ReactNode; pending?: string; className?: string; variant?: "primary" | "secondary" | "danger" }) {
  const { pending: busy } = useFormStatus();
  const styles = {
    primary: "bg-ink text-white hover:bg-ink/90",
    secondary: "border border-slate-300 bg-white text-ink hover:bg-slate-50",
    danger: "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50",
  }[variant];
  return (
    <button type="submit" disabled={busy} className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${styles} ${className}`}>
      {busy ? (pending ?? "Working…") : children}
    </button>
  );
}
