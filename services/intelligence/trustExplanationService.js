function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function pickIncidentBreakdown(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.summary?.incidentBreakdown) return payload.summary.incidentBreakdown;
  if (payload.metrics?.incidentBreakdown) return payload.metrics.incidentBreakdown;
  return {};
}

function pickSeverityTrend(payload) {
  if (!payload || typeof payload !== "object") return {};
  if (payload.summary?.severityTrend) return payload.summary.severityTrend;
  if (payload.metrics?.severityTrend) return payload.metrics.severityTrend;
  return {};
}

async function explainTrust(unitId, options = {}) {
  const resolvedUnitId = Number(unitId);
  if (Number.isNaN(resolvedUnitId)) {
    const error = new Error("unitId must be a number");
    error.statusCode = 400;
    throw error;
  }

  const { callApi } = options;
  if (typeof callApi !== "function") {
    throw new Error("explainTrust requires callApi");
  }

  const [explainPayload, complaintPayload] = await Promise.all([
    callApi(`/unit/${resolvedUnitId}/explain`),
    callApi(`/unit/${resolvedUnitId}/complaints`),
  ]);

  const drivers = [];
  const incidentBreakdown = pickIncidentBreakdown(complaintPayload);
  const severityTrend = pickSeverityTrend(complaintPayload);
  const topIncident = Object.entries(incidentBreakdown).sort((a, b) => {
    if (b[1] !== a[1]) return Number(b[1]) - Number(a[1]);
    return String(a[0]).localeCompare(String(b[0]));
  })[0];

  if (topIncident && Number(topIncident[1]) > 0) {
    const count = Number(topIncident[1]);
    drivers.push(`${count} ${topIncident[0]} complaint${count === 1 ? "" : "s"} in last 30 days`);
  } else if (Number(explainPayload?.complaintsLast30Days || 0) > 0) {
    drivers.push(`${pluralize(Number(explainPayload.complaintsLast30Days), "complaint")} in last 30 days`);
  }

  if (Number(explainPayload?.slaBreaches30Days || complaintPayload?.summary?.slaBreaches30Days || complaintPayload?.metrics?.slaBreaches30Days || 0) > 0) {
    const slaBreaches = Number(
      explainPayload?.slaBreaches30Days ??
        complaintPayload?.summary?.slaBreaches30Days ??
        complaintPayload?.metrics?.slaBreaches30Days ??
        0
    );
    drivers.push(`${pluralize(slaBreaches, "SLA breach", "SLA breaches")} in last 30 days`);
  }

  if (Number(explainPayload?.activeComplaints || 0) > 0) {
    drivers.push(`${pluralize(Number(explainPayload.activeComplaints), "unresolved complaint")}`);
  }

  const highestSeverity = Object.keys(severityTrend)
    .map((key) => Number(key))
    .filter((value) => Number.isInteger(value) && Number(severityTrend[String(value)]) > 0)
    .sort((a, b) => b - a)[0];

  if (highestSeverity) {
    drivers.push(`Highest recent severity level ${highestSeverity}`);
  }

  return {
    unitId: resolvedUnitId,
    trustScore: Number(explainPayload?.trustScore ?? 0),
    trustBand: explainPayload?.trustBand || null,
    auditRequired: Boolean(explainPayload?.auditRequired ?? false),
    visibilityReasons: Array.isArray(explainPayload?.visibilityReasons) ? explainPayload.visibilityReasons : [],
    drivers,
  };
}

module.exports = {
  explainTrust,
};
