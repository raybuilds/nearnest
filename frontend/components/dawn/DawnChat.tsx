"use client";

import { useEffect, useMemo, useState } from "react";
import CardRenderer from "@/components/dawn/CardRenderer";
import DawnHeader from "@/components/dawn/DawnHeader";
import { routeDawnIntent } from "@/lib/intentRouter";
import { getStoredRole } from "@/lib/session";
import type { DawnAction, DawnResponse, DawnRole } from "@/types/dawn";

type DawnChatProps = {
  open: boolean;
  onClose: () => void;
};

function normalizeRole(value: string): DawnRole | null {
  if (value === "student" || value === "landlord" || value === "admin") {
    return value;
  }
  return null;
}

export default function DawnChat({ open, onClose }: DawnChatProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<DawnResponse | null>(null);
  const [notice, setNotice] = useState("");
  const [role, setRole] = useState<DawnRole | null>(null);

  useEffect(() => {
    const syncRole = () => {
      setRole(normalizeRole(getStoredRole()));
    };

    syncRole();
    window.addEventListener("nearnest:session-changed", syncRole);
    window.addEventListener("focus", syncRole);

    return () => {
      window.removeEventListener("nearnest:session-changed", syncRole);
      window.removeEventListener("focus", syncRole);
    };
  }, []);

  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "No session";

  const intentSummary = useMemo(() => response?.intents.join(", ") || "No query yet", [response]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!role) {
      setResponse({
        intents: [],
        service: "operations",
        role: "student",
        message: "Unable to retrieve data",
        cards: [
          {
            type: "analytics_card",
            title: "Session required",
            data: {},
            why: "Dawn needs an authenticated Student, Landlord, or Admin session before it can call backend intelligence APIs.",
            actions: [],
          },
        ],
      });
      return;
    }

    setLoading(true);
    setNotice("");
    const next = await routeDawnIntent(input, role);
    setResponse(next);
    setLoading(false);
  }

  function handleAction(action: DawnAction) {
    setNotice(`${action.label} is staged only. Dawn will not execute governance actions automatically.`);
  }

  return (
    <div
      className={`fixed bottom-24 right-4 z-50 w-[min(92vw,28rem)] transition duration-300 sm:right-6 ${
        open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
      }`}
    >
      <div className="overflow-hidden rounded-[32px] border border-white/12 bg-[linear-gradient(180deg,rgba(15,18,34,0.94),rgba(10,12,24,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <DawnHeader roleLabel={roleLabel} />

        <div className="border-b border-white/8 px-5 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Intent queue</p>
          <p className="mt-2 text-sm text-slate-200">{loading ? "Analyzing system data..." : intentSummary}</p>
        </div>

        <form onSubmit={handleSubmit} className="border-b border-white/8 px-5 py-4">
          <label className="block text-[11px] uppercase tracking-[0.22em] text-slate-400">Query intelligence</label>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            placeholder="Why is this unit risky and show better options"
            className="mt-3 w-full rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">Dawn routes intent, calls APIs, and explains backend outputs.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 px-3 py-2 text-sm text-slate-200"
              >
                Close
              </button>
              <button
                type="submit"
                className="rounded-full bg-[linear-gradient(135deg,rgba(160,120,255,0.95),rgba(82,188,255,0.95),rgba(125,255,218,0.95))] px-4 py-2 text-sm font-semibold text-slate-950"
              >
                Analyze
              </button>
            </div>
          </div>
        </form>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {notice ? (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {notice}
            </div>
          ) : null}
          {response ? <CardRenderer cards={response.cards} loading={loading} onAction={handleAction} /> : null}
          {!response && !loading ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
              <p className="font-[family:var(--font-display)] text-xl text-white">Role-aware intelligence</p>
              <p className="mt-2 text-sm text-slate-300">
                Ask for trust explanations, safer units, corridor risk, remediation priorities, or complaint drafting.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
