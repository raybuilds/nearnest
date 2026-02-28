const express = require("express");
const prisma = require("../prismaClient");
const { verifyToken } = require("../middlewares/auth");

const router = express.Router();

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000";

function parseMaxRent(text) {
  const kMatch = text.match(/under\s+(\d+)\s*k/);
  if (kMatch) return Number(kMatch[1]) * 1000;
  const rawMatch = text.match(/under\s+(\d{3,6})/);
  if (rawMatch) return Number(rawMatch[1]);
  return null;
}

function parseSeverity(text) {
  const match = text.match(/severity\s*(\d)/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isInteger(value) || value < 1 || value > 5) return null;
  return value;
}

function parseUnitId(text) {
  const match = text.match(/unit\s*#?\s*(\d+)/);
  if (!match) return null;
  return Number(match[1]);
}

function detectIncidentType(text) {
  if (text.includes("fire")) return "fire";
  if (text.includes("injury")) return "injury";
  if (text.includes("harass")) return "harassment";
  if (text.includes("safety") || text.includes("leak") || text.includes("lock")) return "safety";
  return "other";
}

function inferIntent(role, message) {
  const text = String(message || "").toLowerCase().trim();

  if (role === "student") {
    if (text.includes("hidden")) return "student_explain_hidden";
    if (
      text.includes("complaint") ||
      text.includes("leak") ||
      text.includes("water") ||
      text.includes("issue") ||
      text.includes("severity")
    ) {
      return "student_submit_complaint";
    }
    if (text.includes("room") || text.includes("unit") || text.includes("ac") || text.includes("rent")) {
      return "student_search_units";
    }
  }

  if (role === "landlord") {
    if (text.includes("audit risk")) return "landlord_audit_risk";
    if (text.includes("sla breach")) return "landlord_sla_breach";
    if (text.includes("trust drop")) return "landlord_trust_drop";
  }

  if (role === "admin") {
    if (text.includes("highest complaint density")) return "admin_corridor_density";
    if (text.includes("nearing suspension")) return "admin_nearing_suspension";
    if (text.includes("why") && text.includes("suspended") && text.includes("unit")) return "admin_explain_suspension";
  }

  return "unsupported";
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
    throw new Error(message);
  }

  return payload;
}

