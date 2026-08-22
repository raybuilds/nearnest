"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { inferVisibilityReasons, getRiskTone, getTrustBand } from "@/lib/governance";
import { shortlistUnit } from "@/lib/api";

export default function UnitCard({ unit, onShortlist, showForStudent = false, compact = false }) {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const trust = getTrustBand(unit?.trustScore);
  const visibilityReasons = useMemo(() => inferVisibilityReasons(unit), [unit]);
  const unitId = unit?.unitId || unit?.id;
  const complaintCount = Number(unit?.activeComplaints || unit?.complaintSummary?.activeComplaints || unit?.openIssues || 0);
  const capacity = Number(unit?.capacity || unit?.availability?.capacity || 0);
  const availableSlots = Number(unit?.availableSlots || unit?.availability?.availableSlots || 0);
  const rent = Number(unit?.rent || 0);
  const riskLevel =
    unit?.riskLevel ||
    (unit?.auditRequired ? "Critical" : complaintCount >= 3 ? "Warning" : Number(unit?.trustScore || 0) >= 75 ? "Stable" : "Warning");
  const trustScore = Number(unit?.trustScore || 0);
  const trustContext =
    trustScore >= 90
      ? "Top 10% in corridor"
      : trustScore >= 80
        ? "Higher than most nearby units"
        : trustScore >= 70
          ? "Steady compared with nearby units"
          : "Below stronger nearby units";
  const visibilitySummary = unit?.auditRequired
    ? "Governance review required. Access may stay limited until audits clear."
    : trustScore >= 80 && complaintCount <= 1
      ? "Governance checks clear. Trust remains high."
      : complaintCount >= 3
        ? "Complaint pressure is elevated. Visibility may tighten."
        : visibilityReasons[0] || "Governance signals are stable right now.";
  const compactSignals = [
    unit?.status === "approved" ? "Approved" : unit?.status || null,
    trustScore >= 80 ? "High trust" : trustScore >= 65 ? "Stable trust" : "Watch trust",
    riskLevel?.toLowerCase() === "stable" ? "Low risk" : `${riskLevel} risk`,
    unit?.ac ? "AC" : null,
  ].filter(Boolean);
  const ctaLabel = unit?.visibleToStudents === false ? "Request Access" : "Express Interest";
  const whyChooseThis =
    trustScore >= 80 && complaintCount <= 1
      ? "High trust + low complaints"
      : trustScore >= 70
        ? "Strong safety signals + steady trust"
        : complaintCount <= 1
          ? "Low complaints + fair trust"
          : "Worth reviewing if this location fits your needs";
  const studentBadge =
    trustScore >= 88
      ? "Recommended"
      : Number(unit?.shortlistCount || unit?.interestCount || 0) >= 3
        ? "High demand"
        : "";

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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="eyebrow">Unit {unitId}</div>
            {showForStudent && studentBadge ? <span className="signal-chip signal-info">{studentBadge}</span> : null}
          </div>
          <h3 className="text-xl font-semibold leading-tight sm:text-[1.4rem]" style={{ color: "var(--text-main)" }}>
            {unit?.name || `Governed Unit ${unitId}`}
          </h3>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
            {unit?.occupancyType || "Student housing"} / {Number(unit?.distanceKm || 0).toFixed(1)} km from demand corridor
          </p>
          {showForStudent ? (
            <p className="mt-3 text-sm font-medium leading-6" style={{ color: "var(--text-main)" }}>
              Why choose this: <span style={{ color: "var(--text-muted)" }}>{whyChooseThis}</span>
            </p>
          ) : null}
        </div>
        <div className="min-w-[8.5rem] text-right">
          <p className="text-xs uppercase tracking-[0.24em]" style={{ color: "var(--text-soft)" }}>
            Trust score
          </p>
          <strong className="mt-1 block text-4xl font-semibold leading-none sm:text-[2.75rem]" style={{ color: "var(--text-main)" }}>
            {trustScore}
          </strong>
          <p className="mt-2 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
            {trustContext}
          </p>
          <div className="mt-3 inline-flex items-center gap-2">
            <span className={`signal-chip ${trust.tone}`}>{trust.label}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 trust-track h-2.5">
        <div className={`trust-fill ${trust.fillClass}`} style={{ width: `${Math.min(trustScore, 100)}%` }} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
        {compactSignals.map((signal, index) => (
          <span key={signal} className="inline-flex items-center">
            {index > 0 ? <span className="mr-2" style={{ color: "var(--text-soft)" }}>|</span> : null}
            <span>{signal}</span>
          </span>
        ))}
      </div>

      <div className={`mt-6 grid gap-3 ${compact ? "sm:grid-cols-1" : "sm:grid-cols-2"}`}>
        <div className="overflow-hidden rounded-[22px] p-3.5" style={{ border: "1px solid var(--border-strong)", background: "color-mix(in srgb, var(--bg-soft) 94%, transparent)" }}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-soft)" }}>
              Operational
            </p>
            <span className={`signal-chip shrink-0 ${getRiskTone(riskLevel)}`}>{riskLevel === "Stable" ? "Low risk" : `${riskLevel} risk`}</span>
          </div>
          <div className="mt-3.5 grid grid-cols-3 gap-2">
            {[
              { label: "Complaints", value: complaintCount },
              { label: "Capacity", value: capacity },
              { label: "Available", value: availableSlots },
            ].map((item) => (
              <div key={item.label} className="rounded-[18px] px-3 py-2" style={{ border: "1px solid var(--border)", background: "color-mix(in srgb, var(--bg-soft-strong) 94%, transparent)" }}>
                <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>
                  {item.label}
                </p>
                <strong className="mt-1 block text-base sm:text-[1.05rem]" style={{ color: "var(--text-main)" }}>
                  {item.value}
                </strong>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] p-3.5" style={{ border: "1px solid var(--border-strong)", background: "color-mix(in srgb, var(--bg-soft) 94%, transparent)" }}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-soft)" }}>
              Financial
            </p>
            <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--text-soft)" }}>
              {trustScore >= 80 ? "Strong value" : "Review budget"}
            </span>
          </div>
          <div className="mt-3 rounded-[18px] px-3 py-3" style={{ border: "1px solid var(--border)", background: "color-mix(in srgb, var(--bg-soft-strong) 94%, transparent)" }}>
            <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>
              Rent
            </p>
            <strong className="mt-1.5 block text-[2.15rem] font-semibold leading-none sm:text-[2.35rem]" style={{ color: "var(--text-main)" }}>
              Rs {rent}
            </strong>
            <p className="mt-2 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
              {trustScore >= 80 ? "Strong trust posture" : "Review trust signals first"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-start gap-2 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
        <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs" style={{ background: "var(--bg-soft-strong)", color: "var(--text-main)" }}>
          {unit?.auditRequired || complaintCount >= 3 ? "!" : "i"}
        </span>
        <p className="min-w-0">
          <span className="font-medium" style={{ color: "var(--text-main)" }}>
            {unit?.auditRequired || complaintCount >= 3 ? "Attention:" : "Visible now:"}
          </span>{" "}
          {visibilitySummary}
        </p>
      </div>

      {showForStudent ? (
        <div className="mt-5 flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <button className="btn-primary w-full px-6 py-3.5 sm:w-auto" disabled={submitting} onClick={handleShortlist} type="button">
              {submitting ? "Recording..." : ctaLabel}
            </button>
            <p className="mt-2 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
              No booking yet. This helps unlock access.
            </p>
          </div>
        </div>
      ) : null}

      {feedback ? <div className="status-banner success mt-4">{feedback}</div> : null}
      {error ? <div className="status-banner error mt-4">{error}</div> : null}
    </Link>
  );
}
