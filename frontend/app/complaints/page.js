"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ComplaintForm from "@/components/ComplaintForm";
import { getComplaints, resolveComplaint } from "@/lib/api";
import styles from "./page.module.css";

function SlaCountdown({ slaCountdownMs }) {
  const [remainingMs, setRemainingMs] = useState(Number(slaCountdownMs || 0));

  useEffect(() => {
    setRemainingMs(Number(slaCountdownMs || 0));
  }, [slaCountdownMs]);

  useEffect(() => {
    if (slaCountdownMs === null || slaCountdownMs === undefined) return undefined;

    const intervalId = window.setInterval(() => {
      setRemainingMs((current) => current - 1000);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [slaCountdownMs]);

  if (slaCountdownMs === null || slaCountdownMs === undefined) {
    return null;
  }

  if (remainingMs <= 0) {
    return <span className="sla-countdown pulse" style={{ color: "var(--color-error)" }}>SLA BREACHED</span>;
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  const urgent = remainingMs <= 43200000;

  return (
    <span className={`sla-countdown ${urgent ? "pulse" : ""}`} style={{ color: urgent ? "var(--color-error)" : "var(--color-warn)" }}>
      {`${hours}:${minutes}:${seconds}`}
    </span>
  );
}

function severityLabel(severity) {
  if (severity <= 2) return "ch-ok";
  if (severity === 3) return "ch-warn";
  return "ch-err";
}

function normalizeMetrics(payload) {
  if (payload?.role === "student") {
    const complaints = Array.isArray(payload.complaints) ? payload.complaints : [];
    const resolved = complaints.filter((item) => item.resolved).length;
    const breached = complaints.filter((item) => item.slaStatus === "late" || item.slaStatus === "sla_breached").length;
    return [
      { label: "Total", value: complaints.length, note: "Submitted complaints" },
      { label: "Open", value: complaints.filter((item) => !item.resolved).length, note: "Still unresolved" },
      { label: "Resolved", value: resolved, note: "Closed items" },
      { label: "SLA Breached", value: breached, note: "Late or breached" },
    ];
  }

  const metrics = payload?.metrics || {};
  return [
    { label: "Total", value: payload?.total || 0, note: "Visible complaints" },
    { label: "Open", value: metrics.openComplaints || 0, note: "Active issues" },
    { label: "Resolved", value: (payload?.total || 0) - Number(metrics.openComplaints || 0), note: "Closed items" },
    { label: "Avg Resolution", value: metrics.avgResolutionHours ?? "-", note: "Hours" },
    {
      label: "SLA Late",
      value: metrics.slaLateCount ?? metrics.lateComplaints ?? metrics.lateOrBreached ?? 0,
      note: "Late or breached",
    },
  ];
}

export default function ComplaintsPage() {
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({
    unit: "",
    status: "",
    incidentType: "",
    severity: "",
    from: "",
    to: "",
  });

  async function loadComplaints(activeFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (activeFilters.unit) params.set("unitId", activeFilters.unit);
      if (activeFilters.status) params.set("status", activeFilters.status);
      if (activeFilters.incidentType) params.set("incidentType", activeFilters.incidentType);
      const response = await getComplaints(params.toString());
      setPayload(response || null);
    } catch (loadError) {
      setError(loadError.message || "Failed to load complaints.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setRole(localStorage.getItem("role") || "");
    loadComplaints();
  }, []);

  const complaints = useMemo(() => {
    const list = Array.isArray(payload?.complaints) ? payload.complaints : [];
    return list.filter((complaint) => {
      if (filters.severity && String(complaint.severity) !== String(filters.severity)) return false;
      if (filters.from && complaint.createdAt && new Date(complaint.createdAt) < new Date(filters.from)) return false;
      if (filters.to && complaint.createdAt && new Date(complaint.createdAt) > new Date(`${filters.to}T23:59:59`)) return false;
      return true;
    });
  }, [filters.from, filters.severity, filters.to, payload]);

  const metrics = useMemo(() => normalizeMetrics(payload), [payload]);
  const severityDistribution = useMemo(() => {
    return complaints.reduce((acc, complaint) => {
      const key = String(complaint.severity || 0);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [complaints]);

  async function handleResolve(complaintId) {
    try {
      await resolveComplaint(complaintId);
      await loadComplaints();
    } catch (resolveError) {
      setError(resolveError.message || "Failed to resolve complaint.");
    }
  }

  return (
    <div className={`pageShell ${styles.page}`}>
      <section className="fade-up">
        <h1 className="hero-heading">Complaints command center</h1>
        <p className="pageSubtitle">Track complaint severity, SLA exposure, incident flags, and remediation progress across the role-specific queue.</p>
      </section>

      <section className={`panel-light fade-up-d1 ${styles.filters}`}>
        <label className={styles.filterField}>
          <span>Unit</span>
          <select className="app-input" value={filters.unit} onChange={(event) => setFilters((prev) => ({ ...prev, unit: event.target.value }))}>
            <option value="">All</option>
            {Array.from(new Set((payload?.complaints || []).map((item) => item.unitId))).map((unitId) => (
              <option key={unitId} value={unitId}>
                {unitId}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterField}>
          <span>Status</span>
          <select className="app-input" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
            <option value="">All</option>
            <option value="open">open</option>
            <option value="resolved">resolved</option>
            <option value="late">late</option>
            <option value="sla_breached">sla_breached</option>
          </select>
        </label>

        <label className={styles.filterField}>
          <span>Incident type</span>
          <select className="app-input" value={filters.incidentType} onChange={(event) => setFilters((prev) => ({ ...prev, incidentType: event.target.value }))}>
            <option value="">All</option>
            <option value="safety">safety</option>
            <option value="injury">injury</option>
            <option value="fire">fire</option>
            <option value="harassment">harassment</option>
            <option value="water">water</option>
            <option value="common_area">common_area</option>
            <option value="electrical">electrical</option>
            <option value="other">other</option>
          </select>
        </label>

        <label className={styles.filterField}>
          <span>Severity</span>
          <select className="app-input" value={filters.severity} onChange={(event) => setFilters((prev) => ({ ...prev, severity: event.target.value }))}>
            <option value="">All</option>
            {["1", "2", "3", "4", "5"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterField}>
          <span>From</span>
          <input className="app-input" type="date" value={filters.from} onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))} />
        </label>

        <label className={styles.filterField}>
          <span>To</span>
          <input className="app-input" type="date" value={filters.to} onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))} />
        </label>

        <button className="btn-secondary" onClick={() => loadComplaints(filters)} type="button">
          Apply
        </button>
      </section>

      {error ? <div className="status-banner error fade-up-d1">{error}</div> : null}

      <section className={`${styles.metricGrid} fade-up-d2`}>
        {metrics.map((metric) => (
          <article key={metric.label} className="metric-card">
            <p className="label-caps">{metric.label}</p>
            <strong>{metric.value}</strong>
            <span>{metric.note}</span>
          </article>
        ))}
      </section>

      {role !== "student" ? (
        <section className={`panel fade-up-d2 ${styles.distributionPanel}`}>
          <div className={styles.sectionLead}>
            <h2 className="section-heading">Severity distribution</h2>
            <p className="mutedText">Live breakdown of complaint severity in the current filtered queue.</p>
          </div>

          <div className={styles.severityBars}>
            {severityDistribution && ["1", "2", "3", "4", "5"].map((level) => (
              <div key={level} className={styles.severityBarRow}>
                <div className={styles.barLabel}>
                  <span className={`chip ${severityLabel(Number(level))}`}>{level}</span>
                  <strong>{severityDistribution[level] || 0}</strong>
                </div>
                <div className="trust-bar-track">
                  <div
                    className={`trust-bar-fill ${Number(level) >= 4 ? "hidden" : Number(level) === 3 ? "standard" : "priority"}`}
                    style={{
                      width: `${Math.min(100, complaints.length > 0 ? ((severityDistribution[level] || 0) / complaints.length) * 100 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className={`fade-up-d3 ${styles.mainLayout}`}>
        <div className={styles.cardGrid}>
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton" />)
          ) : complaints.length > 0 ? (
            complaints.map((complaint) => (
              <article key={complaint.id} className={`${styles.complaintCard} glass`} onClick={() => setSelected(complaint)}>
                <div className={styles.cardHeader}>
                  <span className={`chip ${severityLabel(Number(complaint.severity || 0))}`}>{`Severity ${complaint.severity}`}</span>
                  <span className={`chip ${complaint.slaStatus === "resolved" ? "ch-ok" : complaint.slaStatus === "late" || complaint.slaStatus === "sla_breached" ? "ch-err" : "ch-warn"}`}>
                    {complaint.slaStatus}
                  </span>
                  <span className={`chip ${complaint.resolved ? "ch-ok" : "ch-blue"}`}>{complaint.resolved ? "resolved" : "open"}</span>
                </div>

                <div className={styles.cardMeta}>
                  {complaint.incidentType ? <span className="chip ch-blue">{complaint.incidentType}</span> : null}
                  {complaint.incidentFlag ? <span className="chip ch-err">Flagged incident</span> : null}
                </div>

                <p className={styles.message}>{complaint.message || "No description provided."}</p>

                <div className={styles.cardFooter}>
                  <div className={styles.metaText}>
                    <span>{`Unit ${complaint.unitId}`}</span>
                    <span>{new Date(complaint.createdAt).toLocaleString()}</span>
                    {role !== "student" && complaint.student?.name ? <span>{complaint.student.name}</span> : null}
                  </div>
                  {!complaint.resolved ? <SlaCountdown slaCountdownMs={complaint.slaCountdownMs} /> : null}
                </div>

                {complaint.trustImpactHint !== undefined ? <div className="label-caps">{`Trust impact ${complaint.trustImpactHint}`}</div> : null}

                {role !== "student" && !complaint.resolved ? (
                  <button
                    className="btn-soft mint"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleResolve(complaint.id);
                    }}
                    type="button"
                  >
                    Resolve
                  </button>
                ) : null}

                {role === "student" ? (
                  <Link
                    className="btn-soft blue"
                    href={`/unit/${complaint.unitId}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    View unit
                  </Link>
                ) : null}
              </article>
            ))
          ) : (
            <div className="empty-state panel-light">No complaints matched the current filters.</div>
          )}
        </div>

        <div className={styles.formColumn}>
          {role === "student" ? (
            <ComplaintForm />
          ) : (
            <div className="panel">
              <h2 className="section-heading">Resolution workflow</h2>
              <p className="mutedText">
                Select any open complaint card to resolve it from the side panel and refresh trust metrics.
              </p>
            </div>
          )}
        </div>
      </section>

      {selected ? (
        <div className={styles.drawerOverlay} onClick={() => setSelected(null)}>
          <aside className={styles.drawer} onClick={(event) => event.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <p className="label-caps">{`Complaint ${selected.id}`}</p>
                <h2 className="section-heading">{`Unit ${selected.unitId}`}</h2>
              </div>
              <button className="btn-secondary" onClick={() => setSelected(null)} type="button">
                Close
              </button>
            </div>

            <div className={styles.drawerStack}>
              <span className={`chip ${severityLabel(Number(selected.severity || 0))}`}>{`Severity ${selected.severity}`}</span>
              <span className={`chip ${selected.slaStatus === "resolved" ? "ch-ok" : selected.slaStatus === "late" || selected.slaStatus === "sla_breached" ? "ch-err" : "ch-warn"}`}>
                {selected.slaStatus}
              </span>
              {selected.incidentFlag ? <span className="chip ch-err">Flagged incident</span> : null}
            </div>

            <p className={styles.drawerText}>{selected.message || "No description provided."}</p>

            <div className={styles.timeline}>
              <div className="panel-light">
                <strong>Created</strong>
                <span>{new Date(selected.createdAt).toLocaleString()}</span>
              </div>
              {selected.resolvedAt ? (
                <div className="panel-light">
                  <strong>Resolved</strong>
                  <span>{new Date(selected.resolvedAt).toLocaleString()}</span>
                </div>
              ) : null}
              {selected.slaDeadline ? (
                <div className="panel-light">
                  <strong>SLA deadline</strong>
                  <span>{new Date(selected.slaDeadline).toLocaleString()}</span>
                </div>
              ) : null}
            </div>

            {role !== "student" && !selected.resolved ? <ComplaintForm complaintId={selected.id} /> : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
