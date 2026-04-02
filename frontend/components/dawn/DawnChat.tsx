"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CardRenderer from "@/components/dawn/CardRenderer";
import DawnHeader from "@/components/dawn/DawnHeader";
import { getDawnInsights, queryDawn } from "@/lib/api";
import { pushHistory, readContext, resetContext, updateContext } from "@/lib/contextStore";
import { getRiskTone, getTrustBand } from "@/lib/governance";
import { getStoredRole } from "@/lib/session";
import type { DawnAction, DawnCard, DawnResponse, DawnRole } from "@/types/dawn";

type DawnChatProps = {
  open: boolean;
  onClose: () => void;
};

type DawnSummary = NonNullable<DawnResponse["summary"]>;

const STARTER_PROMPTS: Record<DawnRole, string[]> = {
  student: [
    "Find safe rooms under ₹8000",
    "Why is my unit risky?",
    "Report an issue",
  ],
  landlord: [
    "What should I fix first?",
    "Which units are at risk?",
  ],
  admin: [
    "Which corridor is risky?",
    "Units needing attention",
  ],
};

function normalizeRole(value: string): DawnRole | null {
  if (value === "student" || value === "landlord" || value === "admin") return value;
  return null;
}

function toCards(payload: any): DawnCard[] {
  const intent = String(payload?.intent || "");

  if (intent === "student_search") {
    const recommendations = Array.isArray(payload?.data?.recommendations) ? payload.data.recommendations : [];
    return [
      {
        type: "recommendation_list",
        title: "Safe room recommendations",
        data: {
          corridorId: payload?.summary?.corridorId ?? payload?.context?.corridorId ?? null,
          total: payload?.data?.totalMatched ?? recommendations.length,
          units: recommendations,
        },
        why: payload?.assistant || payload?.message || "These results were ranked by trust, rent, and distance.",
        actions: recommendations.slice(0, 3).map((unit: any) => ({
          label: `Open Unit ${unit.id}`,
          href: `/unit/${unit.id}`,
        })),
      },
    ];
  }

  if (intent === "student_complaint") {
    const preview = payload?.data?.preview || payload?.data?.draft || {};
    const waitingForFields = Array.isArray(payload?.data?.missingFields) ? payload.data.missingFields : [];
    const actions: DawnAction[] = payload?.requiresConfirmation
      ? [
          { label: "Confirm complaint", variant: "confirm", actionType: "confirm" },
          { label: "Cancel", variant: "cancel", actionType: "cancel" },
        ]
      : [];

    return [
      {
        type: "complaint_draft",
        title: waitingForFields.length > 0 ? "Complaint details needed" : "Complaint draft",
        data: {
          unitId: preview.unitId ?? payload?.summary?.unitId ?? null,
          message: preview.message || payload?.assistant || "",
          trustImpact: waitingForFields.length > 0
            ? `Still needed: ${waitingForFields.join(", ")}`
            : payload?.requiresConfirmation
              ? "Submitting this complaint will create a governance event and may affect trust."
              : "Complaint flow complete.",
          slaPreview: preview.duration ? `Issue duration: ${preview.duration}` : "Expected response target: 24-48 hours",
          severity: preview.severity ?? null,
          incidentType: preview.incidentType ?? null,
        },
        why: payload?.assistant || "Dawn is guiding the complaint through structured confirmation.",
        actions,
      },
    ];
  }

  if (intent === "student_unit_health") {
    const report = payload?.data?.healthReport || payload?.data || {};
    return [
      {
        type: "health_report",
        title: "Unit health report",
        data: {
          trustScore: report?.trustScore ?? payload?.summary?.trustScore ?? null,
          trustBand: report?.trustBand ?? null,
          complaintsLast30Days: report?.complaintsLast30Days ?? payload?.summary?.complaintCount ?? null,
          slaBreaches30Days: report?.slaBreaches30Days ?? null,
          status: report?.trend ?? report?.status ?? "active",
          auditRequired: report?.trustBand === "risk",
          visibilityReasons: report?.riskSignals || [report?.summary || payload?.assistant].filter(Boolean),
        },
        why: report?.summary || payload?.assistant || "Dawn summarized trust and complaint pressure for your unit.",
        actions: [],
      },
    ];
  }

  if (intent === "predict_unit_risk") {
    const risk = payload?.data?.riskSignal || payload?.data?.riskForecast || payload?.data || {};
    return [
      {
        type: "risk_forecast",
        title: "Unit risk forecast",
        data: risk,
        why: payload?.assistant || "Dawn highlighted the main forecast indicators for this unit.",
        actions: [],
      },
    ];
  }

  if (intent === "explain_unit_trust") {
    const trust = payload?.data || {};
    return [
      {
        type: "explanation_card",
        title: `Trust explanation for Unit ${trust?.unitId || payload?.summary?.unitId || ""}`.trim(),
        data: {
          trustScore: trust?.trustScore ?? payload?.summary?.trustScore ?? null,
          drivers: trust?.drivers || [],
          unitId: trust?.unitId ?? payload?.summary?.unitId ?? null,
        },
        why: payload?.assistant || "Dawn summarized the strongest trust drivers for this unit.",
        actions: [],
      },
    ];
  }

  if (intent === "explain_unit_overview") {
    const trust = payload?.data?.trust || {};
    const health = payload?.data?.healthReport || {};
    const risk = payload?.data?.riskForecast || {};
    return [
      {
        type: "explanation_card",
        title: `Trust breakdown for Unit ${payload?.data?.unitId ?? payload?.summary?.unitId ?? ""}`.trim(),
        data: {
          trustScore: trust?.trustScore ?? payload?.summary?.trustScore ?? null,
          drivers: trust?.drivers || [],
          unitId: payload?.data?.unitId ?? payload?.summary?.unitId ?? null,
        },
        why: "Trust explanation",
        actions: [],
      },
      {
        type: "health_report",
        title: "Complaint and health summary",
        data: {
          trustScore: health?.trustScore ?? payload?.summary?.trustScore ?? null,
          trustBand: health?.trustBand ?? null,
          complaintsLast30Days: health?.complaintsLast30Days ?? payload?.summary?.complaintCount ?? null,
          slaBreaches30Days: health?.slaBreaches30Days ?? null,
          status: health?.trend ?? "active",
          auditRequired: health?.trustBand === "risk",
          visibilityReasons: health?.riskSignals || [health?.summary].filter(Boolean),
        },
        why: health?.summary || "Unit health summary",
        actions: [],
      },
      {
        type: "risk_forecast",
        title: "Risk forecast",
        data: risk,
        why: risk?.recommendation || payload?.assistant || "Forecasted risk signals for this unit.",
        actions: [],
      },
    ];
  }

  if (intent === "landlord_remediation_advisor") {
    return [
      {
        type: "remediation_priority",
        title: "Remediation priorities",
        data: payload?.data || {},
        why: payload?.assistant || payload?.message || "Dawn ranked the highest-value fixes first.",
        actions: [],
      },
    ];
  }

  if (intent === "corridor_behavioral_insight") {
    const data = payload?.data || {};
    return [
      {
        type: "corridor_insight",
        title: "Corridor intelligence",
        data: {
          corridorId: data?.corridorId ?? payload?.summary?.corridorId ?? null,
          complaintDensity: data?.complaintDensity ?? data?.complaintsLast30Days ?? null,
          riskLevel: data?.riskLevel ?? payload?.summary?.riskLevel ?? null,
          severeIncidents: data?.severeIncidents ?? null,
          unitsNearSuspension: data?.unitsNearSuspension ?? null,
          trend14d: data?.trend14d ?? null,
          incidentFrequency: data?.incidentFrequency ?? {},
        },
        why: payload?.assistant || payload?.message || "Dawn summarized corridor-level operating pressure.",
        actions: [],
      },
    ];
  }

  return [
    {
      type: "analytics_card",
      title: payload?.message || "Operational intelligence",
      data: Array.isArray(payload?.data) ? { units: payload.data } : payload?.data || payload || {},
      why: payload?.assistant || "Dawn analyzed the available backend signals.",
      actions: [],
    },
  ];
}

