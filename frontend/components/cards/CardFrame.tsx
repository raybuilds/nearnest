"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import type { DawnAction, DawnCardProps } from "@/types/dawn";

const toneClasses = {
  recommendation: "border border-emerald-400/20 shadow-md shadow-black/20",
  risk: "border border-rose-400/22 shadow-md shadow-black/20",
  health: "border border-amber-300/20 shadow-md shadow-black/20",
  analytics: "border shadow-md shadow-black/20",
  explanation: "border border-sky-300/18 shadow-md shadow-black/20",
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
      <div className="h-4 w-1/2 animate-pulse rounded-full" style={{ background: "var(--bg-soft-strong)" }} />
      <div className="h-16 animate-pulse rounded-2xl" style={{ background: "var(--bg-soft)" }} />
      <div className="h-10 animate-pulse rounded-2xl" style={{ background: "var(--bg-soft)" }} />
    </div>
  );
}

export default function CardFrame({ card, loading, empty, tone, metrics = [], children, onAction }: CardFrameProps) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = children || metrics.length > 2 || card.actions.length > 0;

  return (
    <article className={`mb-4 rounded-2xl p-5 backdrop-blur-sm ${toneClasses[tone]}`} style={{ background: "var(--bg-soft)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="max-w-[85%]">
          <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Assistant card</p>
          <h4 className="mt-2 font-[family:var(--font-display)] text-xl" style={{ color: "var(--text-main)" }}>{card.title}</h4>
          <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
            {loading ? "Analyzing system data..." : empty ? "No relevant data found" : card.why}
          </p>
        </div>
        {shouldCollapse ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.22em]"
            style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
          >
            {expanded ? "Hide details" : "View details"}
          </button>
        ) : null}
      </div>

      {loading ? <div className="mt-4"><SkeletonRows /></div> : null}

      {!loading && !empty && metrics.length > 0 ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl px-4 py-3" style={{ background: "var(--bg-soft-strong)" }}>
              <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>{metric.label}</p>
              <p className="mt-2 text-lg font-semibold" style={{ color: "var(--text-main)" }}>{metric.value ?? "--"}</p>
            </div>
          ))}
        </div>
      ) : null}

      {!loading && empty ? (
        <div className="mt-5 rounded-xl px-4 py-5 text-sm" style={{ background: "var(--bg-soft-strong)", color: "var(--text-muted)" }}>
          No relevant data found
        </div>
      ) : null}

      {!loading && !empty && expanded && children ? (
        <div className="mt-5 rounded-xl p-4" style={{ background: "var(--bg-soft-strong)" }}>{children}</div>
      ) : null}

      {!loading && !empty && card.actions.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {card.actions.map((action) =>
            action.href ? (
              <Link
                key={`${card.title}-${action.label}`}
                href={action.href}
                className="rounded-full border px-3 py-2 text-sm transition"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg-soft-strong)",
                  color: "var(--text-main)",
                }}
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
                    ? "bg-emerald-400/20 text-emerald-50 hover:bg-emerald-400/30"
                    : action.variant === "cancel"
                      ? "hover:opacity-90"
                      : "border hover:opacity-90"
                }`}
                style={
                  action.variant === "cancel"
                    ? {
                        background: "var(--bg-soft-strong)",
                        color: "var(--text-main)",
                      }
                    : action.variant === "confirm"
                      ? undefined
                      : {
                          borderColor: "var(--border)",
                          background: "var(--bg-soft-strong)",
                          color: "var(--text-main)",
                        }
                }
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
