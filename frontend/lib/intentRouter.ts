"use client";

import { apiClient } from "@/lib/apiClient";
import { detectCorridorId, detectUnitId, deriveLastIntent, pushHistory, readContext, resetContext, updateContext } from "@/lib/contextStore";
import type { DawnCard, DawnIntent, DawnResponse, DawnRole } from "@/types/dawn";

function createSystemCard(type: DawnCard["type"], title: string, why: string, data: Record<string, unknown> = {}): DawnCard {
  return {
    type,
    title,
    data,
    why,
    actions: [],
  };
}

function buildExplanationCard(payload: any, unitId: number): DawnCard {
  const data = payload?.data || payload;
  return {
    type: "explanation_card",
    title: `Trust explanation for Unit ${unitId}`,
    data: {
      trustScore: data?.trustScore ?? null,
      drivers: Array.isArray(data?.drivers) ? data.drivers : [],
      unitId,
    },
    why:
      Array.isArray(data?.drivers) && data.drivers.length > 0
        ? data.drivers.join(" | ")
        : "Backend explanation did not return trust drivers.",
    actions: [],
  };
}

function buildRecommendationCard(payload: any, corridorId: number): DawnCard {
  const units = Array.isArray(payload) ? payload : [];
  return {
    type: "recommendation_list",
    title: "Visible units matched to corridor governance filters",
    data: {
      corridorId,
      total: units.length,
      units,
    },
    why:
      units.length > 0
        ? "These units are visible because backend visibility rules allowed them through the trust threshold."
        : "No units passed the active visibility and filter criteria.",
    actions: units.slice(0, 3).map((unit: any) => ({
      label: `Open Unit ${unit.id}`,
      href: `/unit/${unit.id}`,
    })),
  };
}

function buildHealthCard(payload: any, unitId: number): DawnCard {
  return {
    type: "health_report",
    title: `Unit ${unitId} health report`,
    data: payload,
    why:
      payload?.visibilityReasons?.length > 0
        ? payload.visibilityReasons.join(" | ")
        : "Backend trust and governance status determines this unit health view.",
    actions: [],
  };
}

function buildRiskCard(payload: any, unitId: number): DawnCard {
  const riskSignal = payload?.data?.riskSignal || payload?.riskSignal || payload?.data?.riskForecast || payload?.data?.[0] || payload;
  return {
    type: "risk_forecast",
    title: `Risk forecast for Unit ${unitId}`,
    data: riskSignal,
    why:
      Array.isArray(riskSignal?.indicators) && riskSignal.indicators.length > 0
        ? riskSignal.indicators.join(" | ")
        : "Backend risk service did not expose indicator detail for this request.",
    actions: [],
  };
}

function buildCorridorCard(payload: any, corridorId: number): DawnCard {
  const behavioral = payload?.behavioralInsights || payload?.riskSummary || {};
  return {
    type: "corridor_insight",
    title: `Corridor ${corridorId} intelligence`,
    data: {
      corridorId,
      complaintDensity: behavioral?.complaintDensity ?? payload?.complaintDensity ?? null,
      riskLevel: behavioral?.riskLevel ?? payload?.riskLevel ?? null,
      severeIncidents: behavioral?.severeIncidents ?? payload?.severeIncidents ?? null,
      unitsNearSuspension: behavioral?.unitsNearSuspension ?? payload?.unitsNearSuspension ?? null,
      trend14d: payload?.trend14d ?? behavioral?.trend14d ?? null,
      incidentFrequency: behavioral?.incidentFrequency ?? {},
    },
    why:
      Array.isArray(behavioral?.insights) && behavioral.insights.length > 0
        ? behavioral.insights.join(" | ")
        : "Corridor visibility pressure is based on complaint density, incidents, and enforcement exposure.",
    actions: [],
  };
}

