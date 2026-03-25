"use client";

import { useEffect, useMemo, useState } from "react";
import { getRoleClass, getStatusTone } from "@/lib/governance";
import { getStoredRole } from "@/lib/session";
import { getDawnInsights, queryDawn } from "@/lib/api";

const suggestionPrompts = [
  "Explain why a unit is hidden",
  "Draft a complaint about water leakage",
  "Recommend safer units in my corridor",
  "Show current corridor risk insights",
];

function extractInsights(payload) {
  if (Array.isArray(payload?.insights)) return payload.insights;
  if (Array.isArray(payload?.cards)) return payload.cards;
  return [];
}

export default function DawnChat() {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "intro",
      type: "assistant",
      text: "Dawn exposes intelligence, not decisions. Ask why a unit is visible, how trust moved, or how to draft a complaint.",
      cards: [],
    },
  ]);

  useEffect(() => {
    setRole(getStoredRole());
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
      if (!token) return;

      try {
        const payload = await getDawnInsights();
        const cards = extractInsights(payload);
        if (!active || cards.length === 0) return;

        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            type: "assistant",
            text: "Fresh governance intelligence is available.",
            cards,
          },
        ]);
      } catch {
        // Keep Dawn available even if initial insight loading fails.
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const statusLabel = useMemo(() => (loading ? "Interpreting signals..." : "Intelligence available"), [loading]);

  async function handleSend(prompt = input) {
    if (!prompt.trim() || loading) return;

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), type: "user", text: prompt.trim(), cards: [] },
    ]);
    setInput("");
    setLoading(true);

    try {
      const payload = await queryDawn({ message: prompt.trim() });
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          type: "assistant",
          text: payload?.assistant || "Dawn processed the available intelligence.",
          cards: extractInsights(payload),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[70] sm:bottom-6 sm:right-6">
      {!open ? (
        <button
          className="blueprint-border relative grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-violet-300 via-sky-300 to-emerald-200 text-lg font-semibold text-slate-950 shadow-[0_28px_60px_rgba(0,0,0,0.34)]"
          onClick={() => setOpen(true)}
          type="button"
        >
          D
        </button>
      ) : (
        <section className="glass-panel-strong blueprint-border grid h-[min(76vh,640px)] w-[min(390px,calc(100vw-1.5rem))] grid-rows-[auto,1fr,auto] overflow-hidden">
          <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-300 via-sky-300 to-emerald-200 text-sm font-bold text-slate-950">
                D
              </div>
              <div>
                <p className="text-sm font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
                  Dawn Assistant
                </p>
                <p className="text-xs text-slate-400">{statusLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {role ? <span className={getRoleClass(role)}>{role}</span> : null}
              <button className="btn-ghost" onClick={() => setOpen(false)} type="button">
                Close
              </button>
            </div>
          </header>

          <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4">
            <div className="grid gap-2">
              {suggestionPrompts.map((prompt) => (
                <button
                  key={prompt}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-white/8"
                  onClick={() => handleSend(prompt)}
                  type="button"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {messages.map((message) => (
              <article
                key={message.id}
                className={`max-w-[92%] rounded-[24px] border px-4 py-3 text-sm ${
                  message.type === "user"
                    ? "ml-auto border-sky-300/20 bg-sky-300/12 text-white"
                    : "border-white/10 bg-white/5 text-slate-100"
                }`}
              >
                <p className="whitespace-pre-wrap leading-6">{message.text}</p>
                {message.cards?.length ? (
                  <div className="mt-3 grid gap-2">
                    {message.cards.map((card, index) => {
                      const title = card.title || card.type || "Insight";
                      const body = card.message || card.body || card.summary || card.description || "";
                      const recommendation = card.recommendation;
                      const riskLevel = card.riskLevel || card.severity || card.tone;
                      return (
                        <div key={`${message.id}-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className={`signal-chip ${getStatusTone(riskLevel)}`}>{title}</span>
                            {card.type ? <span className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{card.type}</span> : null}
                          </div>
                          {body ? <p className="text-xs leading-6 text-slate-300">{body}</p> : null}
                          {recommendation ? <p className="mt-2 text-xs text-emerald-200">Recommended action: {recommendation}</p> : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            ))}
          </div>

          <footer className="border-t border-white/10 px-4 py-4">
            <div className="mb-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
              Dawn can draft complaints, explain trust movements, recommend safer units, and summarize corridor risk.
            </div>
            <div className="flex items-end gap-3">
              <textarea
                className="textarea-shell min-h-[88px] flex-1"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask why a unit is visible or hidden..."
                value={input}
              />
              <button className="btn-primary h-12 px-4" disabled={loading} onClick={() => handleSend()} type="button">
                Send
              </button>
            </div>
          </footer>
        </section>
      )}
    </div>
  );
}
