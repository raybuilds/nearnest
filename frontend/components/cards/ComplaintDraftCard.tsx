"use client";

import CardFrame from "@/components/cards/CardFrame";
import type { DawnAction, DawnCardProps } from "@/types/dawn";

export default function ComplaintDraftCard(props: DawnCardProps & { onAction?: (action: DawnAction) => void }) {
  const data = props.card.data || {};

  return (
    <CardFrame
      {...props}
      tone="explanation"
      metrics={[
        { label: "Unit", value: data.unitId as number | null },
        { label: "SLA", value: data.slaPreview as string | null },
      ]}
      onAction={props.onAction}
    >
      <div className="space-y-3 text-sm text-slate-300">
        <p>{String(data.message || "")}</p>
        <p>{String(data.trustImpact || "")}</p>
      </div>
    </CardFrame>
  );
}

