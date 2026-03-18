const prisma = require("../../prismaClient");
const { getUnitHealthReport } = require("./dawnUnitHealthService");
const { getCorridorInsights } = require("./dawnCorridorInsightService");
const { forecastUnitRisk } = require("./dawnRiskForecastService");
const { explainTrust } = require("./trustExplanationService");

function createError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function uniqueNumbers(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => Number(value))
        .filter((value) => !Number.isNaN(value))
    )
  );
}

function dedupeStrings(values) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function getRiskBadge(level) {
  if (level === "CRITICAL" || level === "HIGH") return "HIGH";
  if (level === "EARLY_WARNING" || level === "MEDIUM" || level === "watch") return "MEDIUM";
  return "LOW";
}

function rankUnitsForReview(units) {
  return [...(Array.isArray(units) ? units : [])].sort((a, b) => {
    if (Number(b.complaintsLast30Days || 0) !== Number(a.complaintsLast30Days || 0)) {
      return Number(b.complaintsLast30Days || 0) - Number(a.complaintsLast30Days || 0);
    }
    if (Number(b.slaLateCount || 0) !== Number(a.slaLateCount || 0)) {
      return Number(b.slaLateCount || 0) - Number(a.slaLateCount || 0);
    }
    if (Number(a.trustScore || 0) !== Number(b.trustScore || 0)) {
      return Number(a.trustScore || 0) - Number(b.trustScore || 0);
    }
    return Number(a.id || 0) - Number(b.id || 0);
  });
}

async function getRoleIdentity(userId) {
  return prisma.user.findUnique({
    where: { id: Number(userId) },
    include: {
      student: {
        select: { id: true, corridorId: true },
      },
      landlord: {
        select: { id: true },
      },
    },
  });
}

async function buildStudentInsights(userId, callApi) {
  const profile = await callApi("/profile");
  const unitId = profile?.occupancy?.currentUnit?.unitId || profile?.currentAccommodation?.identity?.unitId || null;
  const occupantId =
    profile?.occupancy?.currentUnit?.occupantId ||
    profile?.identity?.currentOccupantId ||
    profile?.identity?.occupantId ||
    null;
  const corridorId =
    profile?.occupancy?.currentUnit?.corridor?.id ||
    profile?.identity?.corridor?.id ||
    profile?.currentAccommodation?.identity?.corridor?.id ||
    null;

  if (!unitId) {
    return [];
  }

  const [healthReport, riskForecast, trustReport] = await Promise.all([
    getUnitHealthReport({
      userId,
      unitId,
      occupantId,
      corridorId,
      callApi,
    }),
    forecastUnitRisk(unitId),
    explainTrust(unitId, { callApi }).catch(() => ({ trustScore: 0, drivers: [] })),
  ]);

  const alerts = [];
  alerts.push({
    type: "operational_alert",
    title: "Housing health summary",
    message: healthReport.summary,
    riskLevel: getRiskBadge(healthReport.trustBand),
    affectedUnits: [unitId],
    units: [
      {
        unitId,
        trustScore: healthReport.trustScore,
        indicators: dedupeStrings([...healthReport.riskSignals, ...(trustReport.drivers || []).slice(0, 2)]),
        recommendation:
          healthReport.trend === "declining"
            ? "Resolve pending complaints quickly to stabilize trust."
            : "Maintain current complaint response performance.",
      },
    ],
  });

  if (riskForecast.riskLevel !== "STABLE" || riskForecast.indicators.length > 0) {
    alerts.push({
      type: "operational_alert",
      title: "Risk warnings",
      message: `Unit ${unitId} is currently in ${String(riskForecast.riskLevel).toLowerCase()} risk status.`,
      riskLevel: getRiskBadge(riskForecast.riskLevel),
      affectedUnits: [unitId],
      units: [
        {
          unitId,
          trustScore: healthReport.trustScore,
          indicators: riskForecast.indicators,
          recommendation: riskForecast.recommendation,
        },
      ],
    });
  }

  if (healthReport.trend === "declining" || Number(riskForecast.metrics?.complaintTrend || 0) > 0) {
    alerts.push({
      type: "operational_alert",
      title: "Complaint trend alerts",
      message: "Recent complaint activity is rising versus the earlier review window.",
      riskLevel: getRiskBadge(riskForecast.riskLevel),
      affectedUnits: [unitId],
      units: [
        {
          unitId,
          trustScore: healthReport.trustScore,
          indicators: dedupeStrings([
            Number(riskForecast.metrics?.complaintTrend || 0) > 0 ? "Complaint frequency rising" : "",
            Number(riskForecast.metrics?.slaBreaches || 0) >= 2 ? "Multiple SLA breaches" : "",
            ...(trustReport.drivers || []).slice(0, 1),
          ]),
          recommendation: "Monitor new complaints daily and shorten resolution turnaround.",
        },
      ],
    });
  }

  return alerts;
}

