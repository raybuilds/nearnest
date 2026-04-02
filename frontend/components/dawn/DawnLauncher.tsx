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
        className="fixed bottom-6 right-4 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(160,120,255,0.95),rgba(82,188,255,0.95),rgba(125,255,218,0.95))] text-2xl font-semibold text-slate-950 shadow-[0_18px_45px_rgba(82,188,255,0.35)] transition hover:scale-[1.03] sm:right-6"
        aria-label="Open Dawn"
      >
        D
      </button>
    </>
  );
}
