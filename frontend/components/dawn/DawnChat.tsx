"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CardRenderer from "@/components/dawn/CardRenderer";
import DawnAvatar from "@/components/dawn/DawnAvatar";
import DawnVoiceControls from "@/components/dawn/DawnVoiceControls";
import { getDawnInsights, queryDawn, speakDawn } from "@/lib/api";
import { getRiskTone, getTrustBand } from "@/lib/governance";
import { getStoredRole } from "@/lib/session";
import type { DawnAction, DawnAvatarState, DawnCard, DawnResponse, DawnRole } from "@/types/dawn";

type DawnChatProps = {
  open: boolean;
  onClose: () => void;
  pageContext?: {
    unitId?: number | null;
    corridorId?: number | null;
  };
};

type DawnSummary = NonNullable<DawnResponse["summary"]>;
type SpeechRecognitionConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function scoreVoice(voice: SpeechSynthesisVoice) {
  const name = String(voice.name || "").toLowerCase();
  const lang = String(voice.lang || "").toLowerCase();
  let score = 0;

  if (lang.startsWith("en-in")) score += 60;
  else if (lang.startsWith("en-gb")) score += 45;
  else if (lang.startsWith("en-us")) score += 35;
  else if (lang.startsWith("en")) score += 20;

  if (/female|woman|zira|hazel|susan|samantha|serena|karen|moira|veena|rishi|aria|jenny|salli|sonia/i.test(name)) {
    score += 70;
  }

  if (/google uk english female|microsoft zira|microsoft hazel|samantha|susan|serena|aria/i.test(name)) {
    score += 40;
  }

  if (/male|david|mark|guy|james|george|richard|ryan/i.test(name)) {
    score -= 30;
  }

  if (voice.default) score += 8;

  return score;
}

function getPreferredDawnVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  return [...voices].sort((left, right) => scoreVoice(right) - scoreVoice(left))[0] || null;
}

const STARTER_PROMPTS: Record<DawnRole, string[]> = {
  student: [
    "Find safe rooms under ₹8000",
    "Why is my unit risky?",
    "Report an issue",
  ],
  landlord: [
    "What should I fix first?",
    "Which units are at risk?",
  ],
  admin: [
    "Which corridor is risky?",
    "Units needing attention",
  ],
};

function normalizeRole(value: string): DawnRole | null {
  if (value === "student" || value === "landlord" || value === "admin") return value;
  return null;
}

