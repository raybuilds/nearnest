export function getRoleClass(role) {
  if (role === "student") return "role-badge role-student";
  if (role === "landlord") return "role-badge role-landlord";
  if (role === "admin") return "role-badge role-admin";
  return "role-badge";
}

export function getTrustBand(score) {
  const value = Number(score || 0);
  if (value >= 75) {
    return {
      key: "A",
      label: "Band A",
      tone: "signal-success",
      fillClass: "band-a",
      narrative: "Visibility favored by strong trust performance.",
    };
  }

  if (value >= 45) {
    return {
      key: "B",
      label: "Band B",
      tone: "signal-warning",
      fillClass: "band-b",
      narrative: "Visible, but governance signals need attention.",
    };
  }

  return {
    key: "C",
    label: "Band C",
    tone: "signal-danger",
    fillClass: "band-c",
    narrative: "Below trust threshold or at high governance risk.",
  };
}

export function getRiskTone(riskLevel) {
  const normalized = String(riskLevel || "").toLowerCase();
  if (normalized === "stable" || normalized === "low") return "signal-success";
  if (normalized === "warning" || normalized === "medium") return "signal-warning";
  if (normalized === "critical" || normalized === "high") return "signal-danger";
  return "signal-info";
}

export function getStatusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (["approved", "live", "resolved"].includes(normalized)) return "signal-success";
  if (["submitted", "draft", "under sla", "open", "admin_review"].includes(normalized)) return "signal-warning";
  if (["suspended", "rejected", "breached"].includes(normalized)) return "signal-danger";
  return "signal-info";
}

export function inferVisibilityReasons(unit) {
  const reasons = [];
  if (!unit) return reasons;

  if (unit.visibleToStudents === false) {
    if (Number(unit.trustScore || 0) < 45) {
      reasons.push("Hidden because trust has dropped below the corridor visibility threshold.");
    }
    if (unit.auditRequired) {
      reasons.push("Hidden because the unit is under active audit review.");
    }
    if (unit.status && unit.status !== "approved") {
      reasons.push(`Hidden because governance status is ${unit.status}.`);
    }
  } else {
    if (Number(unit.trustScore || 0) >= 75) {
      reasons.push("Visible because trust remains high and governance checks are clear.");
    } else if (Number(unit.trustScore || 0) >= 45) {
      reasons.push("Visible because trust remains above the minimum threshold, though monitoring is ongoing.");
    }
  }

  if ((unit.activeComplaints || 0) > 0) {
    reasons.push(`${unit.activeComplaints} active complaint signal${unit.activeComplaints === 1 ? "" : "s"} currently influencing trust.`);
  }

  if ((unit.openAuditLogCount || 0) > 0) {
    reasons.push(`${unit.openAuditLogCount} open audit log${unit.openAuditLogCount === 1 ? "" : "s"} need resolution.`);
  }

  return reasons;
}

export function formatDateTime(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

export function formatShortDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString();
}

export function toPercent(value, digits = 0) {
  return `${Number(value || 0).toFixed(digits)}%`;
}
