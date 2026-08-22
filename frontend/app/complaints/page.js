"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ComplaintForm from "@/components/ComplaintForm";
import { getComplaints, resolveComplaint } from "@/lib/api";
import { formatDateTime, getStatusTone } from "@/lib/governance";
import { getStoredRole } from "@/lib/session";
import { FadeIn, Reveal } from "@/components/ui/Motion";

function Countdown({ ms }) {
  const [remaining, setRemaining] = useState(Number(ms || 0));

  useEffect(() => {
    setRemaining(Number(ms || 0));
  }, [ms]);

  useEffect(() => {
    if (ms == null) return undefined;
    const id = window.setInterval(() => setRemaining((current) => current - 1000), 1000);
    return () => window.clearInterval(id);
  }, [ms]);

  if (ms == null) return null;
  if (remaining <= 0) return <span className="signal-chip signal-danger">Breached</span>;

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  return <span className="signal-chip signal-warning">{`${hours}:${minutes} remaining`}</span>;
}

export default function ComplaintsPage() {
  const [role, setRole] = useState("");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ unit: "", status: "", severity: "" });

  async function loadComplaints(activeFilters = filters) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (activeFilters.unit) params.set("unitId", activeFilters.unit);
      if (activeFilters.status) params.set("status", activeFilters.status);
      const response = await getComplaints(params.toString());
      setPayload(response || null);
    } catch (requestError) {
      setError(requestError.message || "Unable to load complaints.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setRole(getStoredRole());
    loadComplaints();
  }, []);

  const complaints = useMemo(() => {
    const list = Array.isArray(payload?.complaints) ? payload.complaints : [];
    if (!filters.severity) return list;
    return list.filter((item) => String(item.severity) === filters.severity);
  }, [filters.severity, payload]);

  const metrics = useMemo(() => {
    if (!complaints.length) {
      return [
        { label: "Total", value: 0, note: "No complaints found" },
        { label: "Open", value: 0, note: "No active issues" },
        { label: "Resolved", value: 0, note: "No resolved issues" },
        { label: "Breached", value: 0, note: "No SLA breaches" },
      ];
    }

    const resolved = complaints.filter((item) => item.resolved).length;
    const breached = complaints.filter((item) => item.slaStatus === "late" || item.slaStatus === "sla_breached").length;
    return [
      { label: "Total", value: complaints.length, note: "Complaint records in scope" },
      { label: "Open", value: complaints.filter((item) => !item.resolved).length, note: "Influencing trust" },
      { label: "Resolved", value: resolved, note: "Closed governance events" },
      { label: "Breached", value: breached, note: "Late or SLA-breached" },
    ];
  }, [complaints]);

  async function handleResolve(id) {
    setError("");
    try {
      await resolveComplaint(id);
      await loadComplaints();
    } catch (requestError) {
      setError(requestError.message || "Unable to resolve complaint.");
    }
  }

  return (
    <div className="grid gap-6">
      <Reveal duration={0.5}>
        <section className="glass-panel-strong blueprint-border p-8 sm:p-10 rounded-[24px] bg-[var(--bg-surface-strong)]">
          <div className="eyebrow">Complaint Governance</div>
          <h1 className="page-title mt-5 text-gradient">Complaint signals with visible trust impact.</h1>
          <p className="subtle-copy mt-4 max-w-3xl">
            Complaints are not background tickets. They are governance inputs that influence trust score, SLA posture, and unit visibility.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3 xl:grid-cols-4">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500 font-semibold">Unit</span>
              <select className="input-shell text-sm" onChange={(event) => setFilters((current) => ({ ...current, unit: event.target.value }))} value={filters.unit}>
                <option value="">All units</option>
                {Array.from(new Set((payload?.complaints || []).map((item) => item.unitId))).map((unitId) => (
                  <option key={unitId} value={unitId}>
                    Unit {unitId}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500 font-semibold">Status</span>
              <select className="input-shell text-sm" onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} value={filters.status}>
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="late">Late</option>
                <option value="sla_breached">SLA breached</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500 font-semibold">Severity</span>
              <select className="input-shell text-sm" onChange={(event) => setFilters((current) => ({ ...current, severity: event.target.value }))} value={filters.severity}>
                <option value="">All severities</option>
                {["1", "2", "3", "4", "5"].map((value) => (
                  <option key={value} value={value}>
                    Severity {value}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end">
              <button className="btn-primary w-full text-xs py-2.5 font-semibold tracking-wider" onClick={() => loadComplaints(filters)} type="button">
                Apply filters
              </button>
            </div>
          </div>
        </section>
      </Reveal>

      {error ? <div className="status-banner error">{error}</div> : null}

      <Reveal duration={0.5}>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.label} className="metric-tile rounded-2xl p-5 border border-white/5 bg-white/5">
              <p className="text-xs text-slate-400 uppercase tracking-wider">{metric.label}</p>
              <strong className="text-2xl text-white mt-1 block">{metric.value}</strong>
              <span className="text-[10px] text-slate-500 block mt-1">{metric.note}</span>
            </article>
          ))}
        </section>
      </Reveal>

      <section className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
        <article className="glass-panel p-6 rounded-[24px] bg-[var(--bg-surface)] border border-white/5">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <div className="eyebrow">Complaint stream</div>
              <h2 className="section-title mt-2">Incident, severity, SLA, trust impact</h2>
            </div>
          </div>

          <div className="mt-6 grid gap-6">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="surface-panel h-36 animate-pulse rounded-2xl bg-stone-800" />
              ))
            ) : complaints.length ? (
              <div className="space-y-6 relative border-l border-white/10 pl-6 ml-3">
                {complaints.map((complaint, idx) => (
                  <Reveal key={complaint.id} delay={idx * 0.05} duration={0.4}>
                    <div className="relative">
                      {/* Timeline dot icon placement */}
                      <span className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-sky-400 border-2 border-black" />
                      
                      <div className="rounded-[24px] border border-white/5 bg-white/5 hover:bg-white/10 transition-colors p-5 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-2">
                            <span className={`signal-chip ${getStatusTone(complaint.slaStatus)}`}>
                              {complaint.slaStatus || "Open"}
                            </span>
                            <span className="signal-chip signal-info">Severity {complaint.severity}</span>
                            {complaint.incidentType ? (
                              <span className="signal-chip signal-warning">{complaint.incidentType}</span>
                            ) : null}
                          </div>
                          {!complaint.resolved ? (
                            <Countdown ms={complaint.slaCountdownMs} />
                          ) : (
                            <span className="signal-chip signal-success">Resolved</span>
                          )}
                        </div>

                        <p className="text-sm leading-relaxed text-slate-200">{complaint.message || "No description provided."}</p>

                        <div className="grid gap-3 grid-cols-3 text-xs border-t border-white/5 pt-3">
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">Unit</p>
                            <strong className="mt-0.5 block text-slate-300">Unit {complaint.unitId}</strong>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">Created</p>
                            <strong className="mt-0.5 block text-slate-300">{formatDateTime(complaint.createdAt)}</strong>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">Trust impact</p>
                            <strong className="mt-0.5 block text-slate-300">{complaint.trustImpactHint ?? "Tracked by engine"}</strong>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-2">
                          <Link className="btn-secondary text-xs px-3 py-1.5" href={`/unit/${complaint.unitId}`}>
                            Open unit detail
                          </Link>
                          {role !== "student" && !complaint.resolved ? (
                            <button className="btn-primary text-xs px-3 py-1.5 font-semibold" onClick={() => handleResolve(complaint.id)} type="button">
                              Resolve issue
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            ) : (
              <div className="empty-state">No complaints found.</div>
            )}
          </div>
        </article>

        <div className="grid gap-5">
          {role === "student" ? (
            <FadeIn>
              <ComplaintForm />
            </FadeIn>
          ) : (
            <article className="glass-panel p-6 rounded-[24px] bg-[var(--bg-surface)] border border-white/5">
              <div className="eyebrow">Resolution workflow</div>
              <h2 className="section-title mt-4">Governance response guide</h2>
              <div className="mt-5 grid gap-3">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                  Active complaints continue to influence trust until resolved.
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                  Late resolution can trigger stronger audit pressure and hide units from students.
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                  Resolution should be accompanied by evidence and a clear rationale for restored confidence.
                </div>
              </div>
            </article>
          )}
        </div>
      </section>
    </div>
  );
}
