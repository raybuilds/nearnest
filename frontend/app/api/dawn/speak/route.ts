import crypto from "node:crypto";

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || "").trim();
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const JWT_SECRET = (process.env.JWT_SECRET || "").trim();
const BACKEND_BASE = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "")
  .trim()
  .replace(/\/+$/, "");
const SPEECH_CACHE_TTL_MS = Number(process.env.SPEECH_CACHE_TTL_MS || 10 * 60 * 1000);
const SPEECH_MAX_TEXT_LENGTH = Number(process.env.SPEECH_MAX_TEXT_LENGTH || 800);

const speechCache = new Map<string, { buffer: Buffer; expiresAt: number; profile: string }>();

const VOICE_PROFILES: Record<string, { voice: string; instructions: string; label: string }> = {
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

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sanitizeSpeechText(text: string) {
  const normalized = String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    throw new Error("Speech text is required");
  }

  if (normalized.length <= SPEECH_MAX_TEXT_LENGTH) return normalized;

  const truncated = normalized.slice(0, SPEECH_MAX_TEXT_LENGTH);
  const lastBoundary = Math.max(truncated.lastIndexOf(". "), truncated.lastIndexOf("? "), truncated.lastIndexOf("! "));
  return (lastBoundary > 120 ? truncated.slice(0, lastBoundary + 1) : truncated).trim();
}

function resolveVoiceProfile(voiceProfile: string | undefined) {
  return VOICE_PROFILES[voiceProfile || ""] || VOICE_PROFILES.indian_en_female;
}

function cacheKeyFor(text: string, voiceProfile: string) {
  return `${voiceProfile}::${text}`;
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function verifyBearerToken(authorization: string) {
  const [, token] = authorization.split(" ");
  const [encodedHeader, encodedPayload, encodedSignature] = (token || "").split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Unauthorized");
  }

  const header = JSON.parse(decodeBase64Url(encodedHeader).toString("utf8"));
  const payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8"));

  if (header.alg !== "HS256") {
    throw new Error("Unauthorized");
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(signingInput).digest();
  const actual = decodeBase64Url(encodedSignature);

  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error("Unauthorized");
  }

  if (payload.exp && Date.now() >= Number(payload.exp) * 1000) {
    throw new Error("Unauthorized");
  }

  return payload;
}

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of speechCache.entries()) {
    if (entry.expiresAt <= now) {
      speechCache.delete(key);
    }
  }
}

async function verifyAuth(authorization: string) {
  if (JWT_SECRET) {
    verifyBearerToken(authorization);
    return;
  }

  if (!BACKEND_BASE) {
    throw new Error("Dawn speech auth is not configured for this deployment.");
  }

  const response = await fetch(`${BACKEND_BASE}/profile`, {
    method: "GET",
    headers: {
      Authorization: authorization,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(response.status === 401 ? "Unauthorized" : "Unable to verify Dawn speech session.");
  }
}

async function proxyBackendSpeech(authorization: string, text: string, voiceProfile: string) {
  if (!BACKEND_BASE) {
    throw new Error("Dedicated Dawn voice is unavailable right now.");
  }

  const response = await fetch(`${BACKEND_BASE}/dawn/speak`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voiceProfile,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(details || "Dedicated Dawn voice is unavailable right now.");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": response.headers.get("Content-Type") || "audio/mpeg",
      "Cache-Control": response.headers.get("Cache-Control") || "private, max-age=600",
      ...(response.headers.get("X-Dawn-Voice-Profile")
        ? { "X-Dawn-Voice-Profile": response.headers.get("X-Dawn-Voice-Profile") as string }
        : {}),
      "X-Dawn-Speech-Cache": response.headers.get("X-Dawn-Speech-Cache") || "PROXY",
    },
  });
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return jsonError(401, "Missing or invalid authorization token");
    }

    await verifyAuth(authorization);

    if (!OPENAI_API_KEY) {
      return jsonError(503, "OPENAI_API_KEY is not configured for Dawn speech.");
    }

    const body = await request.json().catch(() => null);
    const text = sanitizeSpeechText(body?.text || "");
    const voiceProfile = String(body?.voiceProfile || "indian_en_female");
    const resolvedVoiceProfile = resolveVoiceProfile(voiceProfile);

    if (!OPENAI_API_KEY) {
      return proxyBackendSpeech(authorization, text, voiceProfile);
    }

    pruneCache();
    const cacheKey = cacheKeyFor(text, voiceProfile);
    const cached = speechCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return new Response(new Uint8Array(cached.buffer), {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "private, max-age=600",
          "X-Dawn-Voice-Profile": cached.profile,
          "X-Dawn-Speech-Cache": "HIT",
        },
      });
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
        input: text,
        instructions: resolvedVoiceProfile.instructions,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      return proxyBackendSpeech(authorization, text, voiceProfile);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    speechCache.set(cacheKey, {
      buffer,
      expiresAt: Date.now() + SPEECH_CACHE_TTL_MS,
      profile: resolvedVoiceProfile.label,
    });

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=600",
        "X-Dawn-Voice-Profile": resolvedVoiceProfile.label,
        "X-Dawn-Speech-Cache": "MISS",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dawn speech failed";
    if (message === "Unauthorized") {
      return jsonError(401, message);
    }
    return jsonError(500, message);
  }
}
