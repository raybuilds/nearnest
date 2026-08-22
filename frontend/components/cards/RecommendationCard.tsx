"use client";

import CardFrame from "@/components/cards/CardFrame";
import type { DawnAction, DawnCardProps } from "@/types/dawn";

export default function RecommendationCard(props: DawnCardProps & { onAction?: (action: DawnAction) => void }) {
  const units = Array.isArray(props.card.data?.units) ? (props.card.data.units as any[]) : [];

  return (
    <CardFrame
      {...props}
      tone="recommendation"
      metrics={[
        { label: "Visible units", value: props.card.data?.total as number | null },
        { label: "Corridor", value: props.card.data?.corridorId as number | null },
      ]}
      onAction={props.onAction}
    >
      <div className="space-y-3">
        {units.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>No relevant data found</p>
        ) : (
          units.slice(0, 4).map((unit) => (
            <div
              key={unit.id}
              className="rounded-2xl border p-3"
              style={{ borderColor: "var(--border)", background: "var(--bg-soft-strong)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>Unit {unit.id}</p>
                <span
                  className="rounded-full px-2 py-1 text-xs"
                  style={{ background: "rgba(130, 202, 255, 0.16)", color: "var(--text-main)" }}
                >
                  Trust {unit.trustScore}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <span>Band {unit.trustBand}</span>
                <span>Rent {unit.rent}</span>
                <span>{unit.distanceKm} km</span>
              </div>
            </div>
          ))
        )}
      </div>
    </CardFrame>
  );
}
