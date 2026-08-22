"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ComplaintForm from "@/components/ComplaintForm";
import UnitCard from "@/components/UnitCard";
import {
  createUnit,
  getAdminAuditQueue,
  getAdminDemand,
  getAdminUnits,
  getCorridorDemand,
  getCorridorOverview,
  getCorridors,
  getDawnInsights,
  getHiddenReasons,
  getLandlordUnits,
  getProfile,
  getUnits,
  getAdminPayments,
  overridePayment,
  getAdminCompliance,
  verifyCompliance,
  getAdminAgreements,
  terminateAgreement,
  getAdminAnalytics,
} from "@/lib/api";
import { getRiskTone, getStatusTone, getTrustBand } from "@/lib/governance";
import { getStoredRole } from "@/lib/session";
import DawnAnalyticsViewer from "@/components/DawnAnalyticsViewer";
import { FadeIn, Reveal, Expand } from "@/components/ui/Motion";


function InsightCards({ insights }) {
  if (!insights.length) return null;

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {insights.slice(0, 3).map((insight, index) => (
        <article key={`${insight.title || insight.type}-${index}`} className="glass-panel p-5">
          <div className="flex items-center gap-2">
            <span className={`signal-chip ${getRiskTone(insight.riskLevel || insight.severity)}`}>
              {insight.type || "Insight"}
            </span>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-white">{insight.title || "Operational insight"}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">{insight.message || insight.body || insight.summary}</p>
          {insight.recommendation ? <p className="mt-3 text-sm text-emerald-200">Recommended action: {insight.recommendation}</p> : null}
        </article>
      ))}
    </section>
  );
}

