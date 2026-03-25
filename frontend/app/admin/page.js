"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createCorridor,
  createInstitution,
  getAdminAuditQueue,
  getAdminUnits,
  getCorridors,
  reviewUnit,
} from "@/lib/api";
import { getStatusTone, getTrustBand } from "@/lib/governance";

export default function AdminPage() {
  const [corridors, setCorridors] = useState([]);
  const [selectedCorridor, setSelectedCorridor] = useState("");
  const [units, setUnits] = useState([]);
  const [auditQueue, setAuditQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [corridorForm, setCorridorForm] = useState({ name: "", cityCode: "" });
  const [institutionForm, setInstitutionForm] = useState({ name: "", corridorId: "" });

  async function loadAdmin(corridorOverride) {
    setLoading(true);
    setError("");
    try {
      const corridorPayload = await getCorridors();
      const corridorList = Array.isArray(corridorPayload) ? corridorPayload : [];
      const activeCorridor = corridorOverride || selectedCorridor || String(corridorList[0]?.id || "");

      const [unitPayload, auditPayload] = activeCorridor
        ? await Promise.all([getAdminUnits(activeCorridor), getAdminAuditQueue(activeCorridor)])
        : [[], []];

      setCorridors(corridorList);
      setSelectedCorridor(activeCorridor);
      setUnits(Array.isArray(unitPayload) ? unitPayload : []);
      setAuditQueue(Array.isArray(auditPayload) ? auditPayload : []);
      setInstitutionForm((current) => ({ ...current, corridorId: current.corridorId || activeCorridor }));
    } catch (requestError) {
      setError(requestError.message || "Unable to load admin operations.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmin();
  }, []);

  const stats = useMemo(
    () => ({
      total: units.length,
      pending: units.filter((unit) => ["submitted", "admin_review"].includes(unit.status)).length,
      suspended: units.filter((unit) => unit.status === "suspended").length,
      audits: auditQueue.length,
    }),
    [auditQueue.length, units]
  );

  async function handleStatus(unitId, status) {
    setError("");
    setBanner("");
    try {
      const body = status === "approved" ? { status: "approved", structuralApproved: true, operationalBaselineApproved: true } : { status };
      await reviewUnit(unitId, body);
      setBanner(`Unit ${unitId} updated to ${status}.`);
      await loadAdmin(selectedCorridor);
    } catch (requestError) {
      setError(requestError.message || "Unable to update unit.");
    }
  }

  async function handleCreateCorridor() {
    setError("");
    try {
      await createCorridor(corridorForm);
      setBanner("Corridor created.");
      setCorridorForm({ name: "", cityCode: "" });
      await loadAdmin();
    } catch (requestError) {
      setError(requestError.message || "Unable to create corridor.");
    }
  }

  async function handleCreateInstitution() {
    setError("");
    try {
      await createInstitution({ name: institutionForm.name, corridorId: Number(institutionForm.corridorId) });
      setBanner("Institution created.");
      setInstitutionForm((current) => ({ ...current, name: "" }));
    } catch (requestError) {
      setError(requestError.message || "Unable to create institution.");
    }
  }

  return (
    <div className="grid gap-6">
      <section className="glass-panel-strong blueprint-border p-8 sm:p-10">
        <div className="eyebrow">Admin Control Room</div>
        <h1 className="page-title mt-5 text-gradient">Governance actions with visible reasons.</h1>
        <p className="subtle-copy mt-4 max-w-3xl">
          Review units, create corridor resources, and act on trust-driven triggers. The point is not CRUD speed. The point is
          transparent control over why units are discoverable.
        </p>

        <div className="mt-8 max-w-sm">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Corridor</span>
            <select className="input-shell" onChange={(event) => loadAdmin(event.target.value)} value={selectedCorridor}>
              <option value="">Select corridor</option>
              {corridors.map((corridor) => (
                <option key={corridor.id} value={corridor.id}>
                  {corridor.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? <div className="status-banner error">{error}</div> : null}
      {banner ? <div className="status-banner success">{banner}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="metric-tile"><p>Governed units</p><strong>{stats.total}</strong><span>Total units in current corridor view.</span></article>
        <article className="metric-tile"><p>Pending review</p><strong>{stats.pending}</strong><span>Units awaiting approval or rejection.</span></article>
        <article className="metric-tile"><p>Suspended</p><strong>{stats.suspended}</strong><span>Units blocked by governance action.</span></article>
        <article className="metric-tile"><p>Audit queue</p><strong>{stats.audits}</strong><span>Complaint or signal-driven audit pressure.</span></article>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <article className="glass-panel p-6">
          <div className="eyebrow">Create Corridor</div>
          <div className="mt-5 grid gap-3">
            <input className="input-shell" onChange={(event) => setCorridorForm((current) => ({ ...current, name: event.target.value }))} placeholder="Corridor name" value={corridorForm.name} />
            <input className="input-shell" onChange={(event) => setCorridorForm((current) => ({ ...current, cityCode: event.target.value }))} placeholder="City code" value={corridorForm.cityCode} />
            <button className="btn-primary" onClick={handleCreateCorridor} type="button">Create corridor</button>
          </div>
        </article>

        <article className="glass-panel p-6">
          <div className="eyebrow">Create Institution</div>
          <div className="mt-5 grid gap-3">
            <input className="input-shell" onChange={(event) => setInstitutionForm((current) => ({ ...current, name: event.target.value }))} placeholder="Institution name" value={institutionForm.name} />
            <select className="input-shell" onChange={(event) => setInstitutionForm((current) => ({ ...current, corridorId: event.target.value }))} value={institutionForm.corridorId}>
              <option value="">Select corridor</option>
              {corridors.map((corridor) => (
                <option key={corridor.id} value={corridor.id}>
                  {corridor.name}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={handleCreateInstitution} type="button">Create institution</button>
          </div>
        </article>

        <article className="glass-panel p-6">
          <div className="eyebrow">Workflow Reminder</div>
          <div className="mt-5 grid gap-3 text-sm leading-6 text-slate-300">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">Approve only when structural, operational, and trust requirements justify student visibility.</div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">Suspend when system-triggered reasons indicate risk escalation or unresolved audit pressure.</div>
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr,0.85fr]">
        <article className="glass-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Unit Decisions</div>
              <h2 className="section-title mt-4">Approve, reject, or suspend with reason</h2>
            </div>
            <Link className="btn-secondary" href="/dashboard">Back to dashboard</Link>
          </div>
          <div className="mt-6 grid gap-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => <div key={index} className="surface-panel h-40 animate-pulse" />)
            ) : units.length ? (
              units.map((unit) => (
                <article key={unit.id} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <strong className="text-white">Unit {unit.id}</strong>
                      <p className="mt-1 text-sm text-slate-400">
                        System-triggered reason: {unit.auditRequired ? "Auto-flagged due to audit pressure" : `Awaiting governance status decision for ${unit.status}.`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`signal-chip ${getStatusTone(unit.status)}`}>{unit.status}</span>
                      <span className={`signal-chip ${getTrustBand(unit.trustScore).tone}`}>{getTrustBand(unit.trustScore).label}</span>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button className="btn-primary" onClick={() => handleStatus(unit.id, "approved")} type="button">Approve</button>
                    <button className="btn-secondary" onClick={() => handleStatus(unit.id, "rejected")} type="button">Reject</button>
                    <button className="btn-secondary" onClick={() => handleStatus(unit.id, "suspended")} type="button">Suspend</button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">No units currently require action.</div>
            )}
          </div>
        </article>

        <article className="glass-panel p-6">
          <div className="eyebrow">Audit Queue</div>
          <h2 className="section-title mt-4">Complaint clusters and triggers</h2>
          <div className="mt-6 grid gap-4">
            {auditQueue.length ? (
              auditQueue.map((unit) => (
                <div key={unit.id} className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-white">Unit {unit.id}</strong>
                    <span className="signal-chip signal-danger">Audit required</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">Trust score: {unit.trustScore || 0}</p>
                  <p className="text-sm leading-6 text-slate-400">Current status: {unit.status}</p>
                </div>
              ))
            ) : (
              <div className="empty-state">No active audit logs for this corridor.</div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
