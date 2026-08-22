"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import DawnChat from "@/components/dawn/DawnChat";

export default function DawnLauncher() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const unitMatch = pathname?.match(/^\/unit\/(\d+)(?:\/|$)/);
  const corridorMatch = pathname?.match(/^\/corridor\/(\d+)(?:\/|$)/);
  const currentUnitId = unitMatch ? Number(unitMatch[1]) : null;
  const currentCorridorId = corridorMatch ? Number(corridorMatch[1]) : null;

  return (
    <>
      <DawnChat
        open={open}
        onClose={() => setOpen(false)}
        pageContext={{
          unitId: currentUnitId,
          corridorId: currentCorridorId,
        }}
      />
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed bottom-6 right-4 z-50 overflow-hidden rounded-[26px] border border-white/10 transition hover:-translate-y-1 sm:right-6"
        style={{
          background:
            "radial-gradient(circle at top right, rgba(130,202,255,0.24), transparent 38%), linear-gradient(135deg, rgba(12,28,34,0.96), rgba(8,18,24,0.98))",
          boxShadow: "0 24px 60px rgba(3, 10, 14, 0.28)",
        }}
        aria-label="Open Dawn"
      >
        <span className="flex h-16 w-[13.25rem] items-center justify-between px-4">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-[linear-gradient(135deg,var(--accent-mint),var(--accent-cyan),#d9fff4)] text-base font-bold" style={{ color: "var(--text-inverse)" }}>
            D
          </span>
          <span className="text-left">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.28em]" style={{ color: "var(--text-soft)" }}>
              NearNest AI
            </span>
            <span className="block text-sm font-semibold" style={{ color: "var(--text-main)" }}>
              Dawn Assistant
            </span>
          </span>
        </span>
      </button>
    </>
  );
}
