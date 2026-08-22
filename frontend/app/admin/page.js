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
import { FadeIn, Reveal, Expand } from "@/components/ui/Motion";


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
  const [expandedAdminUnitId, setExpandedAdminUnitId] = useState(null);

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
    <div className="grid gap-6 p-6 max-w-7xl mx-auto">
      <Reveal duration={0.5}>
        <section className="glass-panel-strong blueprint-border p-8 sm:p-10 bg-[var(--bg-surface-strong)] rounded-[24px]">
          <div className="eyebrow">Admin Control Room</div>
          <h1 className="page-title mt-5 text-gradient">Governance actions with visible reasons.</h1>
          <p className="subtle-copy mt-4 max-w-3xl">
            Review units, create corridor resources, and act on trust-driven triggers. The point is not CRUD speed. The point is
            transparent control over why units are discoverable.
          </p>

          <div className="mt-8 max-w-sm">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500 font-semibold">Active Corridor</span>
              <select className="input-shell bg-slate-900 border-white/10 text-white rounded-xl py-2 px-3 text-sm" onChange={(event) => loadAdmin(event.target.value)} value={selectedCorridor}>
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
      </Reveal>

      {error ? <div className="status-banner error">{error}</div> : null}
      {banner ? <div className="status-banner success">{banner}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="metric-tile border-white/5 bg-[var(--bg-surface)] p-5 rounded-[24px]">
          <p className="text-xs text-slate-500 font-semibold uppercase">Governed units</p>
          <strong className="text-2xl text-white block mt-1">{stats.total}</strong>
          <span className="text-xs text-slate-400 mt-1 block">Total units in current corridor view.</span>
        </article>
        <article className="metric-tile border-white/5 bg-[var(--bg-surface)] p-5 rounded-[24px]">
          <p className="text-xs text-slate-500 font-semibold uppercase">Pending review</p>
          <strong className="text-2xl text-white block mt-1">{stats.pending}</strong>
          <span className="text-xs text-slate-400 mt-1 block">Units awaiting approval or rejection.</span>
        </article>
        <article className="metric-tile border-white/5 bg-[var(--bg-surface)] p-5 rounded-[24px]">
          <p className="text-xs text-slate-500 font-semibold uppercase">Suspended</p>
          <strong className="text-2xl text-white block mt-1">{stats.suspended}</strong>
          <span className="text-xs text-slate-400 mt-1 block">Units blocked by governance action.</span>
        </article>
        <article className="metric-tile border-white/5 bg-[var(--bg-surface)] p-5 rounded-[24px]">
          <p className="text-xs text-slate-500 font-semibold uppercase">Audit queue</p>
          <strong className="text-2xl text-white block mt-1">{stats.audits}</strong>
          <span className="text-xs text-slate-400 mt-1 block">Complaint or signal-driven audit pressure.</span>
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <article className="glass-panel p-6 rounded-[24px] bg-[var(--bg-surface)] border border-white/5 space-y-4">
          <div className="eyebrow">Create Corridor</div>
          <div className="grid gap-3">
            <input className="input-shell bg-slate-900 border-white/10 text-white rounded-xl py-1.5 px-3 text-xs" onChange={(event) => setCorridorForm((current) => ({ ...current, name: event.target.value }))} placeholder="Corridor name" value={corridorForm.name} />
            <input className="input-shell bg-slate-900 border-white/10 text-white rounded-xl py-1.5 px-3 text-xs" onChange={(event) => setCorridorForm((current) => ({ ...current, cityCode: event.target.value }))} placeholder="City code" value={corridorForm.cityCode} />
            <button className="btn-primary w-full text-xs py-2 font-bold tracking-wider" onClick={handleCreateCorridor} type="button">Create corridor</button>
          </div>
        </article>

        <article className="glass-panel p-6 rounded-[24px] bg-[var(--bg-surface)] border border-white/5 space-y-4">
          <div className="eyebrow">Create Institution</div>
          <div className="grid gap-3">
            <input className="input-shell bg-slate-900 border-white/10 text-white rounded-xl py-1.5 px-3 text-xs" onChange={(event) => setInstitutionForm((current) => ({ ...current, name: event.target.value }))} placeholder="Institution name" value={institutionForm.name} />
            <select className="input-shell bg-slate-900 border-white/10 text-white rounded-xl py-1.5 px-3 text-xs" onChange={(event) => setInstitutionForm((current) => ({ ...current, corridorId: event.target.value }))} value={institutionForm.corridorId}>
              <option value="">Select corridor</option>
              {corridors.map((corridor) => (
                <option key={corridor.id} value={corridor.id}>
                  {corridor.name}
                </option>
              ))}
            </select>
            <button className="btn-primary w-full text-xs py-2 font-bold tracking-wider" onClick={handleCreateInstitution} type="button">Create institution</button>
          </div>
        </article>

        <article className="glass-panel p-6 rounded-[24px] bg-[var(--bg-surface)] border border-white/5 space-y-4">
          <div className="eyebrow">Workflow Reminder</div>
          <div className="grid gap-3 text-xs text-slate-300">
            <div className="rounded-xl border border-white/5 bg-white/5 p-3 leading-relaxed">Approve only when structural, operational, and trust requirements justify student visibility.</div>
            <div className="rounded-xl border border-white/5 bg-white/5 p-3 leading-relaxed">Suspend when system-triggered reasons indicate risk escalation or unresolved audit pressure.</div>
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr,0.85fr]">
        <article className="glass-panel p-6 rounded-[24px] bg-[var(--bg-surface)] border border-white/5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Unit Decisions</div>
              <h2 className="section-title mt-2">Approve, reject, or suspend with reason</h2>
            </div>
            <Link className="btn-secondary text-xs py-1.5 px-3 font-semibold" href="/dashboard">Back to dashboard</Link>
          </div>
          <div className="grid gap-4 mt-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => <div key={index} className="surface-panel h-40 animate-pulse bg-stone-850 rounded-xl" />)
            ) : units.length ? (
              units.map((unit) => {
                const isExpanded = expandedAdminUnitId === unit.id;
                return (
                  <article key={unit.id} className="rounded-xl border border-white/5 bg-white/5 p-4 space-y-3">
                    <div 
                      className="flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
                      onClick={() => setExpandedAdminUnitId(isExpanded ? null : unit.id)}
                    >
                      <div>
                        <strong className="text-white text-sm">Unit {unit.id}</strong>
                        <p className="mt-1 text-xs text-slate-400">
                          Reason: {unit.auditRequired ? "Auto-flagged due to audit pressure" : `Awaiting governance status decision for ${unit.status}.`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusTone(unit.status)}`}>{unit.status}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getTrustBand(unit.trustScore).tone}`}>{getTrustBand(unit.trustScore).label}</span>
                        <span className="text-xs text-sky-400 font-semibold">{isExpanded ? "Hide Actions" : "Manage"}</span>
                      </div>
                    </div>

                    <Expand isExpanded={isExpanded}>
                      <div className="pt-3 mt-3 border-t border-white/5 flex flex-wrap gap-3">
                        <button className="btn-primary text-xs py-1 px-4 font-bold tracking-wider bg-emerald-600 border-emerald-500" onClick={() => handleStatus(unit.id, "approved")} type="button">Approve Discovery</button>
                        <button className="btn-secondary text-xs py-1 px-4 font-bold tracking-wider bg-rose-900 border-rose-800" onClick={() => handleStatus(unit.id, "rejected")} type="button">Reject Discovery</button>
                        <button className="btn-secondary text-xs py-1 px-4 font-bold tracking-wider" onClick={() => handleStatus(unit.id, "suspended")} type="button">Suspend Unit</button>
                      </div>
                    </Expand>
                  </article>
                );
              })
            ) : (
              <div className="empty-state">No units currently require action.</div>
            )}
          </div>
        </article>

        <article className="glass-panel p-6 rounded-[24px] bg-[var(--bg-surface)] border border-white/5 space-y-4">
          <div className="eyebrow">Audit Queue</div>
          <h2 className="section-title mt-2">Complaint clusters and triggers</h2>
          <div className="grid gap-4 mt-4">
            {auditQueue.length ? (
              auditQueue.map((unit) => (
                <div key={unit.id} className="rounded-xl border border-white/5 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <strong className="text-white">Unit {unit.id}</strong>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">Audit required</span>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">Trust score: {unit.trustScore || 0}</p>
                  <p className="text-xs text-slate-400 mt-1">Current status: {unit.status}</p>
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


