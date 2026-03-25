"use client";

import CardFrame from "@/components/cards/CardFrame";
import type { DawnAction, DawnCardProps } from "@/types/dawn";

export default function AnalyticsCard(props: DawnCardProps & { onAction?: (action: DawnAction) => void }) {
  const data = props.card.data || {};
  const corridors = Array.isArray(data.corridors) ? (data.corridors as any[]) : [];
  const units = Array.isArray(data.units) ? (data.units as any[]) : [];
  const topIssues = Array.isArray(data.topIssues) ? (data.topIssues as any[]) : [];

  return (
    <CardFrame
      {...props}
      tone="analytics"
      metrics={[
        { label: "Corridors", value: corridors.length || null },
        { label: "Units", value: units.length || null },
        { label: "Top issues", value: topIssues.length || null },
      ]}
      onAction={props.onAction}
    >
      <div className="space-y-2 text-sm text-slate-300">
        {corridors.slice(0, 3).map((row) => (
          <p key={`corridor-${row.corridorId}`}>
            Corridor {row.corridorId}: density {row.complaintDensity}, risk {row.riskLevel}
          </p>
        ))}
        {units.slice(0, 3).map((row) => (
          <p key={`unit-${row.unitId || row.id}`}>
            Unit {row.unitId || row.id}: {row.recommendation || row.issue || "Active governance pressure"}
          </p>
        ))}
        {topIssues.slice(0, 3).map((issue) => (
          <p key={issue.incidentType}>
            {issue.incidentType}: {issue.complaintCount} complaints across {issue.affectedUnits} unit(s)
          </p>
        ))}
        {corridors.length === 0 && units.length === 0 && topIssues.length === 0 ? <p>No relevant data found</p> : null}
      </div>
    </CardFrame>
  );
}

