"use client";

import CardFrame from "@/components/cards/CardFrame";
import type { DawnAction, DawnCardProps } from "@/types/dawn";

export default function HealthReportCard(props: DawnCardProps & { onAction?: (action: DawnAction) => void }) {
  const data = props.card.data || {};
  const reasons = Array.isArray(data.visibilityReasons) ? (data.visibilityReasons as string[]) : [];

  return (
    <CardFrame
      {...props}
      tone="health"
      metrics={[
        { label: "Trust score", value: data.trustScore as number | null },
        { label: "Trust band", value: data.trustBand as string | null },
        { label: "Complaints 30d", value: data.complaintsLast30Days as number | null },
        { label: "SLA breaches", value: data.slaBreaches30Days as number | null },
      ]}
      onAction={props.onAction}
    >
      <div className="space-y-2 text-sm text-slate-200">
        <p>Status: {String(data.status || "--")}</p>
        <p>Audit required: {data.auditRequired ? "Yes" : "No"}</p>
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-slate-400">Why</p>
          {reasons.length > 0 ? (
            <ul className="space-y-1 text-slate-300">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-300">Backend did not report additional visibility reasons.</p>
          )}
        </div>
      </div>
    </CardFrame>
  );
}

