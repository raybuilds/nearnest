const API_BASE = process.env.API_BASE_URL || "http://localhost:5000";

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
  const kMatch = text.match(/(?:under|max|below)\s+(\d+)\s*k\b/);
  if (kMatch) return Number(kMatch[1]) * 1000;

  const rawMatch = text.match(/(?:under|max|below)\s+(\d{3,6})\b/);
  if (rawMatch) return Number(rawMatch[1]);

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
  const match = text.match(/severity\s*(\d)\b/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isInteger(value) || value < 1 || value > 5) return null;
  return value;
}

function parseRequestedLandlordId(text) {
  const match = String(text || "").match(/\blandlord\s*#?\s*(\d+)\b/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isNaN(value) ? null : value;
}

function detectIncidentType(text) {
  if (/\b(lift|elevator|stair|corridor light|common area|hallway)\b/.test(text)) return "common_area";
  if (/\b(water|leak|leakage|plumbing|drain|bathroom)\b/.test(text)) return "water";
  if (/\bfire|smoke\b/.test(text)) return "fire";
  if (/\binjury|hurt|accident\b/.test(text)) return "injury";
  if (/\bharass|abuse|threat\b/.test(text)) return "harassment";
  if (/\block|wiring|electric|safety\b/.test(text)) return "safety";
  return "other";
}

function estimateSeverity(text, incidentType) {
  if (incidentType === "fire") return 5;
  if (incidentType === "injury") return 4;
  if (incidentType === "harassment") return 4;
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
    suggestions.push("Water-related complaints are elevated. Consider reviewing plumbing in affected units.");
  }
  if (slaBreachCount >= SLA_BREACH_REVIEW_THRESHOLD) {
    suggestions.push("Repeated SLA breaches detected. Consider reviewing complaint response process.");
  }
  if (trendCurrent14d > trendPrevious14d) {
    suggestions.push("Complaint density is rising versus the previous 14 days. Consider monitoring high-activity units.");
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
  parseMaxDistance,
  parseMaxRent,
  parseRequestedLandlordId,
  parseSeverity,
};