function buildRemediationCard(payload: any, unitId: number): DawnCard {
  const priorities = payload?.data?.priorities || [];
  const match = priorities.find((item: any) => Number(item.unitId) === Number(unitId)) || priorities[0] || null;
  return {
    type: "remediation_priority",
    title: `Remediation priority for Unit ${unitId}`,
    data: {
      priorities,
      selected: match,
    },
    why: match?.issue || "Backend remediation service did not return a targeted issue.",
    actions: match
      ? [
          { label: "Confirm", variant: "confirm" },
          { label: "Cancel", variant: "cancel" },
        ]
      : [],
  };
}

function buildAnalyticsCard(payload: any, title: string): DawnCard {
  return {
    type: "analytics_card",
    title,
    data: payload?.data || payload,
    why: payload?.assistant || payload?.message || "Backend operations service returned governance analytics.",
    actions: [],
  };
}

function buildComplaintDraft(input: string, unitId: number | null): DawnCard {
  return {
    type: "complaint_draft",
    title: "Complaint draft pending confirmation",
    data: {
      unitId,
      message: input.trim(),
      slaPreview: "Expected resolution: 24-48 hrs",
      trustImpact: "This may affect unit trust score",
    },
    why: "Complaint drafting is local UI orchestration until you explicitly confirm submission.",
    actions: [
      { label: "Confirm", variant: "confirm" },
      { label: "Cancel", variant: "cancel" },
    ],
  };
}

function detectIntents(input: string, role: DawnRole): DawnIntent[] {
  const text = input.toLowerCase();
  const intents = new Set<DawnIntent>();

  if (/reset context|clear context/.test(text)) {
    intents.add("reset_context");
    return Array.from(intents);
  }

  if (role === "student") {
    if (/better option|safer unit|recommend|show unit|search/.test(text)) intents.add("search_units");
    if (/why|explain trust|trust score/.test(text)) intents.add("explain_trust");
    if (/draft complaint|complaint|report issue/.test(text)) intents.add("draft_complaint");
    if (/health|status|visible|hidden/.test(text)) intents.add("unit_health");
    if (/risk|risky|unsafe|alert/.test(text)) intents.add("risk_alert");
  }

  if (role === "landlord") {
    if (/recurring|repeat|pattern/.test(text)) intents.add("recurring_issues");
    if (/risk|at risk|exposure/.test(text)) intents.add("risk_summary");
    if (/remediation|fix|priority actions|what should i fix/.test(text)) intents.add("remediation_advice");
    if (/explain trust|trust score|why/.test(text)) intents.add("trust_explain");
    if (/priority actions|first/.test(text)) intents.add("priority_actions");
  }

  if (role === "admin") {
    if (/corridor|heatmap|distribution/.test(text)) intents.add("corridor_analysis");
    if (/risk|detect|warning|critical/.test(text)) intents.add("risk_detection");
    if (/audit|priority/.test(text)) intents.add("audit_priority");
    if (/system|operations|clusters/.test(text)) intents.add("system_insights");
    if (/trust distribution|distribution/.test(text)) intents.add("trust_distribution");
  }

  if (intents.size === 0) {
    if (role === "student") intents.add("explain_trust");
    if (role === "landlord") intents.add("risk_summary");
    if (role === "admin") intents.add("system_insights");
  }

  return Array.from(intents);
}

function serviceForIntent(intent: DawnIntent): DawnResponse["service"] {
  if (intent === "search_units") return "recommendation";
  if (intent === "explain_trust" || intent === "trust_explain") return "explanation";
  if (intent === "draft_complaint") return "operations";
  if (intent === "unit_health") return "trust_engine";
  if (intent === "risk_alert" || intent === "risk_summary" || intent === "risk_detection") return "risk_forecast";
  if (intent === "remediation_advice" || intent === "priority_actions") return "remediation";
  if (intent === "corridor_analysis" || intent === "trust_distribution") return "corridor_insight";
  return "operations";
}

