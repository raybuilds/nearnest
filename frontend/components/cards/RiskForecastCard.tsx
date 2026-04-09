"use client";

import CardFrame from "@/components/cards/CardFrame";
import type { DawnAction, DawnCardProps } from "@/types/dawn";

export default function RiskForecastCard(props: DawnCardProps & { onAction?: (action: DawnAction) => void }) {
  const data = props.card.data || {};
  const indicators = Array.isArray(data.indicators) ? (data.indicators as string[]) : [];

  return (
    <CardFrame
      {...props}
      tone="risk"
      metrics={[
        { label: "Unit", value: data.unitId as number | null },
        { label: "Risk", value: (data.riskSignal || data.riskLevel) as string | null },
        { label: "Risk score", value: data.riskScore as number | null },
      ]}
      onAction={props.onAction}
    >
      <div className="space-y-2 text-sm" style={{ color: "var(--text-muted)" }}>
        {indicators.length > 0 ? indicators.map((indicator) => <p key={indicator}>{indicator}</p>) : <p>No relevant data found</p>}
        {data.recommendation ? <p style={{ color: "#ffe0aa" }}>Recommended next step: {String(data.recommendation)}</p> : null}
      </div>
    </CardFrame>
  );
}
