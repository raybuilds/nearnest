"use client";

import CardFrame from "@/components/cards/CardFrame";
import type { DawnAction, DawnCardProps } from "@/types/dawn";

export default function AnalyticsCard(props: DawnCardProps & { onAction?: (action: DawnAction) => void }) {
  const data = props.card.data || {};
  const corridors = Array.isArray(data.corridors) ? (data.corridors as any[]) : [];
  const units = Array.isArray(data.units) ? (data.units as any[]) : [];
  const topIssues = Array.isArray(data.topIssues) ? (data.topIssues as any[]) : [];
  const comparisonUnits = Array.isArray(data.units) ? (data.units as any[]) : [];
  const riskDistribution = (data.riskDistribution || null) as any;
  const reasons = Array.isArray(data.reasons) ? (data.reasons as string[]) : [];
  const hasContent =
    Boolean(data.message || data.action || data.reason || data.recommendation || riskDistribution) ||
    corridors.length > 0 ||
    units.length > 0 ||
    topIssues.length > 0 ||
    reasons.length > 0 ||
    (Array.isArray(data.riskyCorridors) && data.riskyCorridors.length > 0);

  return (
    <CardFrame
      {...props}
      tone="analytics"
      metrics={[
        { label: "Priority", value: (data.priority || data.severity || data.verdict) as string | null },
        { label: "Units", value: comparisonUnits.length || units.length || (data.totalUnits as number | null) },
        { label: "Corridors", value: corridors.length || (Array.isArray(data.riskyCorridors) ? data.riskyCorridors.length : null) },
        { label: "Top issues", value: topIssues.length || null },
      ]}
      onAction={props.onAction}
    >
      <div className="space-y-2 text-sm text-slate-300">
        {data.message ? <p>{String(data.message)}</p> : null}
        {data.action ? <p>Action: {String(data.action)}</p> : null}
        {data.reason ? <p>Reason: {String(data.reason)}</p> : null}
        {data.recommendation ? <p>Recommendation: {String(data.recommendation)}</p> : null}
        {riskDistribution ? (
          <p>
            Risk distribution: high {riskDistribution.high || 0}, medium {riskDistribution.medium || 0}, low {riskDistribution.low || 0}
          </p>
        ) : null}
        {Array.isArray(data.riskyCorridors)
          ? (data.riskyCorridors as any[]).slice(0, 3).map((row) => (
              <p key={`risky-corridor-${row.corridorId}`}>
                Corridor {row.corridorName || row.corridorId}: density {row.complaintDensity}, risk {row.riskLevel}
              </p>
            ))
          : null}
        {corridors.slice(0, 3).map((row) => (
          <p key={`corridor-${row.corridorId}`}>
            Corridor {row.corridorName || row.corridorId}: density {row.complaintDensity}, risk {row.riskLevel}
          </p>
        ))}
        {units.slice(0, 3).map((row) => (
          <p key={`unit-${row.unitId || row.id}`}>
            Unit {row.unitId || row.id}: {row.recommendation || row.issue || "Active governance pressure"}
          </p>
        ))}
        {comparisonUnits.length === 2
          ? comparisonUnits.map((row) => (
              <p key={`compare-${row.unitId}`}>
                Unit {row.unitId}: trust {row.trustScore}, complaints {row.complaints}, risk {row.riskLevel}
              </p>
            ))
          : null}
        {topIssues.slice(0, 3).map((issue) => (
          <p key={issue.incidentType}>
            {issue.incidentType}: {issue.complaintCount || issue.count} complaints across {issue.affectedUnits || "--"} unit(s)
          </p>
        ))}
        {reasons.slice(0, 3).map((reason) => (
          <p key={reason}>{reason}</p>
        ))}
        {!hasContent ? <p>No relevant data found</p> : null}
      </div>
    </CardFrame>
  );
}