function toResponse(payload: any, role: DawnRole): DawnResponse {
  return {
    intents: [String(payload?.intent || "operations_advisor")],
    service: "operations",
    role,
    message: payload?.assistant || payload?.message || "Dawn processed the available intelligence.",
    cards: toCards(payload),
    suggestions: Array.isArray(payload?.suggestions) ? payload.suggestions : [],
    summary: payload?.summary || undefined,
  };
}

function summaryTitle(role: DawnRole | null, summary?: DawnSummary | null) {
  if (!summary) return "Live context";
  if (role === "admin") return summary.corridorId ? `Corridor ${summary.corridorId}` : "Admin watch";
  return summary.unitId ? `Unit ${summary.unitId}` : "Role context";
}

function syncLocalContext(role: DawnRole, payload: any) {
  if (payload?.intent === "context_reset") {
    resetContext(role);
    return;
  }

  const summary = payload?.summary || {};
  const context = payload?.context || {};
  updateContext(role, {
    lastIntent: payload?.intent || summary?.intent || null,
    lastUnitId: summary?.unitId ?? context?.unitId ?? null,
    lastCorridorId: summary?.corridorId ?? context?.corridorId ?? null,
  });
}

export default function DawnChat({ open, onClose }: DawnChatProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<DawnResponse | null>(null);
  const [backendPayload, setBackendPayload] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const [role, setRole] = useState<DawnRole | null>(null);
  const [insightMessage, setInsightMessage] = useState("");
  const [bootstrapped, setBootstrapped] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  useEffect(() => {
    if (!role) return;
    const stored = readContext(role);
    const lastPrompt = stored.sessionHistory[stored.sessionHistory.length - 1] || "";
    if (lastPrompt) {
      setInput((current) => current || lastPrompt);
    }
  }, [role]);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!open || !role) return;
      setBootstrapped(true);
      try {
        const payload = await getDawnInsights();
        if (!active) return;
        setInsightMessage(payload?.assistant || "");
        syncLocalContext(role, {
          intent: payload?.summary?.intent || "insights",
          summary: payload?.summary,
          context: {
            unitId: payload?.unit,
            corridorId: payload?.summary?.corridorId ?? null,
          },
        });
        if (Array.isArray(payload?.insights) && payload.insights.length > 0) {
          setBackendPayload(payload);
          setResponse((current) => current || {
            intents: ["operations_advisor"],
            service: "operations",
            role,
            message: payload?.assistant || "Proactive intelligence is available.",
            cards: [
              {
                type: "analytics_card",
                title: "Proactive alerts",
                data: { units: payload.insights, corridors: payload.insights },
                why: payload?.assistant || "Dawn found something worth reviewing right away.",
                actions: [],
              },
            ],
            suggestions: Array.isArray(payload?.suggestions) ? payload.suggestions : STARTER_PROMPTS[role],
            summary: payload?.summary || undefined,
          });
        }
      } catch {
        if (active) setInsightMessage("");
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [open, role]);

  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "No session";
  const starterPrompts = role ? STARTER_PROMPTS[role] : [];
  const summary = response?.summary || null;
  const trustBand = summary?.trustScore !== null && summary?.trustScore !== undefined ? getTrustBand(summary.trustScore) : null;
  const nextSuggestions = response?.suggestions?.length ? response.suggestions : starterPrompts;

  const intentSummary = useMemo(() => {
    if (loading) return "Analyzing system data...";
    if (response?.intents?.length) return response.intents.join(", ");
    return "Guided assistant ready";
  }, [loading, response]);

  function fillPrompt(prompt: string) {
    setInput(prompt);
    setNotice("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function handleSubmit(event?: React.FormEvent, promptOverride?: string) {
    event?.preventDefault();
    const prompt = (promptOverride ?? input).trim();
    if (!prompt || !role || loading) return;

    setLoading(true);
    setNotice("");

    try {
      const payload = await queryDawn({ message: prompt });
      pushHistory(role, prompt);
      syncLocalContext(role, payload);
      setBackendPayload(payload);
      const next = toResponse(payload, role);
      setResponse(next);
      if (promptOverride) {
        setInput(promptOverride);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to retrieve data");
    } finally {
      setLoading(false);
    }
  }

  function handleAction(action: DawnAction) {
    const label = String(action?.label || "").toLowerCase();
    if (label.includes("confirm")) {
      if (!role) return;
      setLoading(true);
      setNotice("");
      void queryDawn({
        message: input.trim() || "confirm complaint",
        confirm: true,
        action: backendPayload?.action || null,
      })
        .then((payload) => {
          pushHistory(role, input.trim() || "confirm complaint");
          syncLocalContext(role, payload);
          setBackendPayload(payload);
          setResponse(toResponse(payload, role));
        })
        .catch((error) => {
          setNotice(error instanceof Error ? error.message : "Unable to confirm complaint");
        })
        .finally(() => {
          setLoading(false);
        });
      return;
    }
    if (label.includes("cancel")) {
      setNotice("Complaint flow cancelled. You can start a new draft any time.");
      setInput("");
      return;
    }
    setNotice(`${action.label} is available as a guided next step.`);
  }

  return (
    <div
      className={`fixed bottom-24 right-4 z-50 w-[min(92vw,30rem)] transition duration-300 sm:right-6 ${
        open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
      }`}
    >
      <div className="overflow-hidden rounded-[32px] border border-white/12 bg-[linear-gradient(180deg,rgba(15,18,34,0.94),rgba(10,12,24,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <DawnHeader roleLabel={roleLabel} />

        <div className="border-b border-white/8 px-5 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Intent queue</p>
          <p className="mt-2 text-sm text-slate-200">{intentSummary}</p>
          {!bootstrapped && role ? <p className="mt-2 text-xs text-slate-400">Loading proactive insights...</p> : null}
          {insightMessage ? <p className="mt-2 text-xs text-emerald-200">{insightMessage}</p> : null}
        </div>

        {summary ? (
          <div className="border-b border-white/8 px-5 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{summaryTitle(role, summary)}</p>
              {trustBand ? <span className={`signal-chip ${trustBand.tone}`}>{trustBand.label}</span> : null}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Trust</p>
                <p className="mt-2 text-lg font-semibold text-white">{summary.trustScore ?? "--"}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Risk</p>
                <div className="mt-2">
                  <span className={`signal-chip ${getRiskTone(summary.riskLevel || "info")}`}>{summary.riskLevel || "--"}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Complaints</p>
                <p className="mt-2 text-lg font-semibold text-white">{summary.complaintCount ?? "--"}</p>
              </div>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="border-b border-white/8 px-5 py-4">
          <label className="block text-[11px] uppercase tracking-[0.22em] text-slate-400">Starter prompts</label>
          <div className="mt-3 flex flex-wrap gap-2">
            {starterPrompts.length > 0 ? (
              starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => fillPrompt(prompt)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/10"
                >
                  {prompt}
                </button>
              ))
            ) : (
              <span className="text-xs text-slate-500">Sign in to unlock guided prompts.</span>
            )}
          </div>

          <label className="mt-4 block text-[11px] uppercase tracking-[0.22em] text-slate-400">Query intelligence</label>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            placeholder={
              role
                ? "Ask Dawn to explain trust, forecast risk, guide a complaint, or recommend your next step"
                : "Sign in as Student, Landlord, or Admin to use Dawn"
            }
            className="mt-3 w-full rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">Dawn now guides the next step instead of waiting for perfect phrasing.</p>
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
                disabled={!role || loading}
                className="rounded-full bg-[linear-gradient(135deg,rgba(160,120,255,0.95),rgba(82,188,255,0.95),rgba(125,255,218,0.95))] px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Thinking..." : "Analyze"}
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

          {response ? (
            <>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                <p className="font-[family:var(--font-display)] text-xl text-white">Dawn says</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{response.message}</p>
              </div>
              <CardRenderer cards={response.cards} loading={loading} onAction={handleAction} />
            </>
          ) : !loading ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
              <p className="font-[family:var(--font-display)] text-xl text-white">Guided intelligence</p>
              <p className="mt-2 text-sm text-slate-300">
                Dawn understands your role, current context, and recent signals. Start with a prompt chip if you are not sure what to ask.
              </p>
            </div>
          ) : null}

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Suggested next steps</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {nextSuggestions.length > 0 ? (
                nextSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => fillPrompt(suggestion)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-emerald-300/40 hover:bg-emerald-300/10"
                  >
                    {suggestion}
                  </button>
                ))
              ) : (
                <span className="text-sm text-slate-500">Dawn will suggest follow-up actions after the first response.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
