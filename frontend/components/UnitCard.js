"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { inferVisibilityReasons, getRiskTone, getStatusTone, getTrustBand } from "@/lib/governance";
import { shortlistUnit } from "@/lib/api";

export default function UnitCard({ unit, onShortlist, showForStudent = false, compact = false }) {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const trust = getTrustBand(unit?.trustScore);
  const visibilityReasons = useMemo(() => inferVisibilityReasons(unit), [unit]);
  const unitId = unit?.unitId || unit?.id;
  const complaintCount = Number(unit?.activeComplaints || unit?.complaintSummary?.activeComplaints || unit?.openIssues || 0);
  const riskLevel =
    unit?.riskLevel ||
    (unit?.auditRequired ? "Critical" : complaintCount >= 3 ? "Warning" : Number(unit?.trustScore || 0) >= 75 ? "Stable" : "Warning");

  if (!unit || (showForStudent && unit.visibleToStudents === false)) {
    return null;
  }

  async function handleShortlist(event) {
    event.preventDefault();
    event.stopPropagation();
    setSubmitting(true);
    setFeedback("");
    setError("");

    try {
      await shortlistUnit({ unitId: Number(unitId) });
      setFeedback("Unit shortlisted. Demand interest recorded.");
      onShortlist?.();
    } catch (requestError) {
      setError(requestError.message || "Unable to shortlist this unit.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Link href={`/unit/${unitId}`} prefetch={false} className="glass-panel blueprint-border group flex h-full flex-col overflow-hidden p-5 transition hover:-translate-y-1">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow mb-3">Unit {unitId}</div>
          <h3 className="text-xl font-semibold" style={{ color: "var(--text-main)" }}>
            {unit?.name || `Governed Unit ${unitId}`}
          </h3>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            {unit?.occupancyType || "Student housing"} / {Number(unit?.distanceKm || 0).toFixed(1)} km from demand corridor
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.24em]" style={{ color: "var(--text-soft)" }}>
            Trust score
          </p>
          <strong className="mt-1 block text-3xl" style={{ color: "var(--text-main)" }}>
            {Number(unit?.trustScore || 0)}
          </strong>
          <span className={`signal-chip mt-2 ${trust.tone}`}>{trust.label}</span>
        </div>
      </div>

      <div className="mt-5 trust-track">
        <div className={`trust-fill ${trust.fillClass}`} style={{ width: `${Math.min(Number(unit?.trustScore || 0), 100)}%` }} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <span className={`signal-chip ${getStatusTone(unit?.status)}`}>{unit?.status || "unknown status"}</span>
        <span className={`signal-chip ${getRiskTone(riskLevel)}`}>{riskLevel} risk</span>
        {unit?.auditRequired ? <span className="signal-chip signal-danger">Audit required</span> : null}
        {unit?.ac ? <span className="signal-chip signal-info">AC</span> : null}
      </div>

      <div className={`mt-5 grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-4"}`}>
        {[
          { label: "Complaints", value: complaintCount },
          { label: "Capacity", value: Number(unit?.capacity || unit?.availability?.capacity || 0) },
          { label: "Available", value: Number(unit?.availableSlots || unit?.availability?.availableSlots || 0) },
          { label: "Rent", value: `Rs ${Number(unit?.rent || 0)}` },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl p-3" style={{ border: "1px solid var(--border)", background: "var(--bg-soft)" }}>
            <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>
              {item.label}
            </p>
            <strong className="mt-2 block text-xl" style={{ color: "var(--text-main)" }}>
              {item.value}
            </strong>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-[24px] p-4" style={{ border: "1px solid var(--border)", background: "var(--bg-soft)" }}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-soft)" }}>
          Why visible or hidden
        </p>
        <div className="mt-3 grid gap-2">
          {visibilityReasons.length ? (
            visibilityReasons.slice(0, compact ? 2 : 3).map((reason) => (
              <div key={reason} className="flex items-start gap-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-teal)" }} />
                <span>{reason}</span>
              </div>
            ))
          ) : (
            <p className="text-sm leading-6" style={{ color: "var(--text-muted)" }}>
              Visibility rationale will appear here once governance signals are available.
            </p>
          )}
        </div>
      </div>

      {showForStudent ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={submitting} onClick={handleShortlist} type="button">
            {submitting ? "Recording..." : "Shortlist"}
          </button>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Demand-gated interest only. This is not a marketplace booking flow.
          </span>
        </div>
      ) : null}

      {feedback ? <div className="status-banner success mt-4">{feedback}</div> : null}
      {error ? <div className="status-banner error mt-4">{error}</div> : null}
    </Link>
  );
}
