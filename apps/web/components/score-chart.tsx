"use client";

import { useMemo, useRef, useState } from "react";

// Reference palette (dataviz skill), categorical slots 1–3 in fixed order; validated all-pairs.
const SERIES = [
  { key: "technical", label: "Technical Health", color: "#2a78d6" },
  { key: "ai", label: "AI Visibility", color: "#eb6834" },
  { key: "search", label: "Search Visibility", color: "#1baf7a" },
] as const;

export interface ScorePoint {
  t: string; // ISO date
  technical: number | null;
  ai: number | null;
  search: number | null;
}

const W = 640;
const H = 220;
const PAD = { l: 32, r: 112, t: 12, b: 26 };

export function ScoreChart({ points }: { points: ScorePoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const series = SERIES.filter((s) => points.some((p) => p[s.key] !== null));

  const geom = useMemo(() => {
    const ts = points.map((p) => new Date(p.t).getTime());
    const min = Math.min(...ts);
    const max = Math.max(...ts);
    const x = (t: number) => (max === min ? PAD.l + (W - PAD.l - PAD.r) / 2 : PAD.l + ((t - min) / (max - min)) * (W - PAD.l - PAD.r));
    const y = (v: number) => PAD.t + (1 - v / 100) * (H - PAD.t - PAD.b);
    return { ts, x, y };
  }, [points]);

  if (points.length === 0) return <p className="text-sm text-slate-500">Scores appear here after the first crawl.</p>;

  const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const last = points.length - 1;

  // Direct labels at the line ends, nudged apart so they never collide.
  const ends = series
    .map((s) => ({ s, v: points[last]![s.key] as number | null }))
    .filter((e): e is { s: (typeof series)[number]; v: number } => e.v !== null)
    .map((e) => ({ ...e, y: geom.y(e.v) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i]!.y - ends[i - 1]!.y < 14) ends[i]!.y = ends[i - 1]!.y + 14;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    geom.ts.forEach((t, i) => {
      if (Math.abs(geom.x(t) - px) < Math.abs(geom.x(geom.ts[best]!) - px)) best = i;
    });
    setHover(best);
  }

  const hp = hover !== null ? points[hover] : null;
  const hx = hover !== null ? geom.x(geom.ts[hover]!) : 0;

  return (
    <figure className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-slate-600" aria-hidden>
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <svg width="16" height="4">
              <line x1="0" y1="2" x2="16" y2="2" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none"
          role="img"
          aria-label={`Score history, ${points.length} checks`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          tabIndex={0}
          onFocus={() => setHover(last)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? last) - 1));
            if (e.key === "ArrowRight") setHover((h) => Math.min(last, (h ?? last) + 1));
          }}
        >
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={geom.y(v)} y2={geom.y(v)} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PAD.l - 6} y={geom.y(v) + 4} textAnchor="end" fontSize="11" fill="#64748b">
                {v}
              </text>
            </g>
          ))}
          <text x={PAD.l} y={H - 6} fontSize="11" fill="#64748b">
            {fmt(geom.ts[0]!)}
          </text>
          {points.length > 1 && (
            <text x={W - PAD.r} y={H - 6} fontSize="11" fill="#64748b" textAnchor="end">
              {fmt(geom.ts[last]!)}
            </text>
          )}
          {series.map((s) => {
            const pts = points.map((p, i) => (p[s.key] === null ? null : `${geom.x(geom.ts[i]!)},${geom.y(p[s.key] as number)}`)).filter(Boolean);
            return (
              <g key={s.key}>
                {pts.length > 1 && <polyline points={pts.join(" ")} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
                {pts.length === 1 && <circle cx={pts[0]!.split(",")[0]} cy={pts[0]!.split(",")[1]} r="4" fill={s.color} stroke="#fff" strokeWidth="2" />}
              </g>
            );
          })}
          {ends.map((e) => (
            <text key={e.s.key} x={W - PAD.r + 8} y={e.y + 4} fontSize="11" fill="#334155">
              <tspan fontWeight="600">{e.v}</tspan> {e.s.label.split(" ")[0]}
            </text>
          ))}
          {hp && (
            <g>
              <line x1={hx} x2={hx} y1={PAD.t} y2={H - PAD.b} stroke="#94a3b8" strokeWidth="1" />
              {series.map((s) =>
                hp[s.key] === null ? null : <circle key={s.key} cx={hx} cy={geom.y(hp[s.key] as number)} r="4.5" fill={s.color} stroke="#fff" strokeWidth="2" />,
              )}
            </g>
          )}
        </svg>
        {hp && (
          <div
            className="pointer-events-none absolute top-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-md"
            style={{ left: `${(hx / W) * 100}%`, transform: hx > W / 2 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
          >
            <p className="mb-1 text-slate-500">{new Date(hp.t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-2">
                <svg width="12" height="4" aria-hidden>
                  <line x1="0" y1="2" x2="12" y2="2" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
                </svg>
                <span className="font-semibold text-ink">{hp[s.key] ?? "—"}</span>
                <span className="text-slate-500">{s.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      <details className="text-xs">
        <summary className="cursor-pointer text-slate-500">Show as table</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 font-medium">Checked</th>
              {series.map((s) => (
                <th key={s.key} className="py-1 font-medium">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.t} className="border-t border-slate-100">
                <td className="py-1">{new Date(p.t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                {series.map((s) => (
                  <td key={s.key} className="py-1">
                    {p[s.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