async function buildLandlordInsights(callApi) {
  const units = await callApi("/landlord/units");
  const rankedUnits = rankUnitsForReview(units).slice(0, 8);
  const complaintPayload = await callApi("/complaints");
  const complaints = Array.isArray(complaintPayload?.complaints) ? complaintPayload.complaints : [];

  const reviewedUnits = (
    await Promise.all(
      rankedUnits.map(async (unit) => {
        const forecast = await forecastUnitRisk(unit.id).catch(() => null);
        if (!forecast) return null;
        const trust = await explainTrust(unit.id, { callApi }).catch(() => ({ trustScore: Number(unit.trustScore || 0), drivers: [] }));
        return {
          unitId: unit.id,
          trustScore: Number(unit.trustScore ?? trust.trustScore ?? 0),
          slaLateCount: Number(unit.slaLateCount || 0),
          slaBreaches: Number(forecast.metrics?.slaBreaches || 0),
          complaintsLast30Days: Number(unit.complaintsLast30Days || 0),
          indicators: dedupeStrings([...forecast.indicators, ...(trust.drivers || []).slice(0, 2)]),
          recommendation:
            forecast.recommendation ||
            (Number(unit.slaLateCount || 0) >= 2
              ? "Improve response time to prevent suspension."
              : "Inspect recurring incident drivers in this unit."),
          riskLevel: forecast.riskLevel,
          riskScore: forecast.riskScore,
        };
      })
    )
  ).filter(Boolean);

  const atRiskUnits = reviewedUnits
    .filter((unit) => unit.riskLevel !== "STABLE" || unit.slaBreaches >= 2 || unit.complaintsLast30Days >= 3)
    .sort((a, b) => {
      if (Number(b.riskScore || 0) !== Number(a.riskScore || 0)) {
        return Number(b.riskScore || 0) - Number(a.riskScore || 0);
      }
      return Number(a.trustScore || 0) - Number(b.trustScore || 0);
    })
    .slice(0, 5);

  const alerts = [];
  if (atRiskUnits.length > 0) {
    alerts.push({
      type: "operational_alert",
      title: "Units requiring attention",
      message: `${atRiskUnits.length} unit(s) need operational review based on risk, trust, and complaint signals.`,
      riskLevel: atRiskUnits.some((unit) => unit.riskLevel === "CRITICAL") ? "HIGH" : "MEDIUM",
      affectedUnits: atRiskUnits.map((unit) => unit.unitId),
      units: atRiskUnits.map((unit) => ({
        unitId: unit.unitId,
        trustScore: unit.trustScore,
        indicators: unit.indicators,
        recommendation: unit.recommendation,
      })),
    });
  }

  const slaUnits = reviewedUnits.filter((unit) => unit.slaBreaches >= 2 || unit.slaLateCount >= 2).slice(0, 5);
  if (slaUnits.length > 0) {
    alerts.push({
      type: "operational_alert",
      title: "SLA performance issues",
      message: "Multiple units are missing expected complaint response timelines.",
      riskLevel: slaUnits.length >= 3 ? "HIGH" : "MEDIUM",
      affectedUnits: slaUnits.map((unit) => unit.unitId),
      units: slaUnits.map((unit) => ({
        unitId: unit.unitId,
        trustScore: unit.trustScore,
        indicators: dedupeStrings([
          unit.slaBreaches >= 2 || unit.slaLateCount >= 2 ? "Multiple SLA breaches" : "",
          ...unit.indicators,
        ]),
        recommendation: "Improve response time to prevent suspension.",
      })),
    });
  }

  const recurringPatterns = Array.from(
    complaints.reduce((map, complaint) => {
      const key = String(complaint?.incidentType || "other");
      const current = map.get(key) || { incidentType: key, count: 0, unitIds: [] };
      current.count += 1;
      current.unitIds.push(complaint?.unitId);
      map.set(key, current);
      return map;
    }, new Map()).values()
  )
    .filter((item) => item.count >= 2)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.incidentType).localeCompare(String(b.incidentType));
    })
    .slice(0, 3);

  if (recurringPatterns.length > 0) {
    alerts.push({
      type: "operational_alert",
      title: "Recurring incident patterns",
      message: "The same complaint types are repeating across your managed units.",
      riskLevel: recurringPatterns[0].count >= 4 ? "HIGH" : "MEDIUM",
      affectedUnits: uniqueNumbers(recurringPatterns.flatMap((item) => item.unitIds)),
      units: recurringPatterns.map((pattern) => ({
        incidentType: pattern.incidentType,
        complaintCount: pattern.count,
        affectedUnits: uniqueNumbers(pattern.unitIds),
        recommendation: `Inspect root causes behind recurring ${pattern.incidentType} complaints.`,
      })),
    });
  }

  return alerts;
}

