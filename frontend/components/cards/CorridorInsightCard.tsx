"use client";

import CardFrame from "@/components/cards/CardFrame";
import type { DawnAction, DawnCardProps } from "@/types/dawn";

export default function CorridorInsightCard(props: DawnCardProps & { onAction?: (action: DawnAction) => void }) {
  const data = props.card.data || {};
  const incidentFrequency = Object.entries((data.incidentFrequency || {}) as Record<string, number>);

  return (
    <CardFrame
      {...props}
      tone="analytics"
      metrics={[
        { label: "Corridor", value: data.corridorId as number | null },
        { label: "Risk level", value: data.riskLevel as string | null },
        { label: "Complaint density", value: data.complaintDensity as number | null },
        { label: "Near suspension", value: data.unitsNearSuspension as number | null },
      ]}
      onAction={props.onAction}
    >
      <div className="space-y-2 text-sm text-slate-300">
        {incidentFrequency.length > 0 ? (
          incidentFrequency.slice(0, 4).map(([key, value]) => (
            <p key={key}>
              {key}: {value}
            </p>
          ))
        ) : (
          <p>No risk detected in this corridor</p>
        )}
      </div>
    </CardFrame>
  );
}