function StudentDashboard({
  corridors,
  corridorId,
  setCorridorId,
  filters,
  setFilters,
  visibleUnits,
  hiddenReasons,
  corridorOverview,
  demand,
  reload,
  insights,
  loading,
  error,
}) {
  const averageTrust = corridorOverview?.stats?.averageTrustScore || 0;
  const riskLevel = corridorOverview?.riskSummary?.riskLevel || "Stable";
  const visibleCount = corridorOverview?.stats?.visibleUnits || visibleUnits.length || 0;
  const hiddenCount = corridorOverview?.stats?.hiddenUnits || hiddenReasons?.hiddenCount || 0;

  function humanizeHiddenReason(reason) {
    const normalized = String(reason || "").toLowerCase();
    if (normalized.includes("audit")) return "Hidden because safety checks failed or are still under review.";
    if (normalized.includes("trust")) return "Hidden because trust signals dropped below the safe visibility level.";
    if (normalized.includes("status")) return "Hidden because approval is still pending.";
    if (normalized.includes("complaint")) return "Hidden because recent complaints raised safety concerns.";
    return "Hidden until safety and trust checks improve.";
  }

  return (
    <div className="grid gap-6">
      <section className="governance-grid">
        <div className="glass-panel-strong blueprint-border lg:col-span-8 p-8 sm:p-10">
          <div className="eyebrow">Student Governance View</div>
          <h1 className="page-title mt-5 text-gradient">Choose from units that meet safety and trust standards</h1>
          <p className="subtle-copy mt-4 max-w-3xl">
            Browse options that are currently verified, safe to review, and still meeting the trust checks used across this area.
          </p>

          <div className="mt-8">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Refine your options</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Corridor</span>
              <select className="input-shell" onChange={(event) => setCorridorId(event.target.value)} value={corridorId}>
                <option value="">Select corridor</option>
                {corridors.map((corridor) => (
                  <option key={corridor.id} value={corridor.id}>
                    {corridor.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Max rent</span>
              <input className="input-shell" onChange={(event) => setFilters((current) => ({ ...current, maxRent: event.target.value }))} type="number" value={filters.maxRent} />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Max distance</span>
              <input className="input-shell" onChange={(event) => setFilters((current) => ({ ...current, maxDistance: event.target.value }))} type="number" value={filters.maxDistance} />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>AC filter</span>
              <select className="input-shell" onChange={(event) => setFilters((current) => ({ ...current, ac: event.target.value }))} value={filters.ac}>
                <option value="">Any</option>
                <option value="true">AC only</option>
                <option value="false">No AC</option>
              </select>
            </label>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-primary" onClick={reload} type="button">
              Apply filters
            </button>
            <div className="status-banner info">
              Only verified, safe units are shown.
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:col-span-4">
          <div className="metric-tile">
            <p>Units visible</p>
            <strong>{visibleUnits.length}</strong>
            <span>Current inventory above trust and governance threshold.</span>
          </div>
          <div className="metric-tile">
            <p>Units hidden</p>
            <strong>{hiddenReasons?.hiddenCount || 0}</strong>
            <span>Excluded because trust, status, or audit posture blocked visibility.</span>
          </div>
          <div className="metric-tile">
            <p>Avg corridor trust</p>
            <strong>{averageTrust}</strong>
            <span>Computed from all units in the selected corridor.</span>
          </div>
        </div>
      </section>

      {error ? <div className="status-banner error">{error}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1.5fr,1fr]">
        <article className="glass-panel p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Trust Visibility Panel</div>
              <h2 className="section-title mt-4">Available units</h2>
            </div>
            <span className={`signal-chip ${getRiskTone(riskLevel)}`}>{riskLevel} corridor risk</span>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => <div key={index} className="surface-panel h-64 animate-pulse" />)
            ) : visibleUnits.length ? (
              visibleUnits.map((unit) => <UnitCard key={unit.id} onShortlist={reload} showForStudent unit={unit} />)
            ) : (
              <div className="empty-state md:col-span-2">No units meet trust threshold in this corridor.</div>
            )}
          </div>
        </article>

        <div className="grid gap-4">
          <article className="glass-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow">Corridor Intelligence</div>
                <h2 className="section-title mt-4">Area insights</h2>
              </div>
              <span className={`signal-chip ${getRiskTone(riskLevel)}`}>{riskLevel}</span>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Few complaints reported</p>
                <strong className="mt-2 block text-2xl text-white">{corridorOverview?.riskSummary?.complaintDensity || 0}</strong>
                <span className="mt-2 block text-sm leading-6 text-slate-400">A lower number usually means fewer reported issues nearby.</span>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Most units are visible</p>
                <strong className="mt-2 block text-2xl text-white">
                  {visibleCount}/{hiddenCount}
                </strong>
                <span className="mt-2 block text-sm leading-6 text-slate-400">More visible units usually means the area is passing more checks.</span>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Students looking in this area</p>
                <strong className="mt-2 block text-2xl text-white">{demand?.totalVdpStudents || 0}</strong>
                <span className="mt-2 block text-sm leading-6 text-slate-400">Higher interest can mean stronger demand for the safest options.</span>
              </div>
            </div>
          </article>

          <details className="glass-panel p-6" open={Boolean(hiddenReasons?.hiddenCount)}>
            <summary className="cursor-pointer list-none">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="eyebrow">Hidden Units</div>
                  <h2 className="section-title mt-4">Why some options are hidden</h2>
                </div>
                <span className="signal-chip signal-danger">{hiddenReasons?.hiddenCount || 0} hidden</span>
              </div>
            </summary>
            <div className="mt-5 grid gap-3">
              {(hiddenReasons?.hiddenUnits || []).map((item) => (
                <div key={item.unitId} className="rounded-[24px] border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-white">Unit {item.unitId}</strong>
                    <span className="signal-chip signal-danger">Hidden</span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {(item.reasons || []).map((reason) => (
                      <div key={reason} className="text-sm leading-6 text-slate-300">
                        {humanizeHiddenReason(reason)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!hiddenReasons?.hiddenUnits?.length ? <div className="empty-state">No hidden units in this corridor.</div> : null}
            </div>
          </details>
        </div>
      </section>

      {insights.length ? <InsightCards insights={insights} /> : null}

      <ComplaintForm />
    </div>
  );
}

function LandlordDashboard({ units, corridors, createForm, setCreateForm, onCreateUnit, creatingUnit, insights, error }) {
  const averageTrust =
    units.length === 0 ? 0 : (units.reduce((sum, unit) => sum + Number(unit.trustScore || 0), 0) / units.length).toFixed(1);
  const complaintDensity = units.reduce((sum, unit) => sum + Number(unit.activeComplaints || 0), 0);
  const slaRiskUnits = units.filter((unit) => Number(unit.slaLateCount || 0) > 0).length;

  return (
    <div className="grid gap-6">
      <section className="governance-grid">
        <div className="glass-panel-strong blueprint-border lg:col-span-8 p-8 sm:p-10">
          <div className="eyebrow">Landlord Governance View</div>
          <h1 className="page-title mt-5 text-gradient">Portfolio trust is your operating system.</h1>
          <p className="subtle-copy mt-4 max-w-3xl">
            Evidence quality, complaint density, and SLA performance determine how your units appear to students and how
            quickly governance pressure builds.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Corridor</span>
              <select className="input-shell" onChange={(event) => setCreateForm((current) => ({ ...current, corridorId: event.target.value }))} value={createForm.corridorId}>
                <option value="">Select corridor</option>
                {corridors.map((corridor) => (
                  <option key={corridor.id} value={corridor.id}>
                    {corridor.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Rent</span>
              <input className="input-shell" onChange={(event) => setCreateForm((current) => ({ ...current, rent: event.target.value }))} type="number" value={createForm.rent} />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Distance</span>
              <input className="input-shell" onChange={(event) => setCreateForm((current) => ({ ...current, distanceKm: event.target.value }))} type="number" value={createForm.distanceKm} />
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Capacity</span>
              <input className="input-shell" onChange={(event) => setCreateForm((current) => ({ ...current, capacity: event.target.value }))} type="number" value={createForm.capacity} />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-primary" disabled={creatingUnit || !createForm.corridorId} onClick={onCreateUnit} type="button">
              {creatingUnit ? "Creating draft..." : "Create governed unit"}
            </button>
            <div className="status-banner info">Drafts remain invisible until checklists, evidence, and governance review are complete.</div>
          </div>
        </div>

        <div className="grid gap-4 lg:col-span-4">
          <div className="metric-tile">
            <p>Portfolio trust</p>
            <strong>{averageTrust}</strong>
            <span>Average trust score across all managed units.</span>
          </div>
          <div className="metric-tile">
            <p>Complaint density</p>
            <strong>{complaintDensity}</strong>
            <span>Total active complaint pressure across the portfolio.</span>
          </div>
          <div className="metric-tile">
            <p>SLA at risk</p>
            <strong>{slaRiskUnits}</strong>
            <span>Units with late complaint resolution exposure.</span>
          </div>
        </div>
      </section>

      {error ? <div className="status-banner error">{error}</div> : null}
      <InsightCards insights={insights} />

      <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        {units.length ? units.map((unit) => <UnitCard key={unit.id} compact unit={unit} />) : <div className="empty-state lg:col-span-2 xl:col-span-3">No units have been created for this landlord yet.</div>}
      </section>
    </div>
  );
}

function AdminDashboard({
  corridors,
  selectedCorridor,
  setSelectedCorridor,
  units,
  auditQueue,
  demand,
  insights,
  error,
  adminPayments = [],
  reloadPayments,
  adminCompliance = [],
  adminAgreements = [],
  verifyActionId,
  setVerifyActionId,
  verifyReason,
  setVerifyReason,
  terminateActionId,
  setTerminateActionId,
  terminateReason,
  setTerminateReason,
  onVerifyCompliance,
  onTerminateAgreement,
  adminAnalytics,
}) {
  const [overrideId, setOverrideId] = useState(null);
  const [overrideForm, setOverrideForm] = useState({ status: "", amount: "", receiptRef: "", reason: "" });
  const [overrideError, setOverrideError] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [expandedAuditId, setExpandedAuditId] = useState(null);
  const [expandedAdminPaymentId, setExpandedAdminPaymentId] = useState(null);
  const [expandedAdminComplianceId, setExpandedAdminComplianceId] = useState(null);
  const [expandedAdminAgreementId, setExpandedAdminAgreementId] = useState(null);

  async function handleOverride(paymentId) {
    if (!overrideForm.reason.trim()) {
      setOverrideError("A reason is mandatory for administrative overrides.");
      return;
    }
    setOverrideError("");
    setOverrideLoading(true);
    try {
      await overridePayment(paymentId, {
        status: overrideForm.status || undefined,
        amount: overrideForm.amount ? Number(overrideForm.amount) : undefined,
        receiptRef: overrideForm.receiptRef || undefined,
        reason: overrideForm.reason.trim(),
      });
      setOverrideId(null);
      setOverrideForm({ status: "", amount: "", receiptRef: "", reason: "" });
      if (reloadPayments) await reloadPayments();
    } catch (err) {
      setOverrideError(err.message || "Override failed.");
    } finally {
      setOverrideLoading(false);
    }
  }

  const trustDistribution = [
    units.filter((unit) => getTrustBand(unit.trustScore).key === "A").length,
    units.filter((unit) => getTrustBand(unit.trustScore).key === "B").length,
    units.filter((unit) => getTrustBand(unit.trustScore).key === "C").length,
  ];
  const selectedCorridorMeta = corridors.find((corridor) => String(corridor.id) === String(selectedCorridor));

  function governanceActionLabel(unit) {
    if (unit.auditRequired) return "Review audit escalation";
    if (unit.status === "submitted" || unit.status === "admin_review") return "Complete governance review";
    if (unit.status === "suspended") return "Resolve suspension status";
    if (unit.status === "rejected") return "Confirm rejection outcome";
    return `Review ${unit.status || "governance"} status`;
  }

  function pressureSeverity(unit) {
    const trustScore = Number(unit?.trustScore || 0);
    if (unit?.auditRequired || trustScore < 45) return { label: "High", width: Math.max(trustScore, 72) };
    if (trustScore < 75) return { label: "Medium", width: Math.max(trustScore, 48) };
    return { label: "Low", width: Math.max(trustScore, 26) };
  }

  return (
    <div className="grid gap-8">
      <Reveal duration={0.5}>
        <section className="governance-grid">
          <div className="glass-panel-strong blueprint-border lg:col-span-8 p-7 sm:p-8 bg-[var(--bg-surface-strong)] rounded-[24px]">
            <div className="eyebrow">Admin Governance View</div>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl text-gradient">
              Act on corridor risk before visibility slips.
            </h1>
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-slate-300">
              Review trust distribution, clear complaint escalation, and push the next governance action for units drifting
              toward suspension or hidden status.
            </p>

            <div className="mt-8 max-w-sm">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.22em] text-slate-500 font-semibold">Active Corridor</span>
                <select className="input-shell bg-slate-900 border-white/10 text-white rounded-xl py-2 px-3 text-sm" onChange={(event) => setSelectedCorridor(event.target.value)} value={selectedCorridor}>
                  <option value="">Select corridor</option>
                  {corridors.map((corridor) => (
                    <option key={corridor.id} value={corridor.id}>
                      {corridor.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs leading-5 text-slate-400">
                  {selectedCorridorMeta ? `${units.length} governed units in ${selectedCorridorMeta.name}` : `${units.length} governed units in view`}
                </span>
              </label>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 font-semibold">Corridor heatmap</p>
                <strong className="mt-2 block text-2xl text-white">{demand?.totalVdpStudents || 0}</strong>
                <span className="mt-2 block text-sm leading-6 text-slate-400">Verified demand concentration in the selected corridor.</span>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 font-semibold">Complaint clusters</p>
                <strong className="mt-2 block text-2xl text-white">{auditQueue.length}</strong>
                <span className="mt-2 block text-sm leading-6 text-slate-400">Units already escalated into governance review.</span>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 font-semibold">Trust distribution</p>
                <strong className="mt-2 block text-2xl text-white">{units.length}</strong>
                <span className="mt-2 block text-sm leading-6 text-slate-400">Governed units included in the trust split below.</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:col-span-4">
            <div className="metric-tile border-white/5 bg-[var(--bg-surface)] rounded-[24px] p-5">
              <p className="text-xs uppercase text-slate-500 font-semibold">Band A</p>
              <strong className="text-[2.4rem] text-white block mt-1">{trustDistribution[0]}</strong>
              <span className="text-xs text-slate-400 mt-1 block"><span className="font-semibold text-emerald-400">Stable.</span> Strong trust standing.</span>
            </div>
            <div className="metric-tile border-white/5 bg-[var(--bg-surface)] rounded-[24px] p-5">
              <p className="text-xs uppercase text-slate-500 font-semibold">Band B</p>
              <strong className="text-[2.55rem] text-white block mt-1">{trustDistribution[1]}</strong>
              <span className="text-xs text-slate-400 mt-1 block"><span className="font-semibold text-amber-400">Monitor.</span> Visible, but under active monitoring.</span>
            </div>
            <div className="metric-tile border-white/5 bg-[var(--bg-surface)] rounded-[24px] p-5">
              <p className="text-xs uppercase text-slate-500 font-semibold">Band C</p>
              <strong className="text-[2.7rem] text-white block mt-1">{trustDistribution[2]}</strong>
              <span className="text-xs text-slate-400 mt-1 block"><span className="font-semibold text-rose-400">Needs attention.</span> Below threshold or at risk.</span>
            </div>
            <div className="rounded-[24px] border border-white/5 bg-white/5 p-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500 font-semibold">Risk Alert</p>
              <p className="mt-3 text-base font-semibold leading-6 text-white">
                ⚠️ {auditQueue.length > 0 ? `${auditQueue.length} unit${auditQueue.length === 1 ? "" : "s"} need immediate governance review.` : "No urgent corridor escalation right now."}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {auditQueue.length > 0 ? "Action required" : "Stable"}: complaint and audit pressure should be reviewed before visibility degrades.
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      {error ? <div className="status-banner error">{error}</div> : null}
      <InsightCards insights={insights} />

      {adminAnalytics && (
        <section className="glass-panel p-6 rounded-[24px] bg-[var(--bg-surface)] border border-white/5">
          <h2 className="text-lg font-bold text-white mb-4">DAWN Portfolio Analytics</h2>
          <DawnAnalyticsViewer analytics={adminAnalytics} />
        </section>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
        <article className="glass-panel p-6 rounded-[24px] bg-[var(--bg-surface)] border border-white/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Governance Queue</div>
              <h2 className="section-title mt-2">Units requiring decisions</h2>
            </div>
          </div>
          <div className="mt-6 grid gap-4">
            {units.length ? (
              units.map((unit) => (
                <Link
                  key={unit.id}
                  href={`/unit/${unit.id}`}
                  className="rounded-xl border border-white/5 bg-white/5 p-4 transition-all hover:bg-white/10"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <div>
                      <strong className="text-white">Unit {unit.id} | {governanceActionLabel(unit)}</strong>
                      <p className="mt-1 text-xs text-slate-400">
                        {unit.auditRequired
                          ? "Action required: audit pressure is blocking a clean governance state."
                          : unit.status === "submitted" || unit.status === "admin_review"
                            ? "Monitoring: this unit is waiting for the next approval decision."
                            : `Stable check: current status is ${unit.status}.`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        {unit.auditRequired ? "Action required" : unit.status === "submitted" || unit.status === "admin_review" ? "Monitoring" : "Stable"}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusTone(unit.status)}`}>{unit.status}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getTrustBand(unit.trustScore).tone}`}>{getTrustBand(unit.trustScore).label}</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty-state">No units currently require governance review.</div>
            )}
          </div>
        </article>

        <article className="glass-panel p-6 rounded-[24px] bg-[var(--bg-surface)] border border-white/5">
          <div className="eyebrow">Audit Queue</div>
          <h2 className="section-title mt-2">Complaint and audit pressure</h2>
          <div className="mt-6 grid gap-4">
            {auditQueue.length ? (
              auditQueue.map((unit) => (
                <Link
                  key={unit.id}
                  href={`/unit/${unit.id}`}
                  className="rounded-xl border border-white/5 bg-black/20 p-4 transition-all hover:bg-black/30"
                >
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <strong className="text-white">Unit {unit.id}</strong>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300">Audit required</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
                    <p className="uppercase tracking-[0.18em]">Complaint + audit pressure</p>
                    <span className="font-medium text-slate-200">{pressureSeverity(unit).label} severity</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-900">
                    <div className={`h-full ${getTrustBand(unit.trustScore).fillClass || "bg-rose-500"}`} style={{ width: `${pressureSeverity(unit).width}%` }} />
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Trust {unit.trustScore || 0} • Status {unit.status}
                  </p>
                </Link>
              ))
            ) : (
              <div className="empty-state">No risk detected in this corridor.</div>
            )}
          </div>
        </article>
      </section>

      {/* Admin Payment Management */}
      <section className="glass-panel p-6 rounded-[24px] bg-[var(--bg-surface)] border border-white/5">
        <div className="eyebrow">Governance & Ledgers</div>
        <h2 className="section-title mt-2">Rent Ledger Override Controls</h2>
        <p className="subtle-copy mt-1">
          Perform administrative updates to student payments, update amounts, check receipt references, and log changes to the audit trail.
        </p>

        {overrideError && <div className="status-banner error mt-4">{overrideError}</div>}

        {adminPayments.length === 0 ? (
          <p className="text-sm text-slate-400 mt-4">No rent records found across all corridors.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {adminPayments.map((payment) => {
              const isExpanded = expandedAdminPaymentId === payment.id;
              return (
                <div key={payment.id} className="rounded-xl border border-white/5 bg-black/10 overflow-hidden text-sm">
                  <div 
                    className="grid grid-cols-1 sm:grid-cols-5 items-center gap-2 p-3 cursor-pointer select-none"
                    onClick={() => setExpandedAdminPaymentId(isExpanded ? null : payment.id)}
                  >
                    <div className="font-semibold text-slate-200">
                      {payment.occupancy?.student?.name || "Unknown"}
                    </div>
                    <div className="text-slate-300">Unit #{payment.occupancy?.unit?.id}</div>
                    <div className="text-slate-300">{payment.month}</div>
                    <div className="text-slate-200">₹{payment.amount}</div>
                    <div className="flex justify-between sm:block">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        payment.status === "VERIFIED"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : payment.status === "PAID"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-rose-500/20 text-rose-300"
                      }`}>
                        {payment.status}
                      </span>
                      <span className="text-xs text-sky-400 font-semibold sm:hidden">{isExpanded ? "Hide" : "Override"}</span>
                    </div>
                  </div>

                  <Expand isExpanded={isExpanded}>
                    <div className="p-4 bg-black/30 border-t border-white/5 space-y-3 text-xs text-slate-300">
                      <div className="flex flex-wrap gap-4 justify-between items-center pb-2 border-b border-white/5">
                        <span>Receipt Ref: <span className="font-mono text-white">{payment.receiptRef || "—"}</span></span>
                        <div className="flex gap-2">
                          <button
                            className="btn-secondary text-[11px] py-1 px-3"
                            onClick={() => {
                              if (overrideId === payment.id) {
                                setOverrideId(null);
                              } else {
                                setOverrideId(payment.id);
                                setOverrideForm({
                                  status: payment.status,
                                  amount: String(payment.amount),
                                  receiptRef: payment.receiptRef || "",
                                  reason: "",
                                });
                              }
                            }}
                          >
                            {overrideId === payment.id ? "Cancel Override" : "Perform Override"}
                          </button>
                          {payment.audits && payment.audits.length > 0 && (
                            <button
                              className="text-xs text-slate-400 hover:underline font-semibold"
                              onClick={() => setExpandedAuditId(expandedAuditId === payment.id ? null : payment.id)}
                            >
                              Audits ({payment.audits.length})
                            </button>
                          )}
                        </div>
                      </div>

                      {overrideId === payment.id && (
                        <div className="mt-3 p-4 border border-white/10 rounded-xl bg-black/40 space-y-3 max-w-md">
                          <p className="text-xs uppercase font-semibold text-slate-300">Override Parameters</p>
                          <label className="grid gap-1">
                            <span className="text-[10px] uppercase text-slate-500">Status</span>
                            <select
                              className="input-shell text-xs py-1"
                              onChange={(e) => setOverrideForm((c) => ({ ...c, status: e.target.value }))}
                              value={overrideForm.status}
                            >
                              <option value="PENDING">PENDING</option>
                              <option value="PAID">PAID</option>
                              <option value="VERIFIED">VERIFIED</option>
                            </select>
                          </label>
                          <label className="grid gap-1">
                            <span className="text-[10px] uppercase text-slate-500">Amount</span>
                            <input
                              className="input-shell text-xs py-1"
                              onChange={(e) => setOverrideForm((c) => ({ ...c, amount: e.target.value }))}
                              type="number"
                              value={overrideForm.amount}
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-[10px] uppercase text-slate-500">Receipt Ref</span>
                            <input
                              className="input-shell text-xs py-1"
                              onChange={(e) => setOverrideForm((c) => ({ ...c, receiptRef: e.target.value }))}
                              value={overrideForm.receiptRef}
                            />
                          </label>
                          <label className="grid gap-1">
                            <span className="text-[10px] uppercase text-slate-500">Reason (Mandatory)</span>
                            <input
                              className="input-shell text-xs py-1 border-rose-500/50"
                              onChange={(e) => setOverrideForm((c) => ({ ...c, reason: e.target.value }))}
                              placeholder="Reason for change..."
                              value={overrideForm.reason}
                            />
                          </label>
                          <button
                            className="btn-primary text-xs py-1.5 px-3 w-full"
                            disabled={overrideLoading}
                            onClick={() => handleOverride(payment.id)}
                          >
                            {overrideLoading ? "Saving Override..." : "Save Override"}
                          </button>
                        </div>
                      )}

                      {expandedAuditId === payment.id && (
                        <div className="mt-3 p-3 border border-white/5 rounded-xl bg-black/40 space-y-2">
                          <p className="text-[10px] uppercase font-bold text-slate-500">Change History Audit Trail</p>
                          {payment.audits.map((audit) => (
                            <div key={audit.id} className="text-xs border-b border-white/5 pb-2 last:border-b-0 space-y-1">
                              <div className="flex justify-between text-[10px] text-slate-500">
                                <span>Actor: ID #{audit.actorId}</span>
                                <span>{new Date(audit.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="text-slate-300 font-semibold">{audit.action} | Reason: "{audit.reason}"</p>
                              {audit.changes && (
                                <pre className="text-[9px] bg-black/20 p-1.5 rounded font-mono text-slate-400 overflow-x-auto">
                                  {JSON.stringify(audit.changes, null, 2)}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Expand>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Compliance Verification Queue */}
      <section className="glass-panel p-6 rounded-[24px] bg-[var(--bg-surface)] border border-white/5 space-y-4">
        <div className="eyebrow">Governance & Compliance</div>
        <h2 className="section-title mt-2">Compliance Document Verification Queue</h2>
        <p className="subtle-copy mt-1">
          Review uploaded safety certificates and identity KYC uploads from landlords to activate or suspend unit discovery status.
        </p>

        {adminCompliance.length === 0 ? (
          <p className="text-sm text-slate-400 mt-4">No compliance documents pending review.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {adminCompliance.map((comp) => {
              const isExpanded = expandedAdminComplianceId === comp.id;
              return (
                <div key={comp.id} className="p-4 border border-white/5 rounded-xl bg-white/5 space-y-3 max-w-3xl">
                  <div 
                    className="flex justify-between items-center text-sm font-semibold text-slate-200 cursor-pointer"
                    onClick={() => setExpandedAdminComplianceId(isExpanded ? null : comp.id)}
                  >
                    <span>{comp.docType} | Unit #{comp.unitId}</span>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        comp.status === "APPROVED"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : comp.status === "REJECTED"
                          ? "bg-rose-500/20 text-rose-300"
                          : comp.status === "EXPIRED"
                          ? "bg-slate-500/20 text-slate-400"
                          : "bg-amber-500/20 text-amber-300"
                      }`}>
                        {comp.status}
                      </span>
                      <span className="text-xs text-sky-400">{isExpanded ? "Hide" : "Inspect"}</span>
                    </div>
                  </div>

                  <Expand isExpanded={isExpanded}>
                    <div className="space-y-3 pt-3 border-t border-white/5 text-xs text-slate-300">
                      <div className="space-y-1">
                        <div>File Name: <span className="font-semibold text-white">{comp.fileName}</span></div>
                        {comp.expiryDate && <div>Expiry Date: {new Date(comp.expiryDate).toLocaleDateString()}</div>}
                        <div>Uploaded: {new Date(comp.createdAt).toLocaleString()}</div>
                      </div>

                      <div className="flex flex-wrap gap-3 items-center justify-between pt-2">
                        <div>
                          <a
                            href={`/api/agreement/document/${comp.id}?compliance=true`}
                            className="text-xs text-sky-300 hover:underline font-semibold"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Stream Document File
                          </a>
                        </div>

                        <div className="flex gap-2">
                          {verifyActionId === comp.id ? (
                            <div className="flex flex-col gap-2 bg-black/40 p-3 rounded-xl border border-white/10 text-xs">
                              <label className="block text-slate-300">Rejection Reason (Required for rejection)</label>
                              <input
                                type="text"
                                className="input-shell text-xs py-1 px-2"
                                placeholder="Why is it rejected..."
                                value={verifyReason}
                                onChange={(e) => setVerifyReason(e.target.value)}
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className="text-slate-400 hover:underline"
                                  onClick={() => {
                                    setVerifyActionId(null);
                                    setVerifyReason("");
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="text-rose-300 hover:underline font-bold"
                                  onClick={() => onVerifyCompliance(comp.id, false)}
                                >
                                  Confirm Reject
                                </button>
                                <button
                                  type="button"
                                  className="text-emerald-300 hover:underline font-bold"
                                  onClick={() => onVerifyCompliance(comp.id, true)}
                                >
                                  Approve
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {comp.status === "PENDING" && (
                                <button
                                  className="text-xs text-sky-300 hover:underline font-semibold"
                                  onClick={() => {
                                    setVerifyActionId(comp.id);
                                    setVerifyReason("");
                                  }}
                                >
                                  Verify Upload
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Expand>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Tenancy Agreements Oversight */}
      <section className="glass-panel p-6 rounded-[24px] bg-[var(--bg-surface)] border border-white/5 space-y-4">
        <div className="eyebrow">Agreements & Audits</div>
        <h2 className="section-title mt-2">Global Tenancy Agreements Oversight</h2>
        <p className="subtle-copy mt-1">
          Review all current active, pending, or terminated student tenancy agreements across NearNest corridors.
        </p>

        {adminAgreements.length === 0 ? (
          <p className="text-sm text-slate-400 mt-4">No tenancy agreements created on the platform.</p>
        ) : (
          <div className="mt-6 space-y-4">
            {adminAgreements.map((agg) => {
              const isExpanded = expandedAdminAgreementId === agg.id;
              return (
                <div key={agg.id} className="p-4 border border-white/5 rounded-xl bg-white/5 space-y-3 max-w-3xl">
                  <div 
                    className="flex justify-between items-center text-sm font-semibold text-slate-200 cursor-pointer"
                    onClick={() => setExpandedAdminAgreementId(isExpanded ? null : agg.id)}
                  >
                    <span>Student: {agg.occupancy?.student?.name || "Occupant"} (v{agg.version})</span>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        agg.status === "ACTIVE"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : agg.status === "EXPIRED"
                          ? "bg-slate-500/20 text-slate-400"
                          : agg.status === "TERMINATED"
                          ? "bg-rose-500/20 text-rose-300"
                          : agg.status === "SUPERSEDED"
                          ? "bg-indigo-500/20 text-indigo-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}>
                        {agg.status}
                      </span>
                      <span className="text-xs text-sky-400">{isExpanded ? "Hide" : "Inspect"}</span>
                    </div>
                  </div>

                  <Expand isExpanded={isExpanded}>
                    <div className="space-y-3 pt-3 border-t border-white/5 text-xs text-slate-300">
                      <div className="grid grid-cols-2 gap-2 text-slate-400">
                        <div>Rent Amount: ₹{agg.rentAmount}/mo</div>
                        <div>Security Deposit: ₹{agg.securityDeposit}</div>
                        <div>Notice Period: {agg.noticePeriodDays} Days</div>
                        <div>Unit ID: #{agg.occupancy?.unit?.id || "N/A"}</div>
                        <div className="col-span-2">
                          Lease Period: {new Date(agg.startDate).toLocaleDateString()} - {new Date(agg.endDate).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 items-center justify-between pt-2 border-t border-white/5">
                        <div className="flex gap-4 text-[10px] text-slate-500">
                          <span>Tenant Signed: {agg.tenantSigned ? "Yes" : "No"}</span>
                          <span>Landlord Signed: {agg.landlordSigned ? "Yes" : "No"}</span>
                        </div>

                        <div className="flex gap-2">
                          {agg.documentPath && (
                            <a
                              href={`/api/agreement/document/${agg.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-sky-300 hover:underline font-semibold"
                            >
                              Download PDF
                            </a>
                          )}

                          {agg.status === "ACTIVE" && (
                            <>
                              {terminateActionId === agg.id ? (
                                <div className="flex flex-col gap-2 bg-black/40 p-3 rounded-xl border border-white/10 text-xs">
                                  <label className="block text-slate-300">Cancellation Reason (Mandatory)</label>
                                  <input
                                    type="text"
                                    className="input-shell text-xs py-1 px-2"
                                    placeholder="Why is it canceled..."
                                    value={terminateReason}
                                    onChange={(e) => setTerminateReason(e.target.value)}
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      className="text-slate-400 hover:underline"
                                      onClick={() => {
                                        setTerminateActionId(null);
                                        setTerminateReason("");
                                      }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="text-rose-300 hover:underline font-bold"
                                      onClick={() => onTerminateAgreement(agg.id)}
                                    >
                                      Confirm Terminate
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  className="text-xs text-rose-300 hover:underline font-semibold"
                                  onClick={() => {
                                    setTerminateActionId(agg.id);
                                    setTerminateReason("");
                                  }}
                                >
                                  Terminate Contract
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Expand>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [corridors, setCorridors] = useState([]);
  const [insights, setInsights] = useState([]);

  const [corridorId, setCorridorId] = useState("");
  const [selectedCorridor, setSelectedCorridor] = useState("");
  const [filters, setFilters] = useState({ maxRent: "", maxDistance: "", ac: "" });
  const [visibleUnits, setVisibleUnits] = useState([]);
  const [hiddenReasons, setHiddenReasons] = useState({ hiddenCount: 0, hiddenUnits: [] });
  const [corridorOverview, setCorridorOverview] = useState(null);
  const [demand, setDemand] = useState(null);
  const [landlordUnits, setLandlordUnits] = useState([]);
  const [adminUnits, setAdminUnitsState] = useState([]);
  const [auditQueue, setAuditQueue] = useState([]);
  const [adminPayments, setAdminPayments] = useState([]);
  const [adminCompliance, setAdminCompliance] = useState([]);
  const [adminAgreements, setAdminAgreements] = useState([]);
  const [verifyActionId, setVerifyActionId] = useState(null);
  const [verifyReason, setVerifyReason] = useState("");
  const [terminateActionId, setTerminateActionId] = useState(null);
  const [terminateReason, setTerminateReason] = useState("");
  const [creatingUnit, setCreatingUnit] = useState(false);
  const [createForm, setCreateForm] = useState({ corridorId: "", rent: "", distanceKm: "", capacity: "" });
  const [adminAnalytics, setAdminAnalytics] = useState(null);

  const studentQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.maxRent) params.set("maxRent", filters.maxRent);
    if (filters.maxDistance) params.set("maxDistance", filters.maxDistance);
    if (filters.ac) params.set("ac", filters.ac);
    return params.toString();
  }, [filters]);

  useEffect(() => {
    const storedRole = getStoredRole();
    setRole(storedRole);
    if (storedRole === "parent") {
      router.push("/parent/dashboard");
    }
  }, [router]);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (!role) return;

      try {
        const [corridorPayload, dawnPayload] = await Promise.all([
          getCorridors().catch(() => []),
          getDawnInsights().catch(() => ({ insights: [] })),
        ]);

        if (!active) return;

        const corridorList = Array.isArray(corridorPayload) ? corridorPayload : [];
        setCorridors(corridorList);
        setInsights(Array.isArray(dawnPayload?.insights) ? dawnPayload.insights : []);

        if (role === "admin" && !selectedCorridor && corridorList[0]) {
          setSelectedCorridor(String(corridorList[0].id));
        }
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load dashboard context.");
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [role, selectedCorridor]);

  async function reloadStudentData(nextCorridorId = corridorId) {
    if (!nextCorridorId) return;

    setLoading(true);
    setError("");
    try {
      const [unitPayload, hiddenPayload, overviewPayload, demandPayload] = await Promise.all([
        getUnits(nextCorridorId, studentQuery),
        getHiddenReasons(nextCorridorId),
        getCorridorOverview(nextCorridorId),
        getCorridorDemand(nextCorridorId),
      ]);

      setVisibleUnits(Array.isArray(unitPayload) ? unitPayload : []);
      setHiddenReasons(hiddenPayload || { hiddenCount: 0, hiddenUnits: [] });
      setCorridorOverview(overviewPayload || null);
      setDemand(demandPayload || null);
    } catch (requestError) {
      setError(requestError.message || "Unable to load student visibility data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadStudent() {
      if (role !== "student") return;
      setLoading(true);
      setError("");
      try {
        const profile = await getProfile();
        const nextCorridorId = String(profile?.identity?.corridorId || "");
        if (!active) return;
        setCorridorId(nextCorridorId);
        if (nextCorridorId) {
          await reloadStudentData(nextCorridorId);
        } else {
          setLoading(false);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError.message || "Unable to load student dashboard.");
          setLoading(false);
        }
      }
    }

    loadStudent();
    return () => {
      active = false;
    };
  }, [role, studentQuery]);

  useEffect(() => {
    let active = true;

    async function loadLandlord() {
      if (role !== "landlord") return;
      setLoading(true);
      setError("");
      try {
        const payload = await getLandlordUnits();
        if (!active) return;
        const list = Array.isArray(payload) ? payload : [];
        setLandlordUnits(list);
        if (!createForm.corridorId && list[0]?.corridorId) {
          setCreateForm((current) => ({ ...current, corridorId: String(list[0].corridorId) }));
        }
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load landlord dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadLandlord();
    return () => {
      active = false;
    };
  }, [role]);

  useEffect(() => {
    let active = true;

    async function loadAdmin() {
      if (role !== "admin" || !selectedCorridor) return;
      setLoading(true);
      setError("");
      try {
        const [unitsPayload, auditPayload, demandPayload, paymentsPayload, compliancePayload, agreementPayload, analyticsPayload] = await Promise.all([
          getAdminUnits(selectedCorridor),
          getAdminAuditQueue(selectedCorridor),
          getAdminDemand(selectedCorridor).catch(() => null),
          getAdminPayments().catch(() => []),
          getAdminCompliance().catch(() => []),
          getAdminAgreements().catch(() => []),
          getAdminAnalytics().catch(() => null),
        ]);
        if (!active) return;
        setAdminUnitsState(Array.isArray(unitsPayload) ? unitsPayload : []);
        setAuditQueue(Array.isArray(auditPayload) ? auditPayload : []);
        setDemand(demandPayload || null);
        setAdminPayments(Array.isArray(paymentsPayload) ? paymentsPayload : []);
        setAdminCompliance(Array.isArray(compliancePayload) ? compliancePayload : []);
        setAdminAgreements(Array.isArray(agreementPayload) ? agreementPayload : []);
        setAdminAnalytics(analyticsPayload);
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load admin governance data.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAdmin();
    return () => {
      active = false;
    };
  }, [role, selectedCorridor]);

  async function handleCreateUnit() {
    setCreatingUnit(true);
    setError("");
    try {
      await createUnit({
        corridorId: Number(createForm.corridorId),
        rent: createForm.rent ? Number(createForm.rent) : undefined,
        distanceKm: createForm.distanceKm ? Number(createForm.distanceKm) : undefined,
        capacity: createForm.capacity ? Number(createForm.capacity) : undefined,
      });
      const payload = await getLandlordUnits();
      setLandlordUnits(Array.isArray(payload) ? payload : []);
      setCreateForm((current) => ({ ...current, rent: "", distanceKm: "", capacity: "" }));
    } catch (requestError) {
      setError(requestError.message || "Unable to create unit draft.");
    } finally {
      setCreatingUnit(false);
    }
  }

  async function handleVerifyCompliance(complianceId, approve) {
    setError("");
    try {
      await verifyCompliance(complianceId, { approve, reason: verifyReason });
      setVerifyActionId(null);
      setVerifyReason("");
      const [compRes, unitsPayload] = await Promise.all([
        getAdminCompliance().catch(() => []),
        getAdminUnits(selectedCorridor).catch(() => []),
      ]);
      setAdminCompliance(compRes);
      setAdminUnitsState(unitsPayload);
    } catch (err) {
      setError(err.message || "Failed to verify compliance document");
    }
  }

  async function handleTerminateAgreement(agreementId) {
    setError("");
    try {
      await terminateAgreement(agreementId, { reason: terminateReason });
      setTerminateActionId(null);
      setTerminateReason("");
      const refreshed = await getAdminAgreements().catch(() => []);
      setAdminAgreements(refreshed);
    } catch (err) {
      setError(err.message || "Failed to terminate agreement");
    }
  }

  if (role === "student") {
    return (
      <StudentDashboard
        corridorId={corridorId}
        corridorOverview={corridorOverview}
        corridors={corridors}
        demand={demand}
        error={error}
        filters={filters}
        hiddenReasons={hiddenReasons}
        insights={insights}
        loading={loading}
        reload={() => reloadStudentData()}
        setCorridorId={(value) => {
          setCorridorId(value);
          reloadStudentData(value);
        }}
        setFilters={setFilters}
        visibleUnits={visibleUnits}
      />
    );
  }

  if (role === "landlord") {
    return (
      <LandlordDashboard
        corridors={corridors}
        createForm={createForm}
        creatingUnit={creatingUnit}
        error={error}
        insights={insights}
        onCreateUnit={handleCreateUnit}
        setCreateForm={setCreateForm}
        units={landlordUnits}
      />
    );
  }

  return (
    <AdminDashboard
      auditQueue={auditQueue}
      corridors={corridors}
      demand={demand}
      error={error}
      insights={insights}
      selectedCorridor={selectedCorridor}
      setSelectedCorridor={setSelectedCorridor}
      units={adminUnits}
      adminPayments={adminPayments}
      reloadPayments={async () => {
        const refreshed = await getAdminPayments().catch(() => []);
        setAdminPayments(refreshed);
      }}
      adminCompliance={adminCompliance}
      adminAgreements={adminAgreements}
      verifyActionId={verifyActionId}
      setVerifyActionId={setVerifyActionId}
      verifyReason={verifyReason}
      setVerifyReason={setVerifyReason}
      terminateActionId={terminateActionId}
      setTerminateActionId={setTerminateActionId}
      terminateReason={terminateReason}
      setTerminateReason={setTerminateReason}
      onVerifyCompliance={handleVerifyCompliance}
      onTerminateAgreement={handleTerminateAgreement}
      adminAnalytics={adminAnalytics}
    />
  );
}