function toCards(payload: any): DawnCard[] {
  const intent = String(payload?.intent || "");

  if (intent === "student_search") {
    const recommendations = Array.isArray(payload?.data?.recommendations) ? payload.data.recommendations : [];
    return [
      {
        type: "recommendation_list",
        title: "Safe room recommendations",
        data: {
          corridorId: payload?.summary?.corridorId ?? payload?.context?.corridorId ?? null,
          total: payload?.data?.totalMatched ?? recommendations.length,
          units: recommendations,
        },
        why: payload?.assistant || payload?.message || "These results were ranked by trust, rent, and distance.",
        actions: recommendations.slice(0, 3).map((unit: any) => ({
          label: `Open Unit ${unit.id}`,
          href: `/unit/${unit.id}`,
        })),
      },
    ];
  }

  if (intent === "student_complaint") {
    const preview = payload?.data?.preview || payload?.data?.draft || {};
    const waitingForFields = Array.isArray(payload?.data?.missingFields) ? payload.data.missingFields : [];
    const actions: DawnAction[] = payload?.requiresConfirmation
      ? [
          { label: "Confirm complaint", variant: "confirm", actionType: "confirm" },
          { label: "Cancel", variant: "cancel", actionType: "cancel" },
        ]
      : [];

    return [
      {
        type: "complaint_draft",
        title: waitingForFields.length > 0 ? "Complaint details needed" : "Complaint draft",
        data: {
          unitId: preview.unitId ?? payload?.summary?.unitId ?? null,
          message: preview.message || payload?.assistant || "",
          trustImpact: waitingForFields.length > 0
            ? `Still needed: ${waitingForFields.join(", ")}`
            : payload?.requiresConfirmation
              ? "Submitting this complaint will create a governance event and may affect trust."
              : "Complaint flow complete.",
          slaPreview: preview.duration ? `Issue duration: ${preview.duration}` : "Expected response target: 24-48 hours",
          severity: preview.severity ?? null,
          incidentType: preview.incidentType ?? null,
        },
        why: payload?.assistant || "Dawn is guiding the complaint through structured confirmation.",
        actions,
      },
    ];
  }

  if (intent === "student_unit_health") {
    const report = payload?.data?.healthReport || payload?.data || {};
    return [
      {
        type: "health_report",
        title: "Unit health report",
        data: {
          trustScore: report?.trustScore ?? payload?.summary?.trustScore ?? null,
          trustBand: report?.trustBand ?? null,
          complaintsLast30Days: report?.complaintsLast30Days ?? payload?.summary?.complaintCount ?? null,
          slaBreaches30Days: report?.slaBreaches30Days ?? null,
          status: report?.trend ?? report?.status ?? "active",
          auditRequired: Boolean(report?.auditRequired),
          visibilityReasons: report?.riskSignals || report?.visibilityReasons || [report?.summary || payload?.assistant].filter(Boolean),
        },
        why: report?.summary || payload?.assistant || "Dawn summarized trust and complaint pressure for your unit.",
        actions: [],
      },
    ];
  }

  if (intent === "predict_unit_risk") {
    const risk = payload?.data?.riskSignal || payload?.data?.riskForecast || payload?.data || {};
    return [
      {
        type: "risk_forecast",
        title: "Unit risk forecast",
        data: risk,
        why: payload?.assistant || "Dawn highlighted the main forecast indicators for this unit.",
        actions: [],
      },
    ];
  }

  if (intent === "explain_unit_trust") {
    const trust = payload?.data || {};
    return [
      {
        type: "explanation_card",
        title: `Trust explanation for Unit ${trust?.unitId || payload?.summary?.unitId || ""}`.trim(),
        data: {
          trustScore: trust?.trustScore ?? payload?.summary?.trustScore ?? null,
          drivers: trust?.drivers || [],
          unitId: trust?.unitId ?? payload?.summary?.unitId ?? null,
        },
        why: payload?.assistant || "Dawn summarized the strongest trust drivers for this unit.",
        actions: [],
      },
    ];
  }

  if (intent === "explain_unit_overview") {
    const trust = payload?.data?.trust || {};
    const health = payload?.data?.healthReport || {};
    const risk = payload?.data?.riskForecast || {};
    const resolvedTrustScore =
      health?.trustScore ??
      trust?.trustScore ??
      payload?.summary?.trustScore ??
      null;
    const resolvedTrustBand =
      health?.trustBand ??
      trust?.trustBand ??
      null;
    const resolvedAuditRequired =
      health?.auditRequired ??
      trust?.auditRequired ??
      false;
    const resolvedReasons =
      health?.riskSignals ||
      health?.visibilityReasons ||
      trust?.visibilityReasons ||
      [health?.summary].filter(Boolean);
    return [
      {
        type: "explanation_card",
        title: `Trust breakdown for Unit ${payload?.data?.unitId ?? payload?.summary?.unitId ?? ""}`.trim(),
        data: {
          trustScore: trust?.trustScore ?? payload?.summary?.trustScore ?? null,
          drivers: trust?.drivers || [],
          unitId: payload?.data?.unitId ?? payload?.summary?.unitId ?? null,
        },
        why: "Trust explanation",
        actions: [],
      },
      {
        type: "health_report",
        title: "Complaint and health summary",
        data: {
          trustScore: resolvedTrustScore,
          trustBand: resolvedTrustBand,
          complaintsLast30Days: health?.complaintsLast30Days ?? payload?.summary?.complaintCount ?? null,
          slaBreaches30Days: health?.slaBreaches30Days ?? null,
          status: health?.trend ?? "active",
          auditRequired: Boolean(resolvedAuditRequired),
          visibilityReasons: resolvedReasons,
        },
        why: health?.summary || "Unit health summary",
        actions: [],
      },
      {
        type: "risk_forecast",
        title: "Risk forecast",
        data: risk,
        why: risk?.recommendation || payload?.assistant || "Forecasted risk signals for this unit.",
        actions: [],
      },
    ];
  }

  if (intent === "recommend_unit_decision") {
    const data = payload?.data || {};
    return [
      {
        type: "analytics_card",
        title: `Decision guidance for Unit ${data?.unitId ?? payload?.summary?.unitId ?? ""}`.trim(),
        data,
        why: payload?.assistant || data?.verdict || "Dawn summarized the current decision signals for this unit.",
        actions: [],
      },
    ];
  }

  if (intent === "compare_units") {
    const data = payload?.data || {};
    return [
      {
        type: "analytics_card",
        title: "Unit comparison",
        data,
        why: payload?.assistant || data?.verdict || "Dawn compared the strongest unit signals side by side.",
        actions: [],
      },
    ];
  }

  if (intent === "system_health_summary") {
    const data = payload?.data || {};
    return [
      {
        type: "analytics_card",
        title: "System health summary",
        data,
        why: payload?.assistant || data?.summary || "Dawn summarized the current system health for your role.",
        actions: [],
      },
    ];
  }

  if (intent === "operations_advisor") {
    const alerts = Array.isArray(payload?.data?.alerts)
      ? payload.data.alerts
      : Array.isArray(payload?.alerts)
        ? payload.alerts
        : [];
    return alerts.length > 0
      ? alerts.map((alert: any, index: number) => ({
          type: "analytics_card",
          title: alert?.title || `Operations item ${index + 1}`,
          data: {
            priority: alert?.priority || alert?.riskLevel || "LOW",
            action: alert?.action || null,
            reason: alert?.reason || null,
            message: alert?.message || "",
            units: Array.isArray(alert?.units) ? alert.units : [],
            corridors: Array.isArray(alert?.corridors) ? alert.corridors : [],
          },
          why: payload?.assistant || alert?.message || "Dawn ranked the next operational action for you.",
          actions: Array.isArray(alert?.actions)
            ? alert.actions.map((action: any) => ({
                label: action?.label || "Open",
                query: action?.query || "",
              }))
            : [],
        }))
      : [
          {
            type: "analytics_card",
            title: payload?.message || "Operations advisor",
            data: payload?.data || {},
            why: payload?.assistant || "Dawn analyzed the available backend signals.",
            actions: [],
          },
        ];
  }

  if (intent === "landlord_remediation_advisor") {
    return [
      {
        type: "remediation_priority",
        title: "Remediation priorities",
        data: payload?.data || {},
        why: payload?.assistant || payload?.message || "Dawn ranked the highest-value fixes first.",
        actions: [],
      },
    ];
  }

  if (intent === "corridor_behavioral_insight") {
    const data = payload?.data || {};
    return [
      {
        type: "corridor_insight",
        title: "Corridor intelligence",
        data: {
          corridorId: data?.corridorId ?? payload?.summary?.corridorId ?? null,
          complaintDensity: data?.complaintDensity ?? data?.complaintsLast30Days ?? null,
          riskLevel: data?.riskLevel ?? payload?.summary?.riskLevel ?? null,
          severeIncidents: data?.severeIncidents ?? null,
          unitsNearSuspension: data?.unitsNearSuspension ?? null,
          trend14d: data?.trend14d ?? null,
          incidentFrequency: data?.incidentFrequency ?? {},
        },
        why: payload?.assistant || payload?.message || "Dawn summarized corridor-level operating pressure.",
        actions: [],
      },
    ];
  }

  return [
    {
      type: "analytics_card",
      title: payload?.message || "Operational intelligence",
      data: Array.isArray(payload?.data) ? { units: payload.data } : payload?.data || payload || {},
      why: payload?.assistant || "Dawn analyzed the available backend signals.",
      actions: [],
    },
  ];
}

