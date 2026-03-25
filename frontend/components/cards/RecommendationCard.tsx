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
          <p className="text-sm text-slate-300">No relevant data found</p>
        ) : (
          units.slice(0, 4).map((unit) => (
            <div key={unit.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">Unit {unit.id}</p>
                <span className="rounded-full bg-cyan-400/15 px-2 py-1 text-xs text-cyan-100">
                  Trust {unit.trustScore}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-300">
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

