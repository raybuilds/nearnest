export type DawnRole = "student" | "landlord" | "admin";

export type DawnService =
  | "trust_engine"
  | "recommendation"
  | "corridor_insight"
  | "remediation"
  | "explanation"
  | "risk_forecast"
  | "operations";

export type DawnCardType =
  | "recommendation_list"
  | "health_report"
  | "explanation_card"
  | "complaint_draft"
  | "risk_forecast"
  | "remediation_priority"
  | "corridor_insight"
  | "analytics_card";

export type DawnIntent =
  | "search_units"
  | "explain_trust"
  | "draft_complaint"
  | "unit_health"
  | "risk_alert"
  | "recurring_issues"
  | "risk_summary"
  | "remediation_advice"
  | "trust_explain"
  | "priority_actions"
  | "corridor_analysis"
  | "risk_detection"
  | "audit_priority"
  | "system_insights"
  | "trust_distribution"
  | "reset_context";

export interface DawnAction {
  label: string;
  variant?: "primary" | "secondary" | "danger" | "confirm" | "cancel";
  confirmable?: boolean;
  href?: string;
  actionType?: string;
  query?: string;
}

export interface DawnCard {
  type: DawnCardType;
  title: string;
  data: Record<string, unknown>;
  why: string;
  actions: DawnAction[];
}

export interface DawnResponse {
  intents: string[];
  service: DawnService;
  role: DawnRole;
  message: string;
  cards: DawnCard[];
  suggestions?: string[];
  summary?: {
    unitId?: number | null;
    corridorId?: number | null;
    trustScore?: number | null;
    riskLevel?: string | null;
    complaintCount?: number | null;
    intent?: string | null;
  };
}

export interface DawnContext {
  role: DawnRole | "";
  lastUnitId: number | null;
  lastCorridorId: number | null;
  lastIntent: string | null;
  lastFilters: Record<string, unknown>;
  sessionHistory: string[];
  timestamp: string | null;
}

export interface DawnQueryPayload {
  input: string;
  role: DawnRole;
}

export interface DawnCardProps {
  card: DawnCard;
  loading?: boolean;
  empty?: boolean;
}

export type DawnAvatarState = "idle" | "thinking" | "speaking" | "alert" | "listening";