function toInsightCards(payload: any): DawnCard[] {
  const insights = Array.isArray(payload?.insights) ? payload.insights : [];
  return insights.map((alert: any, index: number) => ({
    type: "analytics_card",
    title: alert?.title || `Proactive alert ${index + 1}`,
    data: {
      severity: alert?.severity || alert?.riskLevel || "LOW",
      unitId: alert?.unitId ?? null,
      message: alert?.message || "",
      units: Array.isArray(alert?.units) ? alert.units : [],
      corridors: Array.isArray(alert?.corridors) ? alert.corridors : [],
      indicators: Array.isArray(alert?.indicators) ? alert.indicators : [],
      action: alert?.action || null,
      reason: alert?.reason || null,
    },
    why: alert?.message || payload?.assistant || "Dawn found something worth reviewing right away.",
    actions: Array.isArray(alert?.actions)
      ? alert.actions.map((action: any) => ({
          label: action?.label || "Open",
          query: action?.query || "",
        }))
      : [],
  }));
}

function toResponse(payload: any, role: DawnRole): DawnResponse {
  return {
    intents: [String(payload?.intent || "operations_advisor")],
    service: "operations",
    role,
    message: payload?.assistant || payload?.message || "Dawn processed the available intelligence.",
    cards: toCards(payload),
    suggestions: Array.isArray(payload?.suggestions) ? payload.suggestions : [],
    summary: payload?.summary || undefined,
  };
}