export async function routeDawnIntent(input: string, role: DawnRole): Promise<DawnResponse> {
  const text = input.trim();
  const currentContext = readContext(role);

  if (!text) {
    return {
      intents: [],
      service: "explanation",
      role,
      message: "Please specify unit or corridor",
      cards: [createSystemCard("explanation_card", "Missing context", "Dawn needs a unit or corridor target to query backend services.")],
    };
  }

  if (/reset context|clear context/i.test(text)) {
    resetContext(role);
    return {
      intents: ["reset_context"],
      service: "operations",
      role,
      message: "Context cleared",
      cards: [createSystemCard("analytics_card", "Context reset", "Session memory was cleared, so follow-up queries will no longer reuse unit or corridor context.")],
    };
  }

  const intents = detectIntents(text, role);
  const unitId = detectUnitId(text, currentContext.lastUnitId);
  const corridorId = detectCorridorId(text, currentContext.lastCorridorId);
  const cards: DawnCard[] = [];

  pushHistory(role, text);

  try {
    await Promise.all(
      intents.map(async (intent) => {
        if (intent === "draft_complaint") {
          cards.push(buildComplaintDraft(text, unitId));
          return;
        }

        if (intent === "search_units") {
          if (!corridorId) {
            cards.push(createSystemCard("recommendation_list", "Missing corridor", "Please specify unit or corridor"));
            return;
          }
          const payload = await apiClient.getRecommendations({
            corridorId,
            ...(currentContext.lastFilters || {}),
          });
          cards.push(buildRecommendationCard(payload, corridorId));
          return;
        }

        if (intent === "explain_trust" || intent === "trust_explain") {
          if (!unitId) {
            cards.push(createSystemCard("explanation_card", "Missing unit", "Please specify unit or corridor"));
            return;
          }
          const payload = await apiClient.getExplain(unitId);
          cards.push(buildExplanationCard(payload, unitId));
          return;
        }

        if (intent === "unit_health") {
          if (!unitId) {
            cards.push(createSystemCard("health_report", "Missing unit", "Please specify unit or corridor"));
            return;
          }
          const payload = await apiClient.getTrust(unitId);
          cards.push(buildHealthCard(payload, unitId));
          return;
        }

        if (intent === "risk_alert" || intent === "risk_summary") {
          if (!unitId) {
            cards.push(createSystemCard("risk_forecast", "Missing unit", "Please specify unit or corridor"));
            return;
          }
          const payload = await apiClient.getRisk(unitId);
          cards.push(buildRiskCard(payload, unitId));
          return;
        }

        if (intent === "remediation_advice" || intent === "priority_actions") {
          if (!unitId) {
            cards.push(createSystemCard("remediation_priority", "Missing unit", "Please specify unit or corridor"));
            return;
          }
          const payload = await apiClient.getRemediation(unitId);
          cards.push(buildRemediationCard(payload, unitId));
          return;
        }

        if (intent === "corridor_analysis" || intent === "trust_distribution") {
          if (!corridorId) {
            cards.push(createSystemCard("corridor_insight", "Missing corridor", "Please specify unit or corridor"));
            return;
          }
          const payload = await apiClient.getCorridor(corridorId);
          cards.push(buildCorridorCard(payload, corridorId));
          return;
        }

        if (intent === "risk_detection" || intent === "audit_priority" || intent === "system_insights" || intent === "recurring_issues") {
          const payload = await apiClient.getOperations(intent);
          cards.push(buildAnalyticsCard(payload, "Operational intelligence"));
        }
      })
    );

    updateContext(role, {
      lastIntent: deriveLastIntent(intents),
      lastUnitId: unitId,
      lastCorridorId: corridorId,
    });

    return {
      intents,
      service: serviceForIntent(intents[0]),
      role,
      message: cards.length > 0 ? "Structured intelligence retrieved" : "No relevant data found",
      cards:
        cards.length > 0
          ? cards
          : [createSystemCard("analytics_card", "No data", "No relevant data found")],
    };
  } catch (error) {
    return {
      intents,
      service: serviceForIntent(intents[0]),
      role,
      message: "Unable to retrieve data",
      cards: [
        createSystemCard("analytics_card", "Request failed", error instanceof Error ? error.message : "Unable to retrieve data"),
      ],
    };
  }
}
