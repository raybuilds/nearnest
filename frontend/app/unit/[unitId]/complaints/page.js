"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

export default function UnitComplaintsPage() {
  const params = useParams();
  const unitId = Number(params?.unitId);

  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    setRole(localStorage.getItem("role") || "");
  }, []);

  useEffect(() => {
    if (!role) return;
    if (!Number.isInteger(unitId) || unitId < 1) {
      setError("Invalid unit id");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiRequest(`/unit/${unitId}/complaints`);
        setPayload(data);
      } catch (err) {
        setError(err.message || "Failed to load unit complaints");
      } finally {
        setLoading(false);
      }
    })();
  }, [role, unitId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Unit #{Number.isNaN(unitId) ? "?" : unitId} Complaints</h1>
        <div className="flex gap-2">
          <Link className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" href="/complaints">
            Global Complaints
          </Link>
          <Link className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" href={`/unit/${unitId}`}>
            Unit Page
          </Link>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-600">Loading complaint ledger...</p>}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!loading && !error && role === "student" && payload?.summary && (
        <section className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-semibold">Sanitized Summary</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <p className="text-sm text-slate-700">Total: <span className="font-semibold">{payload.summary.totalComplaints}</span></p>
            <p className="text-sm text-slate-700">Active: <span className="font-semibold">{payload.summary.activeComplaints}</span></p>
            <p className="text-sm text-slate-700">30d: <span className="font-semibold">{payload.summary.complaintsLast30Days}</span></p>
            <p className="text-sm text-slate-700">SLA Compliance: <span className="font-semibold">{payload.summary.slaCompliance ?? "N/A"}%</span></p>
          </div>
          <p className="text-sm text-slate-700">
            Incident breakdown: {Object.entries(payload.summary.incidentBreakdown || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "N/A"}
          </p>

          <h3 className="text-lg font-semibold">Your Complaint Timeline</h3>
          {(!payload.ownComplaints || payload.ownComplaints.length === 0) && <p className="text-sm text-slate-600">No complaints filed by you for this unit.</p>}
          <div className="space-y-2">
            {(payload.ownComplaints || []).map((item) => (
              <article key={item.id} className={`rounded-lg border p-3 ${item.slaStatus === "late" || item.slaStatus === "sla_breached" ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">Complaint #{item.id}</p>
                  <div className="flex items-center gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityClass(item.severity)}`}>S{item.severity}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getSlaBadge(item).className}`}>{getSlaBadge(item).label}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-700">
                  SLA countdown:{" "}
                  <span className={`font-semibold ${item.slaCountdownMs !== null && item.slaCountdownMs <= 0 ? "text-rose-700" : "text-slate-900"}`}>
                    {formatCountdown(item.slaCountdownMs)}
                  </span>
                </p>
                <p className="text-xs text-slate-500">Created: {formatDate(item.createdAt)}</p>
                <p className="text-xs text-slate-500">Resolved: {formatDate(item.resolvedAt)}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {!loading && !error && role !== "student" && payload?.metrics && (
        <section className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-xl font-semibold">Unit Forensic Metrics</h2>
          <div className="grid gap-2 md:grid-cols-4">
            <p className="text-sm text-slate-700">Total: <span className="font-semibold">{payload.metrics.totalComplaints}</span></p>
            <p className="text-sm text-slate-700">Active: <span className="font-semibold">{payload.metrics.activeComplaints}</span></p>
            <p className="text-sm text-slate-700">30d Density: <span className="font-semibold">{payload.metrics.complaintsLast30Days}</span></p>
            <p className="text-sm text-slate-700">60d Density: <span className="font-semibold">{payload.metrics.complaintsLast60Days}</span></p>
            <p className="text-sm text-slate-700">SLA Compliance: <span className="font-semibold">{payload.metrics.slaCompliance ?? "N/A"}%</span></p>
            <p className="text-sm text-slate-700">Avg Resolution: <span className="font-semibold">{payload.metrics.avgResolutionHours ?? "N/A"}h</span></p>
          </div>
          {payload.metrics.densityWarning && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {payload.metrics.complaintsLast30Days >= 5
                ? "⚠ Complaint density rising. Audit Risk."
                : "⚠ Complaint density rising. Monitor closely."}
            </div>
          )}
          <p className="text-sm text-slate-700">
            Incident breakdown: {Object.entries(payload.metrics.incidentBreakdown || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "N/A"}
          </p>
          <p className="text-sm text-slate-700">
            Severity trend: {Object.entries(payload.metrics.severityTrend || {}).map(([k, v]) => `S${k}: ${v}`).join(", ") || "N/A"}
          </p>
        </section>
      )}

      {!loading && !error && role !== "student" && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Complaint Timeline</h2>
          {(!payload?.complaints || payload.complaints.length === 0) && <p className="text-sm text-slate-600">No complaints for this unit.</p>}
          {(payload?.complaints || []).map((item) => (
            <article key={item.id} className={`rounded-lg border p-3 ${item.slaStatus === "late" || item.slaStatus === "sla_breached" ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
              {(() => {
                const impactMeta = getTrustImpactMeta(item.trustImpactHint);
                const slaBadge = getSlaBadge(item);
                return (
                  <>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">Complaint #{item.id}</p>
                <div className="flex items-center gap-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityClass(item.severity)}`}>S{item.severity}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${slaBadge.className}`}>{slaBadge.label}</span>
                </div>
              </div>
              <p className="text-sm text-slate-700">Incident: {item.incidentType}</p>
              {item.message && <p className="text-sm text-slate-700">Message: {item.message}</p>}
              <p className="text-sm text-slate-700">
                SLA countdown:{" "}
                <span className={`font-semibold ${item.slaCountdownMs !== null && item.slaCountdownMs <= 0 ? "text-rose-700" : "text-slate-900"}`}>
                  {formatCountdown(item.slaCountdownMs)}
                </span>
              </p>
              <p className="text-sm text-slate-700">
                Trust impact: <span className={`font-semibold ${impactMeta.className}`}>{item.trustImpactHint} trust ({impactMeta.label})</span>
              </p>
              {role === "admin" && item.student?.name && <p className="text-sm text-slate-700">Student: {item.student.name}</p>}
              <p className="text-xs text-slate-500">Created: {formatDate(item.createdAt)}</p>
              <p className="text-xs text-slate-500">Resolved: {formatDate(item.resolvedAt)}</p>
                  </>
                );
              })()}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
