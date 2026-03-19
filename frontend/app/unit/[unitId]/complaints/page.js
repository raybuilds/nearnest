"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getUnitComplaints, resolveComplaint } from "@/lib/api";
import styles from "./page.module.css";

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function formatDuration(ms) {
  if (ms <= 0) return "SLA BREACHED";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function severityChip(severity) {
  if (severity <= 2) return "ch-ok";
  if (severity === 3) return "ch-warn";
  return "ch-err";
}

function SlaCountdown({ initialMs }) {
  const [remainingMs, setRemainingMs] = useState(initialMs || 0);

  useEffect(() => {
    setRemainingMs(initialMs || 0);
  }, [initialMs]);

  useEffect(() => {
    if (initialMs == null) return undefined;
    const timer = window.setInterval(() => {
      setRemainingMs((current) => current - 1000);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [initialMs]);

  const urgent = remainingMs <= 43200000;
  const breached = remainingMs <= 0;

  return (
    <span className={`sla-countdown ${urgent ? "pulse" : ""} ${styles.countdown}`}>
      {breached ? "SLA BREACHED" : formatDuration(remainingMs)}
    </span>
  );
}

export default function UnitComplaintsPage({ params }) {
  const [role, setRole] = useState("");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");

  async function loadComplaints(currentRole) {
    setLoading(true);
    setError("");
    try {
      const response = await getUnitComplaints(params.unitId);
      setPayload({ ...response, role: currentRole });
    } catch (loadError) {
      setError(loadError.message || "Unable to load unit complaints.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const currentRole = localStorage.getItem("role") || "";
    setRole(currentRole);
    loadComplaints(currentRole);
  }, [params.unitId]);

  const studentMetrics = useMemo(() => {
    if (payload?.role !== "student") return null;
    return {
      total: payload?.summary?.totalComplaints || 0,
      open: payload?.summary?.activeComplaints || 0,
      resolved: (payload?.summary?.totalComplaints || 0) - (payload?.summary?.activeComplaints || 0),
      breaches: payload?.summary?.slaBreaches30d || 0,
    };
  }, [payload]);

  async function handleResolve(complaintId) {
    setBanner("");
    setError("");
    try {
      const response = await resolveComplaint(complaintId);
      setBanner(`Complaint resolved. Updated trust score: ${response?.trustScore ?? "unknown"}.`);
      await loadComplaints(role);
    } catch (resolveError) {
      setError(resolveError.message || "Unable to resolve complaint.");
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeleton} />
        <div className={styles.skeleton} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href={`/unit/${params.unitId}`}>
        ← Back to unit
      </Link>

      {error ? <div className="status-banner error">{error}</div> : null}
      {banner ? <div className="status-banner success">{banner}</div> : null}

      <section className="glass fade-up">
        <p className="label-caps">Unit complaint activity</p>
        <h1 className={styles.title}>Unit {params.unitId} complaints</h1>
      </section>

      {payload?.role === "student" ? (
        <>
          <section className={`${styles.metrics} fade-up-d1`}>
            <div className="metric-card"><span className="ml">Total</span><strong className="mv">{studentMetrics.total}</strong></div>
            <div className="metric-card"><span className="ml">Open</span><strong className="mv">{studentMetrics.open}</strong></div>
            <div className="metric-card"><span className="ml">Resolved</span><strong className="mv">{studentMetrics.resolved}</strong></div>
            <div className="metric-card"><span className="ml">SLA breached</span><strong className="mv">{studentMetrics.breaches}</strong></div>
          </section>

          <section className={`${styles.list} fade-up-d2`}>
            {(payload?.ownComplaints || []).map((complaint) => (
              <article key={complaint.id} className="panel-light">
                <div className={styles.row}>
                  <span className={`chip ${severityChip(complaint.severity)}`}>Severity {complaint.severity}</span>
                  <span className={`chip ${complaint.resolved ? "ch-ok" : "ch-warn"}`}>{complaint.slaStatus || (complaint.resolved ? "resolved" : "open")}</span>
                </div>
                <p className={styles.copy}>{complaint.message || "No message provided."}</p>
                <p className={styles.meta}>{formatDate(complaint.createdAt)}</p>
              </article>
            ))}
            {!payload?.ownComplaints?.length ? <div className="empty-state">You do not have any complaints on this unit yet.</div> : null}
          </section>
        </>
      ) : (
        <>
          <section className={`${styles.metrics} fade-up-d1`}>
            <div className="metric-card"><span className="ml">Total</span><strong className="mv">{payload?.metrics?.totalComplaints || 0}</strong></div>
            <div className="metric-card"><span className="ml">Open</span><strong className="mv">{payload?.metrics?.activeComplaints || 0}</strong></div>
            <div className="metric-card"><span className="ml">Avg resolution</span><strong className="mv">{payload?.metrics?.avgResolutionHours || 0}h</strong></div>
            <div className="metric-card"><span className="ml">SLA compliance</span><strong className="mv">{payload?.metrics?.slaCompliance ?? 0}%</strong></div>
            <div className="metric-card"><span className="ml">30 day volume</span><strong className="mv">{payload?.metrics?.complaintsLast30Days || 0}</strong></div>
          </section>

          <section className={`${styles.distribution} panel-light fade-up-d2`}>
            {Object.entries(payload?.metrics?.severityTrend || {}).map(([severity, count]) => (
              <div key={severity} className={styles.barRow}>
                <span>Severity {severity}</span>
                <div className={styles.barTrack}>
                  <div className={styles.barFill} style={{ width: `${Math.min(Number(count) * 12, 100)}%` }} />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </section>

          <section className={`${styles.list} fade-up-d3`}>
            {(payload?.complaints || []).map((complaint) => (
              <article key={complaint.id} className="glass">
                <div className={styles.row}>
                  <span className={`chip ${severityChip(complaint.severity)}`}>Severity {complaint.severity}</span>
                  <span className={`chip ${complaint.resolved ? "ch-ok" : "ch-warn"}`}>{complaint.slaStatus || (complaint.resolved ? "resolved" : "open")}</span>
                  {complaint.incidentFlag ? <span className="chip ch-err">Flagged incident</span> : null}
                </div>
                <p className={styles.copy}>{complaint.message || "No message provided."}</p>
                <p className={styles.meta}>{formatDate(complaint.createdAt)}</p>
                {complaint.student?.name ? <p className={styles.meta}>{complaint.student.name}</p> : null}
                {!complaint.resolved && complaint.slaCountdownMs != null ? <SlaCountdown initialMs={complaint.slaCountdownMs} /> : null}
                {!complaint.resolved ? (
                  <button className="btn-soft mint" onClick={() => handleResolve(complaint.id)} type="button">
                    Resolve
                  </button>
                ) : null}
              </article>
            ))}
            {!payload?.complaints?.length ? <div className="empty-state">No complaints are currently recorded for this unit.</div> : null}
          </section>
        </>
      )}
    </div>
  );
}
