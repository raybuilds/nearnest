"use client";

import CardFrame from "@/components/cards/CardFrame";
import type { DawnAction, DawnCardProps } from "@/types/dawn";

export default function ExplanationCard(props: DawnCardProps & { onAction?: (action: DawnAction) => void }) {
  const data = props.card.data || {};
  const drivers = Array.isArray(data.drivers) ? (data.drivers as string[]) : [];

  return (
    <CardFrame
      {...props}
      tone="explanation"
      metrics={[
        { label: "Unit", value: data.unitId as number | null },
        { label: "Trust score", value: data.trustScore as number | null },
      ]}
      onAction={props.onAction}
    >
      <div className="space-y-2 text-sm text-slate-300">
        {drivers.length > 0 ? drivers.map((driver) => <p key={driver}>{driver}</p>) : <p>No relevant data found</p>}
      </div>
    </CardFrame>
  );
}

