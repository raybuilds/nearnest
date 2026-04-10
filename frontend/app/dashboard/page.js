"use client";

import Link from "next/link";
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
} from "@/lib/api";
import { getRiskTone, getStatusTone, getTrustBand } from "@/lib/governance";
import { getStoredRole } from "@/lib/session";

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

function AdminDashboard({ corridors, selectedCorridor, setSelectedCorridor, units, auditQueue, demand, insights, error }) {
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
      <section className="governance-grid">
        <div className="glass-panel-strong blueprint-border lg:col-span-8 p-7 sm:p-8">
          <div className="eyebrow">Admin Governance View</div>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-5xl" style={{ color: "var(--text-main)" }}>
            Act on corridor risk before visibility slips.
          </h1>
          <p className="mt-4 max-w-3xl text-[15px] leading-7" style={{ color: "var(--text-muted)" }}>
            Review trust distribution, clear complaint escalation, and push the next governance action for units drifting
            toward suspension or hidden status.
          </p>

          <div className="mt-8 max-w-sm">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Active Corridor</span>
              <select className="input-shell" onChange={(event) => setSelectedCorridor(event.target.value)} value={selectedCorridor}>
                <option value="">Select corridor</option>
                {corridors.map((corridor) => (
                  <option key={corridor.id} value={corridor.id}>
                    {corridor.name}
                  </option>
                ))}
              </select>
              <span className="text-xs leading-5" style={{ color: "var(--text-muted)" }}>
                {selectedCorridorMeta ? `${units.length} governed units in ${selectedCorridorMeta.name}` : `${units.length} governed units in view`}
              </span>
            </label>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Corridor heatmap</p>
              <strong className="mt-2 block text-2xl" style={{ color: "var(--text-main)" }}>{demand?.totalVdpStudents || 0}</strong>
              <span className="mt-2 block text-sm leading-6" style={{ color: "var(--text-muted)" }}>Verified demand concentration in the selected corridor.</span>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Complaint clusters</p>
              <strong className="mt-2 block text-2xl" style={{ color: "var(--text-main)" }}>{auditQueue.length}</strong>
              <span className="mt-2 block text-sm leading-6" style={{ color: "var(--text-muted)" }}>Units already escalated into governance review.</span>
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Trust distribution</p>
              <strong className="mt-2 block text-2xl" style={{ color: "var(--text-main)" }}>{units.length}</strong>
              <span className="mt-2 block text-sm leading-6" style={{ color: "var(--text-muted)" }}>Governed units included in the trust split below.</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:col-span-4">
          <div className="metric-tile" style={{ borderColor: "var(--border-strong)" }}>
            <p>Band A</p>
            <strong className="text-[2.4rem]">{trustDistribution[0]}</strong>
            <span><span className="font-semibold" style={{ color: "var(--text-main)" }}>Stable.</span> Strong trust standing.</span>
          </div>
          <div className="metric-tile" style={{ borderColor: "var(--border-strong)" }}>
            <p>Band B</p>
            <strong className="text-[2.55rem]">{trustDistribution[1]}</strong>
            <span><span className="font-semibold" style={{ color: "var(--text-main)" }}>Monitor.</span> Visible, but under active monitoring.</span>
          </div>
          <div className="metric-tile" style={{ borderColor: "var(--border-strong)", boxShadow: "var(--shadow-soft)" }}>
            <p>Band C</p>
            <strong className="text-[2.7rem]">{trustDistribution[2]}</strong>
            <span><span className="font-semibold" style={{ color: "var(--text-main)" }}>Needs attention.</span> Below threshold or at governance risk.</span>
          </div>
          <div className="rounded-[28px] border p-5" style={{ borderColor: "var(--border-strong)", background: "var(--bg-soft)", boxShadow: "var(--shadow-soft)" }}>
            <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Risk Alert</p>
            <p className="mt-3 text-base font-semibold leading-6" style={{ color: "var(--text-main)" }}>
              ⚠️ {auditQueue.length > 0 ? `${auditQueue.length} unit${auditQueue.length === 1 ? "" : "s"} need immediate governance review.` : "No urgent corridor escalation right now."}
            </p>
            <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
              {auditQueue.length > 0 ? "Action required" : "Stable"}: complaint and audit pressure should be reviewed before visibility degrades.
            </p>
          </div>
        </div>
      </section>

      {error ? <div className="status-banner error">{error}</div> : null}
      <InsightCards insights={insights} />

      <section className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
        <article className="glass-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Governance Queue</div>
              <h2 className="section-title mt-4">Units requiring decisions</h2>
            </div>
          </div>
          <div className="mt-8 grid gap-5">
            {units.length ? (
              units.map((unit) => (
                <Link
                  key={unit.id}
                  href={`/unit/${unit.id}`}
                  className="rounded-[24px] border border-white/10 bg-white/5 p-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/8"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <strong className="text-white">Unit {unit.id} | {governanceActionLabel(unit)}</strong>
                      <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                        {unit.auditRequired
                          ? "Action required: audit pressure is blocking a clean governance state."
                          : unit.status === "submitted" || unit.status === "admin_review"
                            ? "Monitoring: this unit is waiting for the next approval decision."
                            : `Stable check: current status is ${unit.status}.`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-soft)" }}>
                        {unit.auditRequired ? "Action required" : unit.status === "submitted" || unit.status === "admin_review" ? "Monitoring" : "Stable"}
                      </span>
                      <span className={`signal-chip ${getStatusTone(unit.status)}`}>{unit.status}</span>
                      <span className={`signal-chip ${getTrustBand(unit.trustScore).tone}`}>{getTrustBand(unit.trustScore).label}</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="empty-state">No units currently require governance review.</div>
            )}
          </div>
        </article>

        <article className="glass-panel p-6">
          <div className="eyebrow">Audit Queue</div>
          <h2 className="section-title mt-4">Complaint and audit pressure</h2>
          <div className="mt-8 grid gap-5">
            {auditQueue.length ? (
              auditQueue.map((unit) => (
                <Link
                  key={unit.id}
                  href={`/unit/${unit.id}`}
                  className="rounded-[24px] border border-white/10 bg-black/20 p-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-black/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-white">Unit {unit.id}</strong>
                    <span className="signal-chip signal-danger">{pressureSeverity(unit).label}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.18em]" style={{ color: "var(--text-soft)" }}>Complaint + audit pressure</p>
                    <span className="text-sm font-medium" style={{ color: "var(--text-main)" }}>{pressureSeverity(unit).label} severity</span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full" style={{ background: "color-mix(in srgb, var(--bg-soft-strong) 96%, transparent)" }}>
                    <div className={`trust-fill ${getTrustBand(unit.trustScore).fillClass}`} style={{ width: `${pressureSeverity(unit).width}%` }} />
                  </div>
                  <p className="mt-4 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
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
    </div>
  );
}

export default function DashboardPage() {
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
  const [creatingUnit, setCreatingUnit] = useState(false);
  const [createForm, setCreateForm] = useState({ corridorId: "", rent: "", distanceKm: "", capacity: "" });

  const studentQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.maxRent) params.set("maxRent", filters.maxRent);
    if (filters.maxDistance) params.set("maxDistance", filters.maxDistance);
    if (filters.ac) params.set("ac", filters.ac);
    return params.toString();
  }, [filters]);

  useEffect(() => {
    setRole(getStoredRole());
  }, []);

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
        const [unitsPayload, auditPayload, demandPayload] = await Promise.all([
          getAdminUnits(selectedCorridor),
          getAdminAuditQueue(selectedCorridor),
          getAdminDemand(selectedCorridor).catch(() => null),
        ]);
        if (!active) return;
        setAdminUnitsState(Array.isArray(unitsPayload) ? unitsPayload : []);
        setAuditQueue(Array.isArray(auditPayload) ? auditPayload : []);
        setDemand(demandPayload || null);
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
    />
  );
}