async function buildAdminInsights(callApi) {
  const corridors = await callApi("/corridors").catch(() => []);
  const corridorReports = (
    await Promise.all(
      (Array.isArray(corridors) ? corridors : []).map(async (corridor) => {
        const report = await getCorridorInsights(corridor.id, { callApi }).catch(() => null);
        return report ? { corridor, report } : null;
      })
    )
  ).filter(Boolean);

  const alerts = [];

  const densityCorridors = corridorReports
    .filter(({ report }) => {
      const current14d = Number(report.trend14d?.current14d || 0);
      const previous14d = Number(report.trend14d?.previous14d || 0);
      return current14d > previous14d || Number(report.complaintDensity || 0) >= 2;
    })
    .sort((a, b) => Number(b.report.complaintDensity || 0) - Number(a.report.complaintDensity || 0))
    .slice(0, 4);

  if (densityCorridors.length > 0) {
    alerts.push({
      type: "operational_alert",
      title: "Corridors with high complaint density",
      message: "Complaint activity is increasing in one or more corridors.",
      riskLevel: densityCorridors.some(({ report }) => report.riskLevel === "HIGH") ? "HIGH" : "MEDIUM",
      affectedUnits: uniqueNumbers(
        densityCorridors.flatMap(({ report }) => (report.trustScores || []).map((item) => item.unitId))
      ),
      corridors: densityCorridors.map(({ corridor, report }) => ({
        corridorId: corridor.id,
        corridorName: corridor.name,
        complaintDensity: Number(report.complaintDensity || 0),
        indicators: [
          `Complaint density ${Number(report.complaintDensity || 0)}`,
          `${Number(report.unitsNearSuspension || 0)} units near suspension`,
        ],
        recommendation: "Review corridor operations and prioritize high-complaint units.",
      })),
    });
  }

  const safetyCorridors = corridorReports
    .map(({ corridor, report }) => ({
      corridor,
      report,
      safetyClusterCount:
        Number(report.incidentFrequency?.fire || 0) +
        Number(report.incidentFrequency?.safety || 0) +
        Number(report.incidentFrequency?.electrical || 0) +
        Number(report.severeIncidents || 0),
    }))
    .filter((item) => item.safetyClusterCount >= 2)
    .sort((a, b) => b.safetyClusterCount - a.safetyClusterCount)
    .slice(0, 4);

  if (safetyCorridors.length > 0) {
    alerts.push({
      type: "operational_alert",
      title: "Clusters of safety incidents",
      message: "Safety-related complaints are clustering and need administrative review.",
      riskLevel: safetyCorridors[0].safetyClusterCount >= 4 ? "HIGH" : "MEDIUM",
      affectedUnits: uniqueNumbers(
        safetyCorridors.flatMap(({ report }) => (report.trustScores || []).map((item) => item.unitId))
      ),
      corridors: safetyCorridors.map(({ corridor, report, safetyClusterCount }) => ({
        corridorId: corridor.id,
        corridorName: corridor.name,
        safetyClusterCount,
        indicators: [
          `${Number(report.incidentFrequency?.fire || 0)} fire complaints`,
          `${Number(report.incidentFrequency?.electrical || 0)} electrical complaints`,
          `${Number(report.incidentFrequency?.safety || 0)} safety complaints`,
        ].filter((item) => !item.startsWith("0 ")),
        recommendation: "Dispatch safety inspection and review severe incident history.",
      })),
    });
  }

  const suspensionCorridors = corridorReports
    .filter(({ report }) => Number(report.unitsNearSuspension || 0) >= 1)
    .sort((a, b) => Number(b.report.unitsNearSuspension || 0) - Number(a.report.unitsNearSuspension || 0))
    .slice(0, 4);

  if (suspensionCorridors.length > 0) {
    alerts.push({
      type: "operational_alert",
      title: "Units approaching suspension thresholds",
      message: "Several units are nearing enforcement thresholds and should be reviewed.",
      riskLevel: suspensionCorridors.some(({ report }) => Number(report.unitsNearSuspension || 0) >= 2) ? "HIGH" : "MEDIUM",
      affectedUnits: uniqueNumbers(
        suspensionCorridors.flatMap(({ report }) =>
          (report.trustScores || [])
            .filter((item) => Number(item.trustScore) < 60)
            .map((item) => item.unitId)
        )
      ),
      corridors: suspensionCorridors.map(({ corridor, report }) => ({
        corridorId: corridor.id,
        corridorName: corridor.name,
        unitsNearSuspension: Number(report.unitsNearSuspension || 0),
        indicators: [`${Number(report.unitsNearSuspension || 0)} units near suspension threshold`],
        recommendation: "Audit exposed units before thresholds convert into enforcement action.",
      })),
    });
  }

  return alerts;
}

async function generateOperationalInsights(role, userId, options = {}) {
  const resolvedRole = String(role || "").toLowerCase();
  const resolvedUserId = Number(userId);
  const { callApi } = options;

  if (!["student", "landlord", "admin"].includes(resolvedRole)) {
    throw createError(400, "Unsupported role for operations advisor");
  }
  if (Number.isNaN(resolvedUserId)) {
    throw createError(400, "userId must be a number");
  }
  if (typeof callApi !== "function") {
    throw createError(500, "Operations advisor requires callApi access");
  }

  const identity = await getRoleIdentity(resolvedUserId);
  if (!identity) {
    throw createError(404, "User not found");
  }

  if (resolvedRole === "student") {
    return buildStudentInsights(resolvedUserId, callApi);
  }
  if (resolvedRole === "landlord") {
    return buildLandlordInsights(callApi);
  }
  return buildAdminInsights(callApi);
}

module.exports = {
  generateOperationalInsights,
};
