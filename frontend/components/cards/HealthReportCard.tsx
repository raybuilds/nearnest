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
      <div className="space-y-2 text-sm" style={{ color: "var(--text-main)" }}>
        <p>Status: {String(data.status || "--")}</p>
        <p>Audit required: {data.auditRequired ? "Yes" : "No"}</p>
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Why</p>
          {reasons.length > 0 ? (
            <ul className="space-y-1" style={{ color: "var(--text-muted)" }}>
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "var(--text-muted)" }}>Backend did not report additional visibility reasons.</p>
          )}
        </div>
      </div>
    </CardFrame>
  );
}
