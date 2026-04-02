const crypto = require("crypto");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const SPEECH_CACHE_TTL_MS = Number(process.env.SPEECH_CACHE_TTL_MS || 10 * 60 * 1000);
const SPEECH_MAX_TEXT_LENGTH = Number(process.env.SPEECH_MAX_TEXT_LENGTH || 800);

const speechCache = new Map();

const VOICE_PROFILES = {
  indian_en_female: {
    voice: "coral",
    instructions: "Speak in a professional, calm Indian English accent. Sound clear, composed, and trustworthy.",
    label: "Professional Indian English",
  },
  british_en_female: {
    voice: "coral",
    instructions: "Speak in a professional, calm British English accent. Sound clear, composed, and trustworthy.",
    label: "Professional British English",
  },
  us_en_female: {
    voice: "coral",
    instructions: "Speak in a professional, calm American English accent. Sound clear, composed, and trustworthy.",
    label: "Professional US English",
  },
};

function getSpeechCacheKey(text, voiceProfile) {
  return crypto.createHash("sha256").update(`${voiceProfile}::${text}`).digest("hex");
}

function pruneSpeechCache() {
  const now = Date.now();
  for (const [key, entry] of speechCache.entries()) {
    if (entry.expiresAt <= now) {
      speechCache.delete(key);
    }
  }
}

function sanitizeSpeechText(text) {
  const normalized = String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    const error = new Error("Speech text is required");
    error.statusCode = 400;
    throw error;
  }

  if (normalized.length <= SPEECH_MAX_TEXT_LENGTH) {
    return normalized;
  }

  const truncated = normalized.slice(0, SPEECH_MAX_TEXT_LENGTH);
  const lastSentenceBoundary = Math.max(
    truncated.lastIndexOf(". "),
    truncated.lastIndexOf("? "),
    truncated.lastIndexOf("! ")
  );

  return (lastSentenceBoundary > 120 ? truncated.slice(0, lastSentenceBoundary + 1) : truncated).trim();
}

function resolveVoiceProfile(voiceProfile) {
  return VOICE_PROFILES[voiceProfile] || VOICE_PROFILES.indian_en_female;
}

async function generateSpeech(text, voiceProfile = "indian_en_female") {
  if (!OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is not configured for Dawn speech.");
    error.statusCode = 503;
    throw error;
  }

  pruneSpeechCache();

  const sanitizedText = sanitizeSpeechText(text);
  const resolvedVoiceProfile = resolveVoiceProfile(voiceProfile);
  const cacheKey = getSpeechCacheKey(sanitizedText, voiceProfile);
  const cached = speechCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return {
      audioBuffer: cached.audioBuffer,
      contentType: cached.contentType,
      cacheHit: true,
      normalizedText: sanitizedText,
      profile: resolvedVoiceProfile.label,
    };
  }

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: resolvedVoiceProfile.voice,
      input: sanitizedText,
      instructions: resolvedVoiceProfile.instructions,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.text().catch(() => "");
    const error = new Error(errorPayload || "Speech provider request failed");
    error.statusCode = response.status || 502;
    throw error;
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "audio/mpeg";

  speechCache.set(cacheKey, {
    audioBuffer,
    contentType,
    expiresAt: Date.now() + SPEECH_CACHE_TTL_MS,
  });

  return {
    audioBuffer,
    contentType,
    cacheHit: false,
    normalizedText: sanitizedText,
    profile: resolvedVoiceProfile.label,
  };
}

module.exports = {
  generateSpeech,
  sanitizeSpeechText,
};
