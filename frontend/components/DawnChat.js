"use client";

import { useMemo, useState } from "react";
import styles from "./DawnChat.module.css";

function InsightCard({ card }) {
  const tone =
    card.tone === "alert" ? styles.cardAlert : card.tone === "success" ? styles.cardSuccess : styles.cardNeutral;

  return (
    <article className={`${styles.embeddedCard} ${tone}`}>
      <p className={styles.cardTitle}>{card.title}</p>
      <p className={styles.cardBody}>{card.body}</p>
      {card.recommendation && <p className={styles.cardMeta}>Recommendation: {card.recommendation}</p>}
    </article>
  );
}

function HealthReportCard({ card }) {
  return (
    <article className={styles.embeddedCard}>
      <div className={styles.cardHeader}>
        <p className={styles.cardTitle}>{card.title}</p>
        <div className={styles.gauge} style={{ "--score": `${card.score}%` }}>
          <span>{card.score}</span>
        </div>
      </div>
      <p className={styles.cardBody}>{card.summary}</p>
    </article>
  );
}

function RiskForecastCard({ card }) {
  return (
    <article className={styles.embeddedCard}>
      <p className={styles.cardTitle}>{card.title}</p>
      <div className={styles.barGrid}>
        {card.blocks?.map((block) => (
          <div key={block.block} className={styles.barItem}>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ height: `${block.risk}%` }} />
            </div>
            <strong>{block.risk}%</strong>
            <span>{block.block}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function RemediationPriorityCard({ card }) {
  return (
    <article className={styles.embeddedCard}>
      <p className={styles.cardTitle}>{card.title}</p>
      <ol className={styles.priorityList}>
        {card.items?.map((item, index) => (
          <li key={item.label}>
            <span className={styles.priorityIndex}>{index + 1}</span>
            <span>{item.label}</span>
            <span className={`${styles.urgencyChip} ${styles[`urgency${item.urgency?.[0]?.toUpperCase()}${item.urgency?.slice(1)}`]}`}>
              {item.urgency}
            </span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function CorridorInsightCard({ card }) {
  return (
    <article className={styles.embeddedCard}>
      <span className={styles.locationTag}>{card.location}</span>
      <p className={styles.cardBody}>{card.description}</p>
    </article>
  );
}

function RecommendationListCard({ card }) {
  return (
    <article className={styles.embeddedCard}>
      <p className={styles.cardTitle}>{card.title}</p>
      <ul className={styles.recommendationList}>
        {card.recommendations?.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <div className={styles.actionRow}>
        <button className={styles.inlineAction} type="button">
          Assign Ops
        </button>
        <button className={styles.inlineActionGhost} type="button">
          Export Brief
        </button>
      </div>
    </article>
  );
}

function ComplaintDraftCard({ card, onUseDraft }) {
  return (
    <article className={styles.embeddedCard}>
      <p className={styles.cardTitle}>Complaint draft</p>
      <div className={styles.draftGrid}>
        <span>Unit: {card.unitId}</span>
        <span>Category: {card.category}</span>
        <span>Priority: {card.priority}</span>
      </div>
      <p className={styles.cardBody}>{card.description}</p>
      <button className={styles.inlineAction} onClick={() => onUseDraft(card.description)} type="button">
        Use this draft
      </button>
    </article>
  );
}

function ComplaintResultCard({ card }) {
  return (
    <article className={styles.embeddedCard}>
      <p className={styles.cardTitle}>{card.success ? "Complaint submitted" : "Submission needs review"}</p>
      <p className={styles.cardBody}>{card.message}</p>
      <p className={styles.cardMeta}>Complaint ID: {card.complaintId}</p>
    </article>
  );
}

function RenderCard({ card, onUseDraft }) {
  if (card.type === "insight_card") return <InsightCard card={card} />;
  if (card.type === "health_report_card") return <HealthReportCard card={card} />;
  if (card.type === "risk_forecast_card") return <RiskForecastCard card={card} />;
  if (card.type === "remediation_priority") return <RemediationPriorityCard card={card} />;
  if (card.type === "corridor_insight") return <CorridorInsightCard card={card} />;
  if (card.type === "recommendation_list") return <RecommendationListCard card={card} />;
  if (card.type === "complaint_draft") return <ComplaintDraftCard card={card} onUseDraft={onUseDraft} />;
  if (card.type === "complaint_result") return <ComplaintResultCard card={card} />;
  return null;
}

export default function DawnChat() {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      type: "ai",
      text: "Dawn is online. Ask about risk, health, remediation, corridor performance, or complaint drafting.",
      cards: [],
    },
  ]);

  const statusText = useMemo(() => (loading ? "Thinking..." : "Online"), [loading]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const userMessage = { id: crypto.randomUUID(), type: "user", text: input, cards: [] };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await fetch("/api/dawn/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      });
      const payload = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: "ai",
          text: payload.message,
          cards: payload.cards || [],
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
    <div className={`${styles.widget} ${open ? styles.widgetOpen : styles.widgetClosed}`}>
      {!open && (
        <button className={styles.launcher} onClick={() => setOpen(true)} type="button">
          <span className={styles.launcherAvatar}>D</span>
          Dawn
        </button>
      )}

      {open && (
        <section className={styles.panel}>
          <header className={styles.panelHeader}>
            <div className={styles.identity}>
              <div className={styles.avatar}>D</div>
              <div>
                <p className={styles.heading}>Dawn AI Concierge</p>
                <p className={styles.status}>
                  <span className={styles.statusDot} />
                  {statusText}
                </p>
              </div>
            </div>
            <button className={styles.collapse} onClick={() => setOpen(false)} type="button">
              Minimize
            </button>
          </header>

          <div className={styles.feed}>
            {messages.map((message) => (
              <div key={message.id} className={`${styles.message} ${message.type === "user" ? styles.userMessage : styles.aiMessage}`}>
                <p>{message.text}</p>
                {message.cards?.length > 0 && (
                  <div className={styles.cardStack}>
                    {message.cards.map((card, index) => (
                      <RenderCard key={`${message.id}-${card.type}-${index}`} card={card} onUseDraft={useDraft} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <footer className={styles.composer}>
            <input
              className={styles.input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendMessage();
              }}
              placeholder="Ask Dawn about portfolio operations..."
              value={input}
            />
            <button className={styles.send} disabled={loading} onClick={sendMessage} type="button">
              Send
            </button>
          </footer>
        </section>
      )}
    </div>
  );
}