router.post("/dawn/query", verifyToken, async (req, res) => {
  try {
    const { message, confirm, action } = req.body || {};
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const role = req.user.role;
    const intent = inferIntent(role, message);

    if (intent === "unsupported") {
      return res.json({
        assistant: "I couldn't map that query. Try asking about units, complaints, audit risk, or suspension reasons.",
        intent,
      });
    }

    if (role === "student" && intent === "student_search_units") {
      const student = await prisma.student.findFirst({
        where: { userId: req.user.id },
        select: { corridorId: true },
      });
      if (!student) {
        return res.status(403).json({ error: "Student profile not found" });
      }

      const text = message.toLowerCase();
      const ac = text.includes("ac") && !text.includes("non ac") ? "true" : undefined;
      const maxRent = parseMaxRent(text);
      const cheapest = text.includes("cheapest");

      const params = new URLSearchParams();
      if (ac) params.set("ac", ac);
      if (maxRent !== null) params.set("maxRent", String(maxRent));

      const units = await callApi(`/units/${student.corridorId}${params.toString() ? `?${params.toString()}` : ""}`, token);
      const sorted = Array.isArray(units)
        ? [...units].sort((a, b) => {
            if (cheapest) return a.rent - b.rent;
            return b.trustScore - a.trustScore;
          })
        : [];

      return res.json({
        intent,
        assistant: `Found ${sorted.length} matching units in your corridor.`,
        data: sorted.slice(0, 10),
      });
    }

    if (role === "student" && intent === "student_explain_hidden") {
      const student = await prisma.student.findFirst({
        where: { userId: req.user.id },
        select: { corridorId: true },
      });
      if (!student) {
        return res.status(403).json({ error: "Student profile not found" });
      }

      const payload = await callApi(`/units/${student.corridorId}/hidden-reasons`, token);
      return res.json({
        intent,
        assistant: `There are ${payload.hiddenCount || 0} hidden units. Here are the top reasons.`,
        data: payload,
      });
    }

    if (role === "student" && intent === "student_submit_complaint") {
      const student = await prisma.student.findFirst({
        where: { userId: req.user.id },
        select: { id: true },
      });
      if (!student) {
        return res.status(403).json({ error: "Student profile not found" });
      }

      const text = message.toLowerCase();
      const severity = parseSeverity(text) || 3;
      const incidentType = detectIncidentType(text);
      let unitId = parseUnitId(text);

      if (!unitId) {
        const active = await prisma.occupancy.findFirst({
          where: { studentId: student.id, endDate: null },
          select: { unitId: true },
        });
        unitId = active?.unitId || null;
      }

      if (!unitId) {
        return res.json({
          intent,
          assistant: "I need a unit id to file this complaint. Please say: 'complaint for unit 28, severity 4 ...'",
        });
      }

      const draft = {
        unitId,
        studentId: student.id,
        severity,
        incidentType,
        message: message.trim(),
      };

      if (!confirm) {
        return res.json({
          intent,
          requiresConfirmation: true,
          assistant: `I can submit this complaint for unit ${unitId} with severity ${severity}. Confirm?`,
          action: {
            intent,
            payload: draft,
          },
        });
      }

      const finalPayload = action?.payload || draft;
      const created = await callApi("/complaint", token, {
        method: "POST",
        body: finalPayload,
      });
      return res.json({
        intent,
        assistant: `Complaint submitted. Updated trust score: ${created.trustScore}`,
        data: created,
      });
    }

    if (role === "landlord" && intent === "landlord_audit_risk") {
      const units = await callApi("/landlord/units", token);
      const risky = (Array.isArray(units) ? units : []).filter(
        (unit) => unit.auditRequired || unit.trustScore < 60 || unit.slaLateCount > 0
      );
      return res.json({
        intent,
        assistant: `Found ${risky.length} units with elevated audit risk.`,
        data: risky,
      });
    }

    if (role === "landlord" && intent === "landlord_sla_breach") {
      const payload = await callApi("/complaints?status=late", token);
      return res.json({
        intent,
        assistant: `Found ${payload.total || 0} late-resolved complaints.`,
        data: payload,
      });
    }

    if (role === "landlord" && intent === "landlord_trust_drop") {
      const units = await callApi("/landlord/units", token);
      const dropped = (Array.isArray(units) ? units : [])
        .filter((unit) => unit.complaintsLast30Days > 0 || unit.slaLateCount > 0 || unit.trustScore < 75)
        .sort((a, b) => a.trustScore - b.trustScore);
      return res.json({
        intent,
        assistant: "Units likely impacted by recent complaints/SLA are listed.",
        data: dropped,
      });
    }

    if (role === "admin" && intent === "admin_corridor_density") {
      const payload = await callApi("/complaints", token);
      const complaints = payload?.complaints || [];
      const byCorridor = new Map();
      for (const item of complaints) {
        const key = item.corridorId || 0;
        byCorridor.set(key, (byCorridor.get(key) || 0) + 1);
      }
      const ranking = Array.from(byCorridor.entries())
        .map(([corridorId, count]) => ({ corridorId, complaintCount: count }))
        .sort((a, b) => b.complaintCount - a.complaintCount);

      return res.json({
        intent,
        assistant: ranking.length
          ? `Corridor ${ranking[0].corridorId} currently has the highest complaint density.`
          : "No complaint density data found.",
        data: ranking,
      });
    }

    if (role === "admin" && intent === "admin_nearing_suspension") {
      const payload = await callApi("/complaints", token);
      const highDensityUnits = payload?.metrics?.highDensityUnits || [];
      return res.json({
        intent,
        assistant: `Found ${highDensityUnits.length} units nearing suspension risk by complaint density.`,
        data: highDensityUnits,
      });
    }

    if (role === "admin" && intent === "admin_explain_suspension") {
      const unitId = parseUnitId(message.toLowerCase());
      if (!unitId) {
        return res.json({
          intent,
          assistant: "Please include a unit id, e.g. 'Why was unit 16 suspended?'",
        });
      }

      const [explain, details] = await Promise.all([
        callApi(`/unit/${unitId}/explain`, token),
        callApi(`/admin/unit/${unitId}/details`, token),
      ]);

      return res.json({
        intent,
        assistant: `Unit ${unitId} status analysis generated.`,
        data: {
          explain,
          latestAudit: details?.auditLayer?.allAuditLogs?.[0] || null,
        },
      });
    }

    return res.json({
      assistant: "Intent recognized but no execution path is available.",
      intent,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || "Dawn request failed" });
  }
});

module.exports = router;
