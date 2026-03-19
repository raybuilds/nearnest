"use client";

import { useEffect, useMemo, useState } from "react";
import { getDawnInsights, queryDawn } from "@/lib/api";

function normalizeInsightCard(card) {
  return {
    title: card.title || "Insight",
    body: card.body || "",
    recommendation: card.recommendation || null,
    severity: card.severity || (card.tone === "alert" ? "critical" : card.tone === "neutral" ? "warn" : "info"),
  };
}

function cardToneStyles(type) {
  if (type === "critical") {
    return {
      borderLeft: "3px solid var(--color-error)",
      background: "rgba(239, 68, 68, 0.08)",
      borderColor: "rgba(239, 68, 68, 0.2)",
    };
  }

  if (type === "warn") {
    return {
      borderLeft: "3px solid var(--color-warn)",
      background: "rgba(245, 158, 11, 0.08)",
      borderColor: "rgba(245, 158, 11, 0.2)",
    };
  }

  return {
    borderLeft: "3px solid var(--accent-primary)",
    background: "rgba(108, 142, 245, 0.08)",
    borderColor: "rgba(108, 142, 245, 0.2)",
  };
}

function extractCardsFromPayload(payload) {
  if (Array.isArray(payload?.cards) && payload.cards.length > 0) {
    return payload.cards;
  }

  const derivedCards = [];

  if (Array.isArray(payload?.recommendations) && payload.recommendations.length > 0) {
    derivedCards.push({
      type: "recommendation_list",
      recommendations: payload.recommendations,
    });
  }

  if (payload?.risk_forecast && Array.isArray(payload.risk_forecast.blocks)) {
    derivedCards.push({
      type: "risk_forecast_card",
      blocks: payload.risk_forecast.blocks,
    });
  }

  if (payload?.analytics) {
    derivedCards.push({
      type: "corridor_insight",
      location: payload.analytics.title || "Analytics",
      description: payload.analytics.summary || payload.analytics.description || "Structured analytics available.",
    });
  }

  if (payload?.complaint_draft) {
    derivedCards.push({
      type: "complaint_draft",
      ...payload.complaint_draft,
    });
  }

  if (payload?.visibilityReasons || payload?.trustScore || payload?.trustBand) {
    derivedCards.push({
      type: "insight_card",
      title: "Trust Explanation",
      body:
        payload?.visibilityReasons?.length > 0
          ? payload.visibilityReasons.join(", ")
          : `Trust score ${payload?.trustScore ?? "unknown"} in ${payload?.trustBand || "standard"} band.`,
      recommendation: payload?.auditRequired ? "Audit remains required before visibility can improve." : null,
      severity: payload?.trustBand === "hidden" ? "critical" : payload?.trustBand === "standard" ? "warn" : "info",
    });
  }

  return derivedCards;
}

