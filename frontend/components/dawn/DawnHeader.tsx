"use client";

import type { ReactNode } from "react";

type DawnHeaderProps = {
  roleLabel: string;
  rightSlot?: ReactNode;
};

export default function DawnHeader({ roleLabel, rightSlot }: DawnHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
      <div>
        <p className="font-[family:var(--font-display)] text-2xl text-white">Dawn</p>
        <p className="mt-1 text-xs uppercase tracking-[0.28em] text-emerald-200">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-300" />
          Online
        </p>
      </div>
      <div className="flex items-center gap-3">
        {rightSlot}
        <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-cyan-100">
          {roleLabel}
        </span>
      </div>
    </div>
  );
}
