const API_BASE =
  process.env.API_BASE_URL ||
  process.env.INTERNAL_API_BASE_URL ||
  `http://127.0.0.1:${process.env.PORT || 5000}`;

const WATER_COMPLAINT_THRESHOLD = 3;
const SLA_BREACH_REVIEW_THRESHOLD = 2;
const HIGH_DENSITY_THRESHOLD = 3;

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.isHttpError = true;
  error.statusCode = statusCode;
  return error;
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

function ensureRole(req, allowedRoles) {
  if (!req?.user?.role || !allowedRoles.includes(req.user.role)) {
    throw createHttpError(403, "Forbidden for current role");
  }
}

async function callApi(path, token, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error || `Failed request: ${path}`;
    throw createHttpError(response.status, message);
  }

  return payload;
}

function parseMaxRent(text) {
  const kMatch = text.match(/(?:under|max|below|within)\s*[₹rs.\s]*?(\d+)\s*k\b/);
  if (kMatch) return Number(kMatch[1]) * 1000;

  const rawMatch = text.match(/(?:under|max|below|within)\s*[₹rs.\s]*?(\d{3,6})\b/);
  if (rawMatch) return Number(rawMatch[1]);

  if (/\b(cheap|budget|affordable|low rent)\b/.test(text)) return 8000;

  return null;
}

function parseMaxDistance(text) {
  const match = text.match(/(?:within|under|max|below|near)\s+(\d+(?:\.\d+)?)\s*km\b/);
  if (!match) return null;
  const value = Number(match[1]);
  if (Number.isNaN(value) || value < 0) return null;
  return value;
}

function parseAcFilter(text) {
  if (/\b(non\s*ac|without\s*ac|no\s*ac)\b/.test(text)) return false;
  if (/\bac\b/.test(text)) return true;
  return null;
}

function parseSeverity(text) {
  const match = text.match(/(?:severity|sev(?:erity)?)\s*(?:is\s*)?(\d)\b/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isInteger(value) || value < 1 || value > 5) return null;
  return value;
}

function parseDuration(text) {
  const source = String(text || "").toLowerCase();
  const hourMatch = source.match(/(\d+)\s*(hour|hours|hr|hrs)\b/);
  if (hourMatch) {
    const value = Number(hourMatch[1]);
    if (!Number.isNaN(value)) return `${value} hour${value === 1 ? "" : "s"}`;
  }

  const dayMatch = source.match(/(\d+)\s*(day|days)\b/);
  if (dayMatch) {
    const value = Number(dayMatch[1]);
    if (!Number.isNaN(value)) return `${value} day${value === 1 ? "" : "s"}`;
  }

  if (/\b(today|since today)\b/.test(source)) return "since today";
  if (/\b(yesterday|since yesterday)\b/.test(source)) return "since yesterday";
  if (/\bthis week\b/.test(source)) return "this week";
  if (/\bfor a while\b/.test(source)) return "for a while";
  return null;
}

function parseRequestedLandlordId(text) {
  const match = String(text || "").match(/\blandlord\s*#?\s*(\d+)\b/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isNaN(value) ? null : value;
}

function parseRequestedUnitId(text) {
  const match = String(text || "").match(/\b(?:unit|room)\s*#?\s*(\d+)\b/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isNaN(value) ? null : value;
}

function preprocessDawnText(text) {
  let normalized = String(text || "").trim().toLowerCase();
  if (!normalized) return normalized;

  const replacements = [
    [/\bcheap\b/g, "budget under 8000"],
    [/\baffordable\b/g, "budget under 8000"],
    [/\bsafe\b/g, "high trust low risk"],
    [/\bunsafe\b/g, "risky trust low"],
    [/\bbad area\b/g, "corridor risk"],
    [/\brisky area\b/g, "corridor risk"],
    [/\breport an issue\b/g, "draft complaint"],
    [/\bissue in my room\b/g, "complaint in my unit"],
    [/\bexplain this unit\b/g, "explain this unit trust risk health"],
    [/\bunits needing attention\b/g, "which units need attention"],
  ];

  for (const [pattern, replacement] of replacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function detectIncidentType(text) {
  if (/\b(lift|elevator|stair|corridor light|common area|hallway)\b/.test(text)) return "common_area";
  if (/\b(water|leak|leakage|plumbing|drain|bathroom)\b/.test(text)) return "water";
  if (/\bfire|smoke\b/.test(text)) return "fire";
  if (/\binjury|hurt|accident\b/.test(text)) return "injury";
  if (/\bharass|abuse|threat\b/.test(text)) return "harassment";
  if (/\b(electric|electrical|wiring|voltage|spark)\b/.test(text)) return "electrical";
  if (/\block|safety\b/.test(text)) return "safety";
  return "other";
}

function estimateSeverity(text, incidentType) {
  if (incidentType === "fire") return 5;
  if (incidentType === "injury") return 4;
  if (incidentType === "harassment") return 4;
  if (incidentType === "electrical") return 4;
  if (incidentType === "common_area") return 3;
  if (incidentType === "water" || incidentType === "safety") return 3;
  if (/\burgent|immediate|critical\b/.test(text)) return 4;
  return 2;
}

function inLastDays(dateValue, days) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date >= cutoff;
}

function buildSoftRecommendations({ waterCount, slaBreachCount, trendCurrent14d, trendPrevious14d }) {
  const suggestions = [];

  if (waterCount >= WATER_COMPLAINT_THRESHOLD) {
    suggestions.push("Recurring water issues detected. Inspect the plumbing infrastructure now.");
  }
  if (slaBreachCount >= SLA_BREACH_REVIEW_THRESHOLD) {
    suggestions.push("Response delays detected. Start faster resolution now to protect trust score.");
  }
  if (trendCurrent14d > trendPrevious14d) {
    suggestions.push("Complaint density is rising versus the previous 14 days. Review the highest-activity units first.");
  }

  return suggestions;
}

module.exports = {
  HIGH_DENSITY_THRESHOLD,
  buildSoftRecommendations,
  callApi,
  createHttpError,
  detectIncidentType,
  ensureRole,
  estimateSeverity,
  getBearerToken,
  inLastDays,
  parseAcFilter,
  parseDuration,
  parseMaxDistance,
  parseMaxRent,
  parseRequestedLandlordId,
  parseRequestedUnitId,
  parseSeverity,
  preprocessDawnText,
};
