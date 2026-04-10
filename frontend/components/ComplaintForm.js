"use client";

import { useEffect, useMemo, useState } from "react";
import { createComplaint, getProfile, getUnits, queryDawn, resolveComplaint } from "@/lib/api";
import { getStoredRole } from "@/lib/session";

const incidentTypes = ["safety", "injury", "fire", "harassment", "water", "common_area", "electrical", "other"];

export default function ComplaintForm({ complaintId, initialUnitId = "" }) {
  const [role, setRole] = useState("");
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    unitId: initialUnitId ? String(initialUnitId) : "",
    occupantId: "",
    severity: "3",
    incidentType: "other",
    description: "",
    resolutionNotes: "",
  });

  useEffect(() => {
    setRole(getStoredRole());
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      if (complaintId) return;
      try {
        const profile = await getProfile();
        const corridorId = profile?.identity?.corridorId;
        if (!corridorId) return;
        const payload = await getUnits(corridorId);
        if (!active) return;
        const list = Array.isArray(payload) ? payload : [];
        setUnits(list);
        setForm((current) => ({
          ...current,
          unitId: current.unitId || (list[0] ? String(list[0].id) : ""),
        }));
      } catch {
        if (active) setUnits([]);
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, [complaintId]);

  const selectedUnit = useMemo(
    () => units.find((item) => String(item.id) === String(form.unitId)),
    [form.unitId, units]
  );

  function update(field, value) {
    setError("");
    setSuccess("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleDraft() {
    setDrafting(true);
    setError("");
    try {
      const payload = await queryDawn({
        message: `Draft a complaint for unit ${form.unitId || "unknown"} about ${form.incidentType}: ${form.description || "issue details pending"}`,
        intent: "complaint_draft",
      });
      update("description", payload?.assistant || form.description);
    } catch (requestError) {
      setError(requestError.message || "Dawn could not draft this complaint right now.");
    } finally {
      setDrafting(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (complaintId) {
        const payload = await resolveComplaint(complaintId);
        setSuccess(`Complaint resolved. Updated trust score: ${payload?.trustScore ?? "unknown"}.`);
        return;
      }

      const payload = await createComplaint({
        unitId: Number(form.unitId),
        severity: Number(form.severity),
        incidentType: form.incidentType,
        message: form.description,
        ...(form.occupantId ? { occupantId: form.occupantId.trim() } : {}),
      });

      setSuccess(`Complaint submitted. Updated trust score: ${payload?.trustScore ?? "unknown"}.`);
      setForm((current) => ({
        ...current,
        occupantId: "",
        description: "",
        severity: "3",
        incidentType: "other",
      }));
    } catch (requestError) {
      setError(requestError.message || "Unable to submit complaint.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="glass-panel blueprint-border p-6" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow">{complaintId ? "Resolution workflow" : "Report issues"}</div>
          <h3 className="mt-4 text-2xl font-semibold text-white" style={{ fontFamily: "var(--font-display)" }}>
            {complaintId ? "Resolve issue with governance trace" : "Report an issue"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {complaintId
              ? "Close the issue with a clear record of what was resolved."
              : "Share what happened so unsafe conditions can be reviewed and fixed faster."}
          </p>
        </div>
        {!complaintId ? (
          <button className="btn-secondary" onClick={handleDraft} type="button">
            {drafting ? "Drafting..." : "Draft with Dawn"}
          </button>
        ) : null}
      </div>

      {error ? <div className="status-banner error mt-5">{error}</div> : null}
      {success ? <div className="status-banner success mt-5">{success}</div> : null}

      {!complaintId ? (
        <>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Unit ID</span>
              <select className="input-shell" onChange={(event) => update("unitId", event.target.value)} value={form.unitId}>
                <option value="">Select a unit</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    Unit {unit.id}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Occupant ID</span>
              <input
                className="input-shell"
                onChange={(event) => update("occupantId", event.target.value)}
                placeholder="Optional verified occupant ID"
                value={form.occupantId}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Incident type</span>
              <select className="input-shell" onChange={(event) => update("incidentType", event.target.value)} value={form.incidentType}>
                {incidentTypes.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Severity</span>
              <select className="input-shell" onChange={(event) => update("severity", event.target.value)} value={form.severity}>
                {["1", "2", "3", "4", "5"].map((value) => (
                  <option key={value} value={value}>
                    Severity {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 grid gap-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Description</span>
            <textarea
              className="textarea-shell"
              onChange={(event) => update("description", event.target.value)}
              placeholder="Describe the issue clearly and what support is needed."
              value={form.description}
            />
          </label>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            Reporting issues helps improve safety for everyone in this area.
          </p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Expected resolution time</p>
              <strong className="mt-2 block text-lg text-white">24-48 hrs</strong>
              <span className="mt-2 block text-sm leading-6 text-slate-400">Expected resolution window if the issue is handled on time.</span>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">May reduce trust score</p>
              <strong className="mt-2 block text-lg text-white">Visible to governance</strong>
              <span className="mt-2 block text-sm leading-6 text-slate-400">This may reduce trust score or trigger audit pressure depending on severity and SLA outcome.</span>
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Unit details</p>
              <strong className="mt-2 block text-lg text-white">{selectedUnit ? `Unit ${selectedUnit.id}` : "Select a unit"}</strong>
              <span className="mt-2 block text-sm leading-6 text-slate-400">
                {selectedUnit ? `${Number(selectedUnit.distanceKm || 0).toFixed(1)} km away • trust ${selectedUnit.trustScore || 0}` : "Unit context will appear here."}
              </span>
            </div>
          </div>
        </>
      ) : (
        <label className="mt-6 grid gap-2">
          <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Resolution notes</span>
          <textarea
            className="textarea-shell"
            onChange={(event) => update("resolutionNotes", event.target.value)}
            placeholder="Add evidence notes or explain why the SLA outcome should improve trust."
            value={form.resolutionNotes}
          />
        </label>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm leading-6 text-slate-400">
          {complaintId
            ? "Resolving closes the complaint and recalculates trust for the affected unit."
            : `Submitting as ${role || "current user"} records a governance event, not just a support ticket.`}
        </div>
        <button className="btn-primary" disabled={loading || (!complaintId && !form.unitId)} type="submit">
          {loading ? (complaintId ? "Resolving..." : "Submitting...") : complaintId ? "Resolve issue" : "Submit report"}
        </button>
      </div>
    </form>
  );
}