function summaryTitle(role: DawnRole | null, summary?: DawnSummary | null) {
  if (!summary) return "Live context";
  if (role === "admin") return summary.corridorId ? `Corridor ${summary.corridorId}` : "Admin watch";
  return summary.unitId ? `Unit ${summary.unitId}` : "Role context";
}

function conversationLabel(response: DawnResponse | null) {
  if (!response) return "Conversation";
  if (response.intents.includes("operations_advisor")) return "Alerts and actions";
  if (response.intents.includes("system_health_summary")) return "System snapshot";
  if (response.intents.includes("recommend_unit_decision")) return "Recommendation";
  return "Assistant response";
}

function typingDots() {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-200" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-200 [animation-delay:120ms]" />
      <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-200 [animation-delay:240ms]" />
    </div>
  );
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition || null;
}

function hasSpeechSynthesisSupport() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance !== "undefined";
}

function hasAudioPlaybackSupport() {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

export default function DawnChat({ open, onClose, pageContext }: DawnChatProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<DawnResponse | null>(null);
  const [backendPayload, setBackendPayload] = useState<any>(null);
  const [notice, setNotice] = useState("");
  const [role, setRole] = useState<DawnRole | null>(null);
  const [insightMessage, setInsightMessage] = useState("");
  const [bootstrapped, setBootstrapped] = useState(false);
  const [avatarEnabled, setAvatarEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [avatarState, setAvatarState] = useState<DawnAvatarState>("idle");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [capabilitiesChecked, setCapabilitiesChecked] = useState(false);
  const [voiceProfile, setVoiceProfile] = useState("indian_en_female");
  const [activeVoiceLabel, setActiveVoiceLabel] = useState("System fallback");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null);
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldSpeakNextResponseRef = useRef(false);
  const manualStopListeningRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const syncRole = () => {
      setRole(normalizeRole(getStoredRole()));
    };

    syncRole();
    window.addEventListener("nearnest:session-changed", syncRole);
    window.addEventListener("focus", syncRole);

    return () => {
      window.removeEventListener("nearnest:session-changed", syncRole);
      window.removeEventListener("focus", syncRole);
    };
  }, []);

  useEffect(() => {
    setSpeechSupported(Boolean(getSpeechRecognitionConstructor()));
    setVoiceSupported(hasAudioPlaybackSupport());
    setCapabilitiesChecked(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const syncVoices = () => {
      const preferredVoice = getPreferredDawnVoice();
      setActiveVoiceLabel(preferredVoice?.name || "System fallback");
    };

    syncVoices();
    window.speechSynthesis.onvoiceschanged = syncVoices;

    return () => {
      if (window.speechSynthesis.onvoiceschanged === syncVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      recognitionRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      recognitionRef.current?.stop();
      setListening(false);
      setAvatarState("idle");
      setSettingsOpen(false);
    }
  }, [open]);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!open || !role) return;
      setBootstrapped(true);
      try {
        const payload = await getDawnInsights();
        if (!active) return;
        setInsightMessage(payload?.assistant || "");
        if (Array.isArray(payload?.insights) && payload.insights.length > 0) {
          setBackendPayload(payload);
          setResponse((current) => current || {
            intents: ["operations_advisor"],
            service: "operations",
            role,
            message: payload?.assistant || "Proactive intelligence is available.",
            cards: toInsightCards(payload),
            suggestions: Array.isArray(payload?.suggestions) ? payload.suggestions : STARTER_PROMPTS[role],
            summary: payload?.summary || undefined,
          });
        }
      } catch {
        if (active) setInsightMessage("");
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [open, role]);

  useEffect(() => {
    if (!response || !shouldSpeakNextResponseRef.current) return;
    shouldSpeakNextResponseRef.current = false;

    if (speakingTimerRef.current) {
      clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }

    if (!voiceEnabled || !voiceSupported || !response.message) {
      setAvatarState("alert");
      speakingTimerRef.current = setTimeout(() => setAvatarState("idle"), 900);
      return;
    }
    void playVoiceResponse(response.message);
  }, [response, voiceEnabled, voiceSupported, voiceProfile]);

  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "No session";
  const starterPrompts = role ? STARTER_PROMPTS[role] : [];
  const summary = response?.summary || null;
  const trustBand = summary?.trustScore !== null && summary?.trustScore !== undefined ? getTrustBand(summary.trustScore) : null;
  const nextSuggestions = response?.suggestions?.length ? response.suggestions : starterPrompts;
  const hasResponse = Boolean(response);
  const leadingAlertCard = response?.intents?.includes("operations_advisor") && response?.cards?.length ? response.cards[0] : null;
  const remainingCards = leadingAlertCard ? response?.cards?.slice(1) || [] : response?.cards || [];

  const intentSummary = useMemo(() => {
    if (loading) return "Reviewing the latest housing signals";
    if (response?.intents?.length) return response.intents.join(", ");
    return "Guided assistant ready";
  }, [loading, response]);

  const onlineLabel = loading ? "Reviewing" : "Online";

  function fillPrompt(prompt: string) {
    setInput(prompt);
    setNotice("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function cancelSpeech() {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (speakingTimerRef.current) {
      clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }
  }

  function speakWithBrowserFallback(text: string) {
    if (!voiceSupported || typeof window === "undefined" || !("speechSynthesis" in window) || !text) {
      setAvatarState("idle");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const preferredVoice = getPreferredDawnVoice();
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
      setActiveVoiceLabel(`${preferredVoice.name} (fallback)`);
    } else {
      setActiveVoiceLabel("System fallback");
    }
    utterance.rate = 0.96;
    utterance.pitch = 0.94;
    utterance.volume = 1;
    utterance.onstart = () => setAvatarState("speaking");
    utterance.onend = () => setAvatarState("idle");
    utterance.onerror = () => {
      setAvatarState("alert");
      setNotice("Voice playback was interrupted. Dawn text responses still work normally.");
      speakingTimerRef.current = setTimeout(() => setAvatarState("idle"), 900);
    };
    window.speechSynthesis.speak(utterance);
  }

  async function playVoiceResponse(text: string) {
    try {
      setAvatarState("speaking");
      const payload = await speakDawn({
        text,
        voiceProfile,
      });

      if (!payload?.blob) {
        throw new Error("Speech audio was not returned.");
      }

      const audioUrl = URL.createObjectURL(payload.blob);
      currentAudioUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;
      setActiveVoiceLabel(payload.headers.get("X-Dawn-Voice-Profile") || activeVoiceLabel);
      audio.onended = () => {
        setAvatarState("idle");
        if (currentAudioUrlRef.current) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
          currentAudioUrlRef.current = null;
        }
        currentAudioRef.current = null;
      };
      audio.onerror = () => {
        setNotice("Dedicated Dawn voice failed. Falling back to browser voice.");
        speakWithBrowserFallback(text);
      };
      await audio.play();
    } catch {
      setNotice("Dedicated Dawn voice is unavailable right now. Falling back to browser voice.");
      speakWithBrowserFallback(text);
    }
  }

  function stopListening() {
    manualStopListeningRef.current = true;
    recognitionRef.current?.stop();
    setListening(false);
    setAvatarState("idle");
  }

  function sendPrompt(prompt: string) {
    setInput(prompt);
    void handleSubmit(undefined, prompt);
  }

  async function handleSubmit(event?: React.FormEvent, promptOverride?: string) {
    event?.preventDefault();
    const prompt = (promptOverride ?? input).trim();
    if (!prompt || !role || loading) return;

    setLoading(true);
    setNotice("");
    setAvatarState("thinking");
    shouldSpeakNextResponseRef.current = true;
    cancelSpeech();
    if (listening) stopListening();

    try {
      const payload = await queryDawn({
        message: prompt,
        ...(pageContext?.unitId ? { unitId: pageContext.unitId } : {}),
        ...(pageContext?.corridorId ? { corridorId: pageContext.corridorId } : {}),
      });
      setBackendPayload(payload);
      const next = toResponse(payload, role);
      setResponse(next);
      if (promptOverride) {
        setInput(promptOverride);
      }
    } catch (error) {
      shouldSpeakNextResponseRef.current = false;
      setAvatarState("alert");
      setNotice(error instanceof Error ? error.message : "Unable to retrieve data");
    } finally {
      setLoading(false);
      if (!shouldSpeakNextResponseRef.current && !voiceEnabled) {
        speakingTimerRef.current = setTimeout(() => setAvatarState("idle"), 900);
      }
    }
  }

  function toggleListening() {
    if (!capabilitiesChecked) {
      setNotice("Checking voice support...");
      return;
    }
    if (!speechSupported) {
      setNotice("Speech input is not supported in this browser.");
      return;
    }

    if (listening) {
      stopListening();
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setNotice("Speech input is not supported in this browser.");
      return;
    }

    cancelSpeech();
    manualStopListeningRef.current = false;
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setInput(transcript);
        void handleSubmit(undefined, transcript);
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      setAvatarState("alert");
      if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
        setNotice("Microphone access was denied. You can keep using Dawn with typing.");
      } else {
        setNotice("Voice input could not start. You can keep using Dawn with typing.");
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      if (!loading) {
        setAvatarState(manualStopListeningRef.current ? "idle" : "alert");
        speakingTimerRef.current = setTimeout(() => setAvatarState("idle"), 700);
      }
      manualStopListeningRef.current = false;
    };

    recognitionRef.current = recognition;
    setListening(true);
    setAvatarState("listening");
    setNotice("Listening for your query...");
    recognition.start();
  }

  function handleAction(action: DawnAction) {
    if (action?.query) {
      sendPrompt(action.query);
      return;
    }

    const label = String(action?.label || "").toLowerCase();
    if (label.includes("confirm")) {
      if (!role) return;
      setLoading(true);
      setNotice("");
      setAvatarState("thinking");
      shouldSpeakNextResponseRef.current = true;
      cancelSpeech();
      void queryDawn({
        message: input.trim() || "confirm complaint",
        confirm: true,
        action: backendPayload?.action || null,
        ...(pageContext?.unitId ? { unitId: pageContext.unitId } : {}),
        ...(pageContext?.corridorId ? { corridorId: pageContext.corridorId } : {}),
      })
        .then((payload) => {
          setBackendPayload(payload);
          setResponse(toResponse(payload, role));
        })
        .catch((error) => {
          shouldSpeakNextResponseRef.current = false;
          setAvatarState("alert");
          setNotice(error instanceof Error ? error.message : "Unable to confirm complaint");
        })
        .finally(() => {
          setLoading(false);
        });
      return;
    }
    if (label.includes("cancel")) {
      setNotice("Complaint flow cancelled. You can start a new draft any time.");
      setInput("");
      return;
    }
    setNotice(`${action.label} is available as a guided next step.`);
  }

  return (
    <div
      className={`fixed bottom-24 right-4 z-50 w-[min(94vw,40rem)] transition duration-300 sm:right-6 ${
        open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
      }`}
    >
      <div className="dawn-panel flex max-h-[82vh] flex-col overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="mx-auto flex max-w-xl items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-[family:var(--font-display)] text-xl" style={{ color: "var(--text-main)" }}>Dawn</p>
                <span className="text-sm" style={{ color: "var(--accent-teal)" }}>Online {onlineLabel === "Reviewing" ? "/ reviewing" : ""}</span>
              </div>
              <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>{intentSummary}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.22em]" style={{ border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                {roleLabel}
              </span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSettingsOpen((value) => !value)}
                  className="rounded-full px-3 py-2 text-sm transition"
                  style={{ border: "1px solid var(--border)", color: "var(--text-main)", background: "var(--bg-soft)" }}
                  aria-label="Dawn settings"
                >
                  Settings
                </button>
                {settingsOpen ? (
                  <div className="absolute right-0 top-12 z-10 w-72">
                    <DawnVoiceControls
                      avatarEnabled={avatarEnabled}
                      voiceEnabled={voiceEnabled}
                      voiceProfile={voiceProfile}
                      listening={listening}
                      speechSupported={speechSupported}
                      voiceSupported={voiceSupported}
                      onToggleAvatar={() => setAvatarEnabled((value) => !value)}
                      onToggleVoice={() => {
                        if (!capabilitiesChecked) {
                          setNotice("Checking voice support...");
                          return;
                        }
                        if (!voiceSupported) {
                          setNotice("Voice output is not supported in this browser.");
                          return;
                        }
                        setVoiceEnabled((value) => {
                          if (value) cancelSpeech();
                          return !value;
                        });
                      }}
                      onToggleListening={toggleListening}
                      onVoiceProfileChange={setVoiceProfile}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mx-auto flex max-w-xl flex-col gap-6">
            {summary ? (
              <section className="rounded-2xl p-4" style={{ background: "var(--bg-soft)", border: "1px solid var(--border)" }}>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>{summaryTitle(role, summary)}</p>
                    <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>Current context</p>
                  </div>
                  {trustBand ? <span className={`signal-chip ${trustBand.tone}`}>{trustBand.label}</span> : null}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl px-4 py-3" style={{ background: "var(--bg-soft-strong)" }}>
                    <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Trust</p>
                    <p className="mt-2 text-lg font-semibold" style={{ color: "var(--text-main)" }}>{summary.trustScore ?? "--"}</p>
                  </div>
                  <div className="rounded-xl px-4 py-3" style={{ background: "var(--bg-soft-strong)" }}>
                    <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Risk</p>
                    <div className="mt-2">
                      <span className={`signal-chip ${getRiskTone(summary.riskLevel || "info")}`}>{summary.riskLevel || "--"}</span>
                    </div>
                  </div>
                  <div className="rounded-xl px-4 py-3" style={{ background: "var(--bg-soft-strong)" }}>
                    <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Complaints</p>
                    <p className="mt-2 text-lg font-semibold" style={{ color: "var(--text-main)" }}>{summary.complaintCount ?? "--"}</p>
                  </div>
                </div>
              </section>
            ) : null}

            {!hasResponse && !loading ? (
              <section className="rounded-2xl p-5" style={{ background: "var(--bg-soft)", border: "1px solid var(--border)" }}>
                <p className="font-[family:var(--font-display)] text-2xl" style={{ color: "var(--text-main)" }}>Ask Dawn anything about your housing</p>
                <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-muted)" }}>
                  Use a prompt below or type your own question. Dawn can explain trust, surface risk, guide complaints, and recommend next steps.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {starterPrompts.length > 0 ? starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendPrompt(prompt)}
                      className="rounded-full px-3 py-2 text-sm transition"
                      style={{ border: "1px solid var(--border)", background: "var(--bg-soft-strong)", color: "var(--text-main)" }}
                    >
                      {prompt}
                    </button>
                  )) : <span className="text-sm" style={{ color: "var(--text-soft)" }}>Sign in to unlock Dawn prompts.</span>}
                </div>
              </section>
            ) : null}

            {notice ? (
              <div className="rounded-2xl px-4 py-3 text-sm" style={{ background: "rgba(242,198,125,0.12)", color: "var(--text-main)" }}>
                {notice}
              </div>
            ) : null}

            {leadingAlertCard ? (
              <section className="rounded-2xl px-4 py-4" style={{ background: "rgba(242,198,125,0.1)", border: "1px solid rgba(242,198,125,0.18)" }}>
                <div className="flex items-start gap-3">
                  {avatarEnabled ? <DawnAvatar state="alert" enabled compact /> : null}
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>Alert</p>
                    <p className="mt-2 text-sm leading-6" style={{ color: "var(--text-main)" }}>{leadingAlertCard.why}</p>
                    {leadingAlertCard.actions.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {leadingAlertCard.actions.map((action) => (
                          <button
                            key={`${leadingAlertCard.title}-${action.label}`}
                            type="button"
                            onClick={() => handleAction(action)}
                            className="rounded-full px-3 py-2 text-sm transition"
                            style={{ border: "1px solid var(--border)", background: "var(--bg-soft-strong)", color: "var(--text-main)" }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="space-y-4">
              <div className="flex items-start gap-3">
                {avatarEnabled ? <DawnAvatar state={avatarState} enabled compact /> : null}
                <div className="min-w-0 flex-1 rounded-2xl px-4 py-4" style={{ background: "var(--bg-soft)", border: "1px solid var(--border)" }}>
                  <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: "var(--text-soft)" }}>{conversationLabel(response)}</p>
                  <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-main)" }}>
                    {loading ? "" : response?.message || "Dawn is ready when you are."}
                  </p>
                  {loading ? (
                    <div className="space-y-3">
                      {typingDots()}
                      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Reviewing trust, risk, and operational signals...</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {response && remainingCards.length > 0 ? (
                <div className="ml-0 sm:ml-[3.25rem] max-w-[34rem]">
                  <CardRenderer cards={remainingCards} loading={loading} onAction={handleAction} />
                </div>
              ) : null}

              <div className="ml-0 flex flex-wrap gap-2 sm:ml-[3.25rem]">
                {nextSuggestions.length > 0 ? (
                  nextSuggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => sendPrompt(suggestion)}
                      className="rounded-full px-3 py-2 text-sm transition"
                      style={{ border: "1px solid var(--border)", background: "var(--bg-soft-strong)", color: "var(--text-main)" }}
                    >
                      {suggestion}
                    </button>
                  ))
                ) : (
                  <span className="text-sm" style={{ color: "var(--text-soft)" }}>Dawn will suggest follow-up actions after the first response.</span>
                )}
              </div>
            </section>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 backdrop-blur-xl" style={{ borderTop: "1px solid var(--border)", background: "color-mix(in srgb, var(--bg-surface-strong) 96%, transparent)" }}>
          <div className="mx-auto max-w-xl space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm" style={{ color: "var(--text-main)" }}>Ask Dawn anything...</p>
                {!bootstrapped && role ? <p className="mt-1 text-xs" style={{ color: "var(--text-soft)" }}>Loading proactive insights...</p> : null}
                {insightMessage ? <p className="mt-1 text-xs" style={{ color: "var(--accent-teal)" }}>{insightMessage}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-3 py-2 text-sm"
                style={{ border: "1px solid var(--border)", color: "var(--text-main)" }}
              >
                Close
              </button>
            </div>

            <div className="rounded-[28px] p-3" style={{ background: "var(--bg-soft)", border: "1px solid var(--border)" }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={3}
                placeholder={
                  role
                    ? "Ask Dawn anything..."
                    : "Sign in as Student, Landlord, or Admin to use Dawn"
                }
                className="w-full resize-none rounded-2xl bg-transparent px-3 py-3 text-base outline-none placeholder:text-slate-500"
                style={{ color: "var(--text-main)" }}
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  {capabilitiesChecked && (!speechSupported || !voiceSupported) ? (
                    <p className="text-xs" style={{ color: "var(--text-soft)" }}>
                      {!speechSupported ? "Mic input is unavailable in this browser. " : ""}
                      {!voiceSupported ? "Voice output is unavailable in this browser." : ""}
                    </p>
                  ) : (
                    <p className="text-xs" style={{ color: "var(--text-soft)" }}>
                      Calm, guided answers with contextual follow-ups.
                      {listening ? " Listening now." : ""}
                    </p>
                  )}
                  {voiceEnabled && voiceSupported ? <p className="text-xs" style={{ color: "var(--text-soft)" }}>AI voice: {activeVoiceLabel}</p> : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={!speechSupported}
                    className="rounded-full px-3 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ border: "1px solid var(--border)", color: "var(--text-main)", background: "var(--bg-soft-strong)" }}
                    aria-label={listening ? "Stop listening" : "Start listening"}
                  >
                    {listening ? "Stop" : "Mic"}
                  </button>
                  <button
                    type="submit"
                    disabled={!role || loading}
                    className="rounded-full bg-[linear-gradient(135deg,rgba(160,120,255,0.95),rgba(82,188,255,0.95),rgba(125,255,218,0.95))] px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
