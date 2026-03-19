"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createCorridor,
  createInstitution,
  getAdminAuditQueue,
  getAdminUnits,
  getAuditSample,
  getCorridors,
  reviewUnit,
  setCorrectivePlan,
  resolveAuditLog,
} from "@/lib/api";
import styles from "./page.module.css";

function trustBandClass(trustBand) {
  if (trustBand === "priority") return "band-priority";
  if (trustBand === "standard") return "band-standard";
  return "band-hidden";
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

export default function AdminPage() {
  const [corridors, setCorridors] = useState([]);
  const [selectedCorridorId, setSelectedCorridorId] = useState("");
  const [units, setUnits] = useState([]);
  const [auditQueue, setAuditQueue] = useState([]);
  const [sample, setSample] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [corridorForm, setCorridorForm] = useState({ name: "", cityCode: "" });
  const [institutionForm, setInstitutionForm] = useState({ name: "", corridorId: "" });
  const [sampleCount, setSampleCount] = useState(3);
  const [auditForms, setAuditForms] = useState({});

  async function loadAdminData(corridorIdOverride) {
    setLoading(true);
    setError("");
    try {
      const corridorPayload = await getCorridors();
      const nextCorridors = Array.isArray(corridorPayload) ? corridorPayload : [];
      const corridorId = corridorIdOverride || selectedCorridorId || nextCorridors[0]?.id;
      const [unitsPayload, auditPayload] = corridorId
        ? await Promise.all([getAdminUnits(corridorId), getAdminAuditQueue(corridorId)])
        : [[], []];

      setCorridors(nextCorridors);
      setSelectedCorridorId(String(corridorId || ""));
      setInstitutionForm((current) => ({ ...current, corridorId: current.corridorId || String(corridorId || "") }));
      setUnits(Array.isArray(unitsPayload) ? unitsPayload : []);
      setAuditQueue(Array.isArray(auditPayload) ? auditPayload : []);
    } catch (loadError) {
      setError(loadError.message || "Unable to load admin operations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    if (!autoRefresh || !selectedCorridorId) return undefined;
    const timer = window.setInterval(() => {
      loadAdminData(selectedCorridorId);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, selectedCorridorId]);

  const stats = useMemo(
    () => ({
      corridors: corridors.length,
      pending: units.filter((unit) => unit.status === "submitted" || unit.status === "pending").length,
      suspended: units.filter((unit) => unit.status === "suspended").length,
      audits: auditQueue.filter((item) => !item.resolved).length,
    }),
    [auditQueue, corridors.length, units]
  );

  async function handleReview(unitId, body) {
    setBanner("");
    setError("");
    try {
      await reviewUnit(unitId, body);
      setBanner(`Unit ${unitId} updated.`);
      await loadAdminData(selectedCorridorId);
    } catch (requestError) {
      setError(requestError.message || "Unit review action failed.");
    }
  }

  async function handleCreateCorridor() {
    setBanner("");
    setError("");
    try {
      await createCorridor(corridorForm);
      setBanner("Corridor created.");
      setCorridorForm({ name: "", cityCode: "" });
      await loadAdminData();
    } catch (requestError) {
      setError(requestError.message || "Unable to create corridor.");
    }
  }

  async function handleCreateInstitution() {
    setBanner("");
    setError("");
    try {
      await createInstitution({ ...institutionForm, corridorId: Number(institutionForm.corridorId) });
      setBanner("Institution created.");
      setInstitutionForm((current) => ({ ...current, name: "" }));
    } catch (requestError) {
      setError(requestError.message || "Unable to create institution.");
    }
  }

  async function handleAuditSample() {
    setBanner("");
    setError("");
    try {
      const payload = await getAuditSample(selectedCorridorId, sampleCount);
      setSample(Array.isArray(payload) ? payload : payload?.units || []);
    } catch (requestError) {
      setError(requestError.message || "Unable to fetch audit sample.");
    }
  }

  async function handleCorrectivePlan(auditLogId) {
    const form = auditForms[auditLogId] || {};
    setBanner("");
    setError("");
    try {
      await setCorrectivePlan(auditLogId, {
        correctiveAction: form.correctiveAction,
        correctiveDeadline: form.correctiveDeadline || undefined,
      });
      setBanner(`Corrective plan saved for audit ${auditLogId}.`);
      await loadAdminData(selectedCorridorId);
    } catch (requestError) {
      setError(requestError.message || "Unable to save corrective plan.");
    }
  }

  async function handleResolveAudit(auditLogId) {
    const form = auditForms[auditLogId] || {};
    setBanner("");
    setError("");
    try {
      await resolveAuditLog(auditLogId, {
        verificationNotes: form.verificationNotes || "",
        reopenUnit: Boolean(form.reopenUnit),
      });
      setBanner(`Audit ${auditLogId} resolved.`);
      await loadAdminData(selectedCorridorId);
    } catch (requestError) {
      setError(requestError.message || "Unable to resolve audit.");
    }
  }

  function updateAuditForm(auditLogId, field, value) {
    setAuditForms((current) => ({
      ...current,
      [auditLogId]: {
        ...(current[auditLogId] || {}),
        [field]: value,
      },
    }));
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
      {error ? <div className="status-banner error">{error}</div> : null}
      {banner ? <div className="status-banner success">{banner}</div> : null}

      <section className="glass fade-up">
        <p className="label-caps">Admin operations</p>
        <div className={styles.topRow}>
          <div>
            <h1 className={styles.title}>Control room</h1>
            <p className={styles.subtitle}>Review units, govern audit workflows, and create corridor resources.</p>
          </div>
          <label className={styles.selector}>
            <span>Corridor</span>
            <select className="app-input" onChange={(event) => loadAdminData(event.target.value)} value={selectedCorridorId}>
              {corridors.map((corridor) => (
                <option key={corridor.id} value={corridor.id}>
                  {corridor.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={`${styles.metrics} fade-up-d1`}>
        <div className="metric-card"><span className="ml">Corridors</span><strong className="mv">{stats.corridors}</strong></div>
        <div className="metric-card"><span className="ml">Pending review</span><strong className="mv">{stats.pending}</strong></div>
        <div className="metric-card"><span className="ml">Suspended</span><strong className="mv">{stats.suspended}</strong></div>
        <div className="metric-card"><span className="ml">Audits open</span><strong className="mv">{stats.audits}</strong></div>
      </section>

      <section className={`${styles.grid} fade-up-d2`}>
        <article className="panel">
          <p className="label-caps">Create corridor</p>
          <div className={styles.formStack}>
            <input className="app-input" onChange={(event) => setCorridorForm((current) => ({ ...current, name: event.target.value }))} placeholder="Corridor name" value={corridorForm.name} />
            <input className="app-input" onChange={(event) => setCorridorForm((current) => ({ ...current, cityCode: event.target.value }))} placeholder="City code" value={corridorForm.cityCode} />
            <button className="btn-primary" onClick={handleCreateCorridor} type="button">
              Create corridor
            </button>
          </div>
        </article>

        <article className="panel">
          <p className="label-caps">Create institution</p>
          <div className={styles.formStack}>
            <input className="app-input" onChange={(event) => setInstitutionForm((current) => ({ ...current, name: event.target.value }))} placeholder="Institution name" value={institutionForm.name} />
            <select className="app-input" onChange={(event) => setInstitutionForm((current) => ({ ...current, corridorId: event.target.value }))} value={institutionForm.corridorId}>
              {corridors.map((corridor) => (
                <option key={corridor.id} value={corridor.id}>
                  {corridor.name}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={handleCreateInstitution} type="button">
              Create institution
            </button>
          </div>
        </article>

        <article className="panel">
          <p className="label-caps">Audit sampling</p>
          <div className={styles.formStack}>
            <input className="app-input" min="1" onChange={(event) => setSampleCount(event.target.value)} type="number" value={sampleCount} />
            <button className="btn-secondary" onClick={handleAuditSample} type="button">
              Random audit sample
            </button>
            <label className={styles.toggleRow}>
              <span>Auto refresh every 30s</span>
              <input checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} type="checkbox" />
            </label>
          </div>
        </article>
      </section>

      <section className="panel fade-up-d3">
        <div className={styles.sectionHeader}>
          <div>
            <p className="label-caps">Unit review queue</p>
            <h2 className="section-heading">Submitted and pending units</h2>
          </div>
          <Link className="btn-soft blue" href="/dashboard">
            Back to dashboard
          </Link>
        </div>
        <div className={styles.list}>
          {units
            .filter((unit) => unit.status === "submitted" || unit.status === "pending" || unit.auditRequired)
            .map((unit) => (
              <article key={unit.id} className="panel-light">
                <div className={styles.unitRow}>
                  <div>
                    <strong>Unit {unit.id}</strong>
                    <div className={styles.chipRow}>
                      <span className={`trust-band-badge ${trustBandClass(unit.trustBand)}`}>{unit.trustBand}</span>
                      <span className={`chip ${unit.structuralApproved ? "ch-ok" : "ch-warn"}`}>Structural {unit.structuralApproved ? "approved" : "pending"}</span>
                      <span className={`chip ${unit.operationalBaselineApproved ? "ch-ok" : "ch-warn"}`}>Operational {unit.operationalBaselineApproved ? "approved" : "pending"}</span>
                    </div>
                  </div>
                  <div className={styles.actionRow}>
                    <button className="btn-soft mint" onClick={() => handleReview(unit.id, { status: "approved", structuralApproved: true, operationalBaselineApproved: true })} type="button">Approve</button>
                    <button className="btn-soft red" onClick={() => handleReview(unit.id, { status: "rejected" })} type="button">Reject</button>
                    <button className="btn-soft gold" onClick={() => handleReview(unit.id, { status: "suspended" })} type="button">Suspend</button>
                  </div>
                </div>
              </article>
            ))}
          {!units.filter((unit) => unit.status === "submitted" || unit.status === "pending" || unit.auditRequired).length ? (
            <div className="empty-state">No units currently require review in this corridor.</div>
          ) : null}
        </div>
      </section>

      <section className={`${styles.grid} fade-up-d3`}>
        <article className="panel">
          <p className="label-caps">Audit queue</p>
          <div className={styles.list}>
            {auditQueue.map((audit) => (
              <div key={audit.id} className="glass">
                <div className={styles.unitRow}>
                  <div>
                    <strong>Unit {audit.unitId}</strong>
                    <div className={styles.chipRow}>
                      <span className="chip ch-err">{audit.triggerType}</span>
                      <span className={`chip ${audit.resolved ? "ch-ok" : "ch-warn"}`}>{audit.resolved ? "Resolved" : "Open"}</span>
                    </div>
                  </div>
                  <span className="label-caps">{formatDate(audit.createdAt)}</span>
                </div>
                <p className={styles.subtitle}>{audit.reason}</p>
                <div className={styles.formStack}>
                  <textarea className="app-input" onChange={(event) => updateAuditForm(audit.id, "correctiveAction", event.target.value)} placeholder="Corrective action" value={auditForms[audit.id]?.correctiveAction || ""} />
                  <input className="app-input" onChange={(event) => updateAuditForm(audit.id, "correctiveDeadline", event.target.value)} type="date" value={auditForms[audit.id]?.correctiveDeadline || ""} />
                  <button className="btn-secondary" onClick={() => handleCorrectivePlan(audit.id)} type="button">
                    Set plan
                  </button>
                  <textarea className="app-input" onChange={(event) => updateAuditForm(audit.id, "verificationNotes", event.target.value)} placeholder="Verification notes" value={auditForms[audit.id]?.verificationNotes || ""} />
                  <label className={styles.toggleRow}>
                    <span>Reopen unit to approved status</span>
                    <input checked={Boolean(auditForms[audit.id]?.reopenUnit)} onChange={(event) => updateAuditForm(audit.id, "reopenUnit", event.target.checked)} type="checkbox" />
                  </label>
                  <button className="btn-primary" onClick={() => handleResolveAudit(audit.id)} type="button">
                    Resolve audit
                  </button>
                </div>
              </div>
            ))}
            {!auditQueue.length ? <div className="empty-state">No audit logs are currently queued for this corridor.</div> : null}
          </div>
        </article>

        <article className="panel">
          <p className="label-caps">Random audit sample</p>
          <div className={styles.list}>
            {sample.map((unit) => (
              <div key={unit.id || unit.unitId} className="panel-light">
                <div className={styles.unitRow}>
                  <strong>Unit {unit.id || unit.unitId}</strong>
                  <span className={`trust-band-badge ${trustBandClass(unit.trustBand)}`}>{unit.trustBand}</span>
                </div>
                <p className={styles.subtitle}>Trust score {unit.trustScore || 0}</p>
              </div>
            ))}
            {!sample.length ? <div className="empty-state">Run a sample to inspect randomly selected approved units.</div> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
