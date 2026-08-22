"use client";

import CardFrame from "@/components/cards/CardFrame";
import type { DawnAction, DawnCardProps } from "@/types/dawn";

export default function RemediationCard(props: DawnCardProps & { onAction?: (action: DawnAction) => void }) {
  const selected = (props.card.data?.selected || null) as any;
  const priorities = Array.isArray(props.card.data?.priorities) ? (props.card.data.priorities as any[]) : [];

  return (
    <CardFrame
      {...props}
      tone="risk"
      metrics={[
        { label: "Selected unit", value: selected?.unitId ?? null },
        { label: "Trust score", value: selected?.trustScore ?? null },
        { label: "Priority count", value: priorities.length },
      ]}
      onAction={props.onAction}
    >
      <div className="space-y-3 text-sm" style={{ color: "var(--text-muted)" }}>
        {selected ? (
          <>
            <p>Issue: {selected.issue}</p>
            <p>Recommendation: {selected.recommendation}</p>
          </>
        ) : (
          <p>No relevant data found</p>
        )}
      </div>
    </CardFrame>
  );
}
