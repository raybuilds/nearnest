"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import type { DawnAction, DawnCardProps } from "@/types/dawn";

const toneClasses = {
  recommendation: "border-sky-400/50 bg-sky-500/8",
  risk: "border-rose-400/50 bg-rose-500/8",
  health: "border-emerald-400/50 bg-emerald-500/8",
  analytics: "border-violet-400/50 bg-violet-500/8",
  explanation: "border-white/15 bg-white/5",
};

type CardFrameProps = DawnCardProps & {
  tone: keyof typeof toneClasses;
  metrics?: Array<{ label: string; value: string | number | null | undefined }>;
  children?: ReactNode;
  onAction?: (action: DawnAction) => void;
};

function SkeletonRows() {
  return (
    <div className="space-y-3">
      <div className="h-4 w-1/2 animate-pulse rounded-full bg-white/10" />
      <div className="h-16 animate-pulse rounded-2xl bg-white/5" />
      <div className="h-10 animate-pulse rounded-2xl bg-white/5" />
    </div>
  );
}

export default function CardFrame({ card, loading, empty, tone, metrics = [], children, onAction }: CardFrameProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className={`rounded-[28px] border p-4 backdrop-blur-xl ${toneClasses[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-[family:var(--font-display)] text-xl text-white">{card.title}</h4>
          <p className="mt-2 text-sm text-slate-300">
            {loading ? "Analyzing system data..." : empty ? "No relevant data found" : card.why}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300"
        >
          {expanded ? "Hide" : "Details"}
        </button>
      </div>

      {loading ? <div className="mt-4"><SkeletonRows /></div> : null}

      {!loading && !empty && metrics.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-white/8 bg-black/10 px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{metric.label}</p>
              <p className="mt-2 text-lg font-semibold text-white">{metric.value ?? "--"}</p>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && empty ? (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-5 text-sm text-slate-300">
          No relevant data found
        </div>
      ) : null}

      {!loading && !empty && expanded ? (
        <div className="mt-4 rounded-2xl border border-white/8 bg-black/10 p-3">{children}</div>
      ) : null}

      {!loading && !empty && card.actions.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {card.actions.map((action) =>
            action.href ? (
              <Link
                key={`${card.title}-${action.label}`}
                href={action.href}
                className="rounded-full border border-white/10 px-3 py-2 text-sm text-white transition hover:border-cyan-300/50 hover:bg-cyan-400/10"
              >
                {action.label}
              </Link>
            ) : (
              <button
                key={`${card.title}-${action.label}`}
                type="button"
                onClick={() => onAction?.(action)}
                className={`rounded-full px-3 py-2 text-sm transition ${
                  action.variant === "confirm"
                    ? "bg-emerald-400/20 text-emerald-100 hover:bg-emerald-400/30"
                    : action.variant === "cancel"
                      ? "bg-white/8 text-slate-200 hover:bg-white/12"
                      : "border border-white/10 text-white hover:bg-white/10"
                }`}
              >
                {action.label}
              </button>
            )
          )}
        </div>
      ) : null}
    </article>
  );
}
