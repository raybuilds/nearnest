"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CardRenderer from "@/components/dawn/CardRenderer";
import DawnAvatar from "@/components/dawn/DawnAvatar";
import DawnHeader from "@/components/dawn/DawnHeader";
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

  const intentSummary = useMemo(() => {
    if (loading) return "Analyzing system data...";
    if (response?.intents?.length) return response.intents.join(", ");
    return "Guided assistant ready";
  }, [loading, response]);

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
      className={`fixed bottom-24 right-4 z-50 w-[min(92vw,30rem)] transition duration-300 sm:right-6 ${
        open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0"
      }`}
    >
      <div className="overflow-hidden rounded-[32px] border border-white/12 bg-[linear-gradient(180deg,rgba(15,18,34,0.94),rgba(10,12,24,0.98))] shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
        <DawnHeader
          roleLabel={roleLabel}
          rightSlot={
            voiceEnabled ? (
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-100">
                Voice on
              </span>
            ) : null
          }
        />

        <div className="border-b border-white/8 px-5 py-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Intent queue</p>
          <p className="mt-2 text-sm text-slate-200">{intentSummary}</p>
          {!bootstrapped && role ? <p className="mt-2 text-xs text-slate-400">Loading proactive insights...</p> : null}
          {insightMessage ? <p className="mt-2 text-xs text-emerald-200">{insightMessage}</p> : null}
        </div>

        {summary ? (
          <div className="border-b border-white/8 px-5 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{summaryTitle(role, summary)}</p>
              {trustBand ? <span className={`signal-chip ${trustBand.tone}`}>{trustBand.label}</span> : null}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Trust</p>
                <p className="mt-2 text-lg font-semibold text-white">{summary.trustScore ?? "--"}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Risk</p>
                <div className="mt-2">
                  <span className={`signal-chip ${getRiskTone(summary.riskLevel || "info")}`}>{summary.riskLevel || "--"}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/5 px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Complaints</p>
                <p className="mt-2 text-lg font-semibold text-white">{summary.complaintCount ?? "--"}</p>
              </div>
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="border-b border-white/8 px-5 py-4">
          <label className="block text-[11px] uppercase tracking-[0.22em] text-slate-400">Starter prompts</label>
          <div className="mt-3 flex flex-wrap gap-2">
            {starterPrompts.length > 0 ? (
              starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendPrompt(prompt)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/10"
                >
                  {prompt}
                </button>
              ))
            ) : (
              <span className="text-xs text-slate-500">Sign in to unlock guided prompts.</span>
            )}
          </div>

          <label className="mt-4 block text-[11px] uppercase tracking-[0.22em] text-slate-400">Query intelligence</label>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={3}
            placeholder={
              role
                ? "Ask Dawn to explain trust, forecast risk, guide a complaint, or recommend your next step"
                : "Sign in as Student, Landlord, or Admin to use Dawn"
            }
            className="mt-3 w-full rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <div className="mt-4">
            <DawnAvatar state={avatarState} enabled={avatarEnabled} compact />
          </div>
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
          {capabilitiesChecked && (!speechSupported || !voiceSupported) ? (
            <p className="mt-3 text-xs text-slate-500">
              {!speechSupported ? "Mic input is unavailable in this browser. " : ""}
              {!voiceSupported ? "Voice output is unavailable in this browser." : ""}
            </p>
          ) : null}
          {voiceSupported ? (
            <p className="mt-2 text-xs text-slate-500">AI voice: {activeVoiceLabel}</p>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400">
              Dawn now guides the next step instead of waiting for perfect phrasing.
              {listening ? " Voice input is active." : ""}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 px-3 py-2 text-sm text-slate-200"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={!role || loading}
                className="rounded-full bg-[linear-gradient(135deg,rgba(160,120,255,0.95),rgba(82,188,255,0.95),rgba(125,255,218,0.95))] px-4 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Thinking..." : "Analyze"}
              </button>
            </div>
          </div>
        </form>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {notice ? (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              {notice}
            </div>
          ) : null}

          {response ? (
            <>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
                <p className="font-[family:var(--font-display)] text-xl text-white">Dawn says</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{response.message}</p>
              </div>
              <CardRenderer cards={response.cards} loading={loading} onAction={handleAction} />
            </>
          ) : !loading ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-4">
              <p className="font-[family:var(--font-display)] text-xl text-white">Guided intelligence</p>
              <p className="mt-2 text-sm text-slate-300">
                Dawn understands your role, current context, and recent signals. Start with a prompt chip if you are not sure what to ask.
              </p>
            </div>
          ) : null}

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Suggested next steps</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {nextSuggestions.length > 0 ? (
                nextSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => sendPrompt(suggestion)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-emerald-300/40 hover:bg-emerald-300/10"
                  >
                    {suggestion}
                  </button>
                ))
              ) : (
                <span className="text-sm text-slate-500">Dawn will suggest follow-up actions after the first response.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
