const { getUnitHealthReport } = require("../intelligence/dawnUnitHealthService");
const { forecastUnitRisk } = require("../intelligence/dawnRiskForecastService");
const { ensureRole } = require("./utils");

module.exports = async function studentUnitHealth({ req, context }) {
  ensureRole(req, ["student"]);

  const profile = await context.callApi("/profile");
  const unitId = profile?.occupancy?.currentUnit?.unitId || profile?.currentAccommodation?.identity?.unitId || null;
  const occupantId =
    profile?.occupancy?.currentUnit?.occupantId || profile?.identity?.currentOccupantId || profile?.identity?.occupantId || null;
  const corridorId =
    profile?.occupancy?.currentUnit?.corridor?.id || profile?.identity?.corridor?.id || profile?.currentAccommodation?.identity?.corridor?.id || null;

  if (!unitId) {
    return {
      assistant: "I could not find an active housing unit linked to your profile.",
    };
  }

  const report = await getUnitHealthReport({
    userId: req.user.id,
    unitId,
    occupantId,
    corridorId,
    callApi: context.callApi,
  });
  const riskForecast = await forecastUnitRisk(unitId);

  context.updateMemory({
    lastIntent: context.intent || "student_unit_health",
    lastUnitId: unitId,
  });

  const healthReport = {
    trustScore: report.trustScore,
    trustBand: report.trustBand,
    complaintTrend: report.trend,
    responsePerformance: report.slaBreaches30Days >= 2 ? "delayed" : "within acceptable limits",
    riskSignals: report.riskSignals,
    summary: report.summary,
  };

  if (context.intent === "predict_unit_risk") {
    return {
      message: "Here is the current risk forecast for your housing:",
      assistant: `Unit #${unitId} risk forecast prepared.`,
      riskForecast: {
        riskSignal: riskForecast.riskLevel,
        indicators: riskForecast.indicators,
        recommendation: riskForecast.recommendation,
        riskScore: riskForecast.riskScore,
      },
      data: {
        ...riskForecast,
        riskForecast: {
          riskSignal: riskForecast.riskLevel,
          indicators: riskForecast.indicators,
          recommendation: riskForecast.recommendation,
          riskScore: riskForecast.riskScore,
        },
        healthReport,
      },
    };
  }

  return {
    message: "Here is the health report for your housing:",
    assistant: `Unit #${unitId} health report prepared.`,
    healthReport,
    data: {
      ...report,
      riskForecast,
      healthReport,
    },
  };
};
