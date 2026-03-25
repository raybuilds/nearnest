"use client";

import { useState } from "react";
import DawnChat from "@/components/dawn/DawnChat";

export default function DawnLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <DawnChat open={open} onClose={() => setOpen(false)} />
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
