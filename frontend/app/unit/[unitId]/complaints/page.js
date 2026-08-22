"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getUnitComplaints, resolveComplaint } from "@/lib/api";
import { formatDateTime, getStatusTone } from "@/lib/governance";
import { getStoredRole } from "@/lib/session";

export default function UnitComplaintsPage({ params }) {
  const unitId = params.unitId;
  const [role, setRole] = useState("");
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData(currentRole) {
    setLoading(true);
    setError("");
    try {
      const response = await getUnitComplaints(unitId);
      setPayload({ ...response, role: currentRole });
    } catch (requestError) {
      setError(requestError.message || "Unable to load unit complaints.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const currentRole = getStoredRole();
    setRole(currentRole);
    loadData(currentRole);
  }, [unitId]);

  async function handleResolve(id) {
    setError("");
    try {
      await resolveComplaint(id);
      await loadData(role);
    } catch (requestError) {
      setError(requestError.message || "Unable to resolve complaint.");
    }
  }

  return (
    <div className="grid gap-6">
      <Link className="btn-secondary w-fit" href={`/unit/${unitId}`}>
        Back to unit
      </Link>

      <section className="glass-panel-strong blueprint-border p-8 sm:p-10">
        <div className="eyebrow">Unit Complaints</div>
        <h1 className="page-title mt-5 text-gradient">Complaint activity for Unit {unitId}</h1>
        <p className="subtle-copy mt-4 max-w-3xl">
          This view keeps the complaint timeline close to trust and visibility. Resolution speed matters because it changes governance risk.
        </p>
      </section>

      {error ? <div className="status-banner error">{error}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="metric-tile"><p>Total</p><strong>{payload?.summary?.totalComplaints || payload?.metrics?.totalComplaints || 0}</strong><span>Total complaint records.</span></article>
        <article className="metric-tile"><p>Open</p><strong>{payload?.summary?.activeComplaints || payload?.metrics?.activeComplaints || 0}</strong><span>Still affecting trust.</span></article>
        <article className="metric-tile"><p>30 day volume</p><strong>{payload?.summary?.complaintsLast30Days || payload?.metrics?.complaintsLast30Days || 0}</strong><span>Recent complaint density.</span></article>
        <article className="metric-tile"><p>SLA signal</p><strong>{payload?.summary?.slaBreaches30d || payload?.metrics?.slaCompliance || 0}</strong><span>{role === "student" ? "Breaches in 30 days." : "Compliance percentage."}</span></article>
      </section>

      <section className="glass-panel p-6">
        <div className="eyebrow">Timeline</div>
        <div className="mt-6 grid gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => <div key={index} className="surface-panel h-40 animate-pulse" />)
          ) : (payload?.complaints || payload?.ownComplaints || []).length ? (
            (payload?.complaints || payload?.ownComplaints || []).map((complaint) => (
              <article key={complaint.id} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <span className={`signal-chip ${getStatusTone(complaint.slaStatus)}`}>{complaint.slaStatus || "Open"}</span>
                    <span className="signal-chip signal-warning">Severity {complaint.severity}</span>
                    {complaint.incidentType ? <span className="signal-chip signal-info">{complaint.incidentType}</span> : null}
                  </div>
                  <span className="text-xs text-slate-500">{formatDateTime(complaint.createdAt)}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-300">{complaint.message || "No message provided."}</p>
                {!complaint.resolved && role !== "student" ? (
                  <button className="btn-primary mt-4" onClick={() => handleResolve(complaint.id)} type="button">
                    Resolve complaint
                  </button>
                ) : null}
              </article>
            ))
          ) : (
            <div className="empty-state">No complaints are currently recorded for this unit.</div>
          )}
        </div>
      </section>
    </div>
  );
}
