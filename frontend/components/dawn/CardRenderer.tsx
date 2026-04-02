"use client";

import AnalyticsCard from "@/components/cards/AnalyticsCard";
import ComplaintDraftCard from "@/components/cards/ComplaintDraftCard";
import CorridorInsightCard from "@/components/cards/CorridorInsightCard";
import ExplanationCard from "@/components/cards/ExplanationCard";
import HealthReportCard from "@/components/cards/HealthReportCard";
import RecommendationCard from "@/components/cards/RecommendationCard";
import RemediationCard from "@/components/cards/RemediationCard";
import RiskForecastCard from "@/components/cards/RiskForecastCard";
import type { DawnAction, DawnCard } from "@/types/dawn";

type CardRendererProps = {
  cards: DawnCard[];
  loading?: boolean;
  onAction?: (action: DawnAction) => void;
};

export default function CardRenderer({ cards, loading, onAction }: CardRendererProps) {
  if (cards.length === 0) {
    return <AnalyticsCard card={{ type: "analytics_card", title: "No data", data: {}, why: "No relevant data found", actions: [] }} empty />;
  }

  return (
    <div className="space-y-4">
      {cards.map((card, index) => {
        const key = `${card.type}-${card.title}-${index}`;

        switch (card.type) {
          case "recommendation_list":
            return <RecommendationCard key={key} card={card} loading={loading} onAction={onAction} />;
          case "health_report":
            return <HealthReportCard key={key} card={card} loading={loading} onAction={onAction} />;
          case "explanation_card":
            return <ExplanationCard key={key} card={card} loading={loading} onAction={onAction} />;
          case "complaint_draft":
            return <ComplaintDraftCard key={key} card={card} loading={loading} onAction={onAction} />;
          case "risk_forecast":
            return <RiskForecastCard key={key} card={card} loading={loading} onAction={onAction} />;
          case "remediation_priority":
            return <RemediationCard key={key} card={card} loading={loading} onAction={onAction} />;
          case "corridor_insight":
            return <CorridorInsightCard key={key} card={card} loading={loading} onAction={onAction} />;
          default:
            return <AnalyticsCard key={key} card={card} loading={loading} onAction={onAction} />;
        }
      })}
    </div>
  );
}
