export function timeAgo(d: Date | string | null | undefined): string {
  if (!d) return "never";
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 0) return `in ${timeUntilText(-s)}`;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function timeUntilText(s: number): string {
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} d`;
}

export const pct = (x: number | undefined | null) => (x === undefined || x === null ? "—" : `${Math.round(x * 100)}%`);

export function withMessage(path: string, kind: "error" | "notice", msg: string): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${kind}=${encodeURIComponent(msg)}`;
}