function renderStructuredBlocks(message, onUseDraft) {
  const cards = Array.isArray(message.cards) ? message.cards : [];

  return cards.map((card, index) => {
    if (card.type === "complaint_draft") {
      return (
        <div
          key={`${message.id}-draft-${index}`}
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            border: "1px dashed var(--border-mid)",
            background: "var(--bg-surface)",
            fontSize: 11,
            color: "var(--text-muted)",
          }}
        >
          <div className="label-caps" style={{ marginBottom: 8 }}>
            Complaint Draft
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <span>Unit: {card.unitId || "Unknown"}</span>
            <span>Category: {card.category || "General"}</span>
            <span>Priority: {card.priority || "Standard"}</span>
          </div>
          <p style={{ margin: "10px 0 0", whiteSpace: "pre-wrap" }}>{card.description || message.text}</p>
          <button className="btn-soft mint" onClick={() => onUseDraft(card.description || "")} style={{ marginTop: 10 }} type="button">
            Use this draft
          </button>
        </div>
      );
    }

    if (card.type === "complaint_result") {
      return (
        <div
          key={`${message.id}-result-${index}`}
          className={`status-banner ${card.success ? "success" : "error"}`}
          style={{ marginTop: 10 }}
        >
          <span>{card.message || "Complaint update received."}</span>
          {card.complaintId ? <span className="chip ch-blue">ID {card.complaintId}</span> : null}
        </div>
      );
    }

    if (card.type === "recommendation_list" || card.type === "remediation_priority") {
      const items = card.recommendations || card.items || [];
      return (
        <div
          key={`${message.id}-recommendation-${index}`}
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(52, 217, 181, 0.22)",
            background: "rgba(52, 217, 181, 0.05)",
          }}
        >
          <div className="label-caps" style={{ color: "var(--accent-mint)", marginBottom: 8 }}>
            Recommendations
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {items.map((item, itemIndex) => {
              const label = typeof item === "string" ? item : item.label;
              const urgency = typeof item === "string" ? null : item.urgency;
              return (
                <div
                  key={`${message.id}-recommendation-row-${itemIndex}`}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 11 }}
                >
                  <span>{`${itemIndex + 1}. ${label}`}</span>
                  {urgency ? <span className="chip ch-gold">{urgency}</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (card.type === "risk_forecast_card") {
      const rows = Array.isArray(card.blocks) ? card.blocks : [];
      return (
        <div
          key={`${message.id}-risk-${index}`}
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(239, 68, 68, 0.22)",
            background: "rgba(239, 68, 68, 0.05)",
          }}
        >
          <div className="label-caps" style={{ color: "var(--color-error)", marginBottom: 8 }}>
            Risk Forecast
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {rows.map((row) => (
              <div key={`${message.id}-${row.block}`} style={{ display: "grid", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span>{row.block}</span>
                  <span className={`chip ${row.risk >= 70 ? "ch-err" : row.risk >= 40 ? "ch-warn" : "ch-ok"}`}>{row.risk}%</span>
                </div>
                <div className="trust-bar-track">
                  <div className={`trust-bar-fill ${row.risk >= 70 ? "hidden" : row.risk >= 40 ? "standard" : "priority"}`} style={{ width: `${row.risk}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (card.type === "corridor_insight") {
      return (
        <div
          key={`${message.id}-corridor-${index}`}
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(108, 142, 245, 0.22)",
            background: "rgba(108, 142, 245, 0.05)",
          }}
        >
          <div className="label-caps" style={{ marginBottom: 8 }}>
            {card.location || "Corridor Insight"}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>{card.description || card.body}</p>
        </div>
      );
    }

    const insight = normalizeInsightCard(card);
    const toneStyles = cardToneStyles(insight.severity === "critical" ? "critical" : insight.severity === "warn" ? "warn" : "info");
    return (
      <div
        key={`${message.id}-insight-${index}`}
        style={{
          marginTop: 10,
          padding: 12,
          borderRadius: 12,
          border: "1px solid",
          ...toneStyles,
        }}
      >
        <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600 }}>{insight.title}</p>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{insight.body}</p>
        {insight.recommendation ? (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--text-main)" }}>Recommendation: {insight.recommendation}</p>
        ) : null}
      </div>
    );
  });
}

export default function DawnChat() {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("");
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      type: "ai",
      text: "Dawn is online. Ask about risk, health, remediation, corridor performance, or complaint drafting.",
      cards: [],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [insightsLoaded, setInsightsLoaded] = useState(false);

  const statusText = useMemo(() => (loading ? "Thinking..." : "Online"), [loading]);

  useEffect(() => {
    setRole(localStorage.getItem("role") || "");
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInsights() {
      const token = localStorage.getItem("token");
      if (!token) {
        setInsightsLoaded(true);
        return;
      }

      try {
        const payload = await getDawnInsights();
        const cards = Array.isArray(payload?.insights)
          ? payload.insights.map((insight) => ({
              type: "insight_card",
              title: insight.title || insight.type || "Insight",
              body: insight.message || insight.body || "",
              recommendation: insight.recommendation,
              severity: insight.riskLevel === "HIGH" ? "critical" : insight.riskLevel === "MEDIUM" ? "warn" : "info",
            }))
          : [];

        if (!active || cards.length === 0) {
          if (active) setInsightsLoaded(true);
          return;
        }

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            type: "ai",
            text: "Dawn has fresh operational insights for you.",
            cards,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } catch {
        // Ignore insight bootstrap failures and keep chat usable.
      } finally {
        if (active) setInsightsLoaded(true);
      }
    }

    loadInsights();
    return () => {
      active = false;
    };
  }, []);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage = {
      id: crypto.randomUUID(),
      type: "user",
      text: input,
      cards: [],
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const payload = await queryDawn({ message: input });
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "ai",
          text: payload?.assistant || "Dawn responded.",
          cards: extractCardsFromPayload(payload),
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setInput("");
    } finally {
      setLoading(false);
    }
  }

  function useDraft(description) {
    setInput(description);
  }

  return (
    <div>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          type="button"
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            zIndex: 100,
            width: 50,
            height: 50,
            border: 0,
            borderRadius: 999,
            color: "#fff",
            fontFamily: "var(--font-display)",
            fontSize: 18,
            background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
            boxShadow: "0 0 0 0 rgba(108, 142, 245, 0.2), 0 20px 40px rgba(0, 0, 0, 0.28)",
          }}
        >
          D
          {insightsLoaded && messages.length > 1 ? (
            <span
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "var(--color-error)",
              }}
            />
          ) : null}
        </button>
      )}

      {open && (
        <section
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 100,
            width: "min(360px, calc(100vw - 32px))",
            maxHeight: 520,
            display: "grid",
            gridTemplateRows: "56px 1fr auto",
            background: "var(--bg-panel)",
            border: "1px solid var(--border-mid)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
            overflow: "hidden",
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "0 14px",
              borderBottom: "1px solid var(--border-base)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  fontFamily: "var(--font-display)",
                  fontSize: 14,
                  background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
                }}
              >
                D
              </div>
              <div>
                <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 14 }}>Dawn</p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--color-success)" }}>
                  {"* "}
                  {statusText}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {role ? (
                <span className={`role-pill ${role === "student" ? "rp-student" : role === "landlord" ? "rp-landlord" : "rp-admin"}`}>
                  {role}
                </span>
              ) : null}
              <button
                onClick={() => setOpen(false)}
                type="button"
                style={{ border: 0, background: "transparent", color: "var(--text-subtle)", fontSize: 14 }}
              >
                x
              </button>
            </div>
          </header>

          <div
            style={{
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 14,
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                style={{
                  alignSelf: message.type === "user" ? "flex-end" : "stretch",
                  maxWidth: message.type === "user" ? "88%" : "100%",
                }}
              >
                <div
                  style={{
                    padding: "10px 13px",
                    borderRadius: message.type === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px",
                    border: message.type === "user" ? "1px solid var(--border-base)" : "1px solid rgba(108, 142, 245, 0.15)",
                    background: message.type === "user" ? "rgba(255, 255, 255, 0.05)" : "rgba(108, 142, 245, 0.1)",
                    fontSize: 12,
                    color: "var(--text-main)",
                  }}
                >
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message.text}</p>
                  {renderStructuredBlocks(message, useDraft)}
                </div>
                <div style={{ marginTop: 3, fontSize: 10, color: "var(--text-subtle)" }}>{message.timestamp || ""}</div>
              </div>
            ))}
          </div>

          <footer
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
              padding: "10px 14px",
              borderTop: "1px solid var(--border-base)",
            }}
          >
            <textarea
              className="app-input"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask Dawn about trust, complaints, or operations..."
              rows={Math.min(3, Math.max(1, input.split("\n").length))}
              value={input}
              style={{
                flex: 1,
                minHeight: 42,
                maxHeight: 88,
                resize: "none",
              }}
            />
            <button
              className="btn-primary"
              disabled={loading}
              onClick={sendMessage}
              type="button"
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                padding: 0,
                display: "grid",
                placeItems: "center",
              }}
            >
              ^
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
