"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

function formatDate(dateString) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCountdown(ms) {
  if (ms === null || ms === undefined) return "N/A";
  if (ms <= 0) return "Overdue";
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function severityClass(severity) {
  if (severity >= 5) return "bg-rose-600 text-white";
  if (severity >= 3) return "bg-amber-500 text-white";
  if (severity === 2) return "bg-blue-100 text-blue-800";
  return "bg-slate-200 text-slate-700";
}

function getSlaBadge(item) {
  if (item.slaStatus === "late" || item.slaStatus === "sla_breached") {
    return { label: "⚠ Breached", className: "bg-rose-600 text-white" };
  }
  if (item.slaStatus === "open" && item.slaCountdownMs !== null && item.slaCountdownMs <= 12 * 60 * 60 * 1000) {
    return { label: "Due < 12h", className: "bg-amber-500 text-white" };
  }
  if (item.slaStatus === "resolved") {
    return { label: "Resolved", className: "bg-slate-200 text-slate-700" };
  }
  return { label: "On Time", className: "bg-slate-200 text-slate-700" };
}

function getTrustImpactMeta(trustImpactHint) {
  const impact = Math.abs(Number(trustImpactHint || 0));
  if (impact >= 11) return { label: "High", className: "text-rose-700" };
  if (impact >= 6) return { label: "Moderate", className: "text-amber-700" };
  return { label: "Low", className: "text-slate-700" };
}

function ComplaintCard({ item, showStudent }) {
  const slaBadge = getSlaBadge(item);
  const impactMeta = getTrustImpactMeta(item.trustImpactHint);

  return (
    <article className={`rounded-lg border p-3 ${item.slaStatus === "late" || item.slaStatus === "sla_breached" ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Complaint #{item.id}</p>
        <div className="flex items-center gap-1">
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityClass(item.severity)}`}>S{item.severity}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${slaBadge.className}`}>{slaBadge.label}</span>
        </div>
      </div>
      <p className="text-sm text-slate-700">{item.unitLabel}</p>
      <p className="text-sm text-slate-700">Incident: {item.incidentType}</p>
      {item.message && <p className="text-sm text-slate-700">Message: {item.message}</p>}
      <p className="text-sm text-slate-700">
        Trust impact:{" "}
        <span className={`font-semibold ${impactMeta.className}`}>
          {item.trustImpactHint} trust ({impactMeta.label})
        </span>
      </p>
      <p className="text-sm text-slate-700">
        SLA countdown:{" "}
        <span className={`font-semibold ${item.slaCountdownMs !== null && item.slaCountdownMs <= 0 ? "text-rose-700" : "text-slate-900"}`}>
          {formatCountdown(item.slaCountdownMs)}
        </span>
      </p>
      <p className="text-xs text-slate-500">Created: {formatDate(item.createdAt)}</p>
      <p className="text-xs text-slate-500">Resolved: {formatDate(item.resolvedAt)}</p>
      {showStudent && item.student?.name && (
        <p className="text-sm text-slate-700">Student: {item.student.name} ({item.student.intake || "N/A"})</p>
      )}
      <div className="mt-2">
        <Link className="text-sm text-blue-700 underline" href={`/unit/${item.unitId}/complaints`}>
          Open Unit Complaint Ledger
        </Link>
      </div>
    </article>
  );
}

export default function ComplaintsPage() {
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);

  const [unitId, setUnitId] = useState("");
  const [status, setStatus] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [corridorId, setCorridorId] = useState("");
  const [landlordId, setLandlordId] = useState("");
  const [slaBreachOnly, setSlaBreachOnly] = useState(false);

  useEffect(() => {
    setRole(localStorage.getItem("role") || "");
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (unitId) params.set("unitId", unitId);
    if (status) params.set("status", status);
    if (incidentType) params.set("incidentType", incidentType);
    if (role === "admin") {
      if (corridorId) params.set("corridorId", corridorId);
      if (landlordId) params.set("landlordId", landlordId);
      if (slaBreachOnly) params.set("slaBreachOnly", "true");
    }
    const q = params.toString();
    return q ? `?${q}` : "";
  }, [corridorId, incidentType, landlordId, role, slaBreachOnly, status, unitId]);

  async function loadComplaints() {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest(`/complaints${queryString}`);
      setPayload(data);
    } catch (err) {
      setError(err.message || "Failed to load complaints");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!role) return;
    loadComplaints();
  }, [role]);

  if (!role) {
    return <p className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Login required.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Complaints</h1>

      <section className="grid gap-2 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-6">
        <input className="rounded border p-2" onChange={(e) => setUnitId(e.target.value)} placeholder="Unit ID" value={unitId} />
        {(role === "landlord" || role === "admin") && (
          <select className="rounded border p-2" onChange={(e) => setStatus(e.target.value)} value={status}>
            <option value="">Status any</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="late">Late</option>
            <option value="sla_breached">SLA Breached</option>
          </select>
        )}
        {(role === "landlord" || role === "admin") && (
          <select className="rounded border p-2" onChange={(e) => setIncidentType(e.target.value)} value={incidentType}>
            <option value="">Incident any</option>
            <option value="safety">Safety</option>
            <option value="injury">Injury</option>
            <option value="fire">Fire</option>
            <option value="harassment">Harassment</option>
            <option value="other">Other</option>
          </select>
        )}
        {role === "admin" && <input className="rounded border p-2" onChange={(e) => setCorridorId(e.target.value)} placeholder="Corridor ID" value={corridorId} />}
        {role === "admin" && <input className="rounded border p-2" onChange={(e) => setLandlordId(e.target.value)} placeholder="Landlord ID" value={landlordId} />}
        {role === "admin" && (
          <label className="flex items-center gap-2 rounded border p-2 text-sm text-slate-700">
            <input checked={slaBreachOnly} onChange={(e) => setSlaBreachOnly(e.target.checked)} type="checkbox" />
            SLA breaches only
          </label>
        )}
        <button className="rounded bg-slate-900 px-4 py-2 text-white md:col-span-6" onClick={loadComplaints} type="button">
          Apply Filters
        </button>
      </section>

      {loading && <p className="text-sm text-slate-600">Loading complaints...</p>}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!loading && !error && payload?.metrics && (
        <section className="grid gap-2 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-4">
          {"openComplaints" in payload.metrics && <div className="text-sm text-slate-700">Open: <span className="font-semibold">{payload.metrics.openComplaints}</span></div>}
          {"lateComplaints" in payload.metrics && <div className="text-sm text-slate-700">Late: <span className="font-semibold">{payload.metrics.lateComplaints}</span></div>}
          {"slaCompliance" in payload.metrics && <div className="text-sm text-slate-700">SLA Compliance: <span className="font-semibold">{payload.metrics.slaCompliance ?? "N/A"}%</span></div>}
          {"avgResolutionHours" in payload.metrics && <div className="text-sm text-slate-700">Avg Resolution: <span className="font-semibold">{payload.metrics.avgResolutionHours ?? "N/A"}h</span></div>}
          {"complaintsLast30Days" in payload.metrics && <div className="text-sm text-slate-700">30d Density: <span className="font-semibold">{payload.metrics.complaintsLast30Days}</span></div>}
          {"complaintsLast60Days" in payload.metrics && <div className="text-sm text-slate-700">60d Density: <span className="font-semibold">{payload.metrics.complaintsLast60Days}</span></div>}
          {Array.isArray(payload.metrics.densityWarnings) && payload.metrics.densityWarnings.length > 0 && (
            <div className="md:col-span-4 flex flex-wrap gap-2">
              {payload.metrics.densityWarnings.map((d) => {
                const highRisk = d.complaintsLast30Days >= 5;
                return (
                  <span
                    key={`density-${d.unitId}`}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      highRisk
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-amber-300 bg-amber-50 text-amber-700"
                    }`}
                  >
                    Unit #{d.unitId}: {d.complaintsLast30Days}/30d {highRisk ? "• Audit Risk" : "• Monitor"}
                  </span>
                );
              })}
            </div>
          )}
          {Array.isArray(payload.metrics.highDensityUnits) && payload.metrics.highDensityUnits.length > 0 && (
            <div className="md:col-span-4 flex flex-wrap gap-2">
              {payload.metrics.highDensityUnits.map((d) => {
                const highRisk = d.complaintsLast30Days >= 5;
                return (
                  <span
                    key={`admin-density-${d.unitId}`}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      highRisk
                        ? "border-rose-300 bg-rose-50 text-rose-700"
                        : "border-amber-300 bg-amber-50 text-amber-700"
                    }`}
                  >
                    Unit #{d.unitId}: {d.complaintsLast30Days}/30d {highRisk ? "• Audit Risk" : "• Monitor"}
                  </span>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!loading && !error && (
        <section className="space-y-3">
          {Array.isArray(payload?.complaints) && payload.complaints.length === 0 && (
            <p className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">No complaints found.</p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {(payload?.complaints || []).map((item) => (
              <ComplaintCard key={item.id} item={item} showStudent={role === "admin"} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
