"use client";

import { useEffect, useMemo, useState } from "react";
import { createComplaint, getLandlordUnits, getProfile, getUnits, queryDawn, resolveComplaint } from "@/lib/api";
import styles from "./ComplaintForm.module.css";

const incidentTypes = ["", "safety", "injury", "fire", "harassment", "water", "common_area", "electrical", "other"];
const severityOptions = [1, 2, 3, 4, 5];

function severityTone(severity) {
  if (severity <= 2) return "ch-ok";
  if (severity === 3) return "ch-warn";
  return "ch-err";
}

export default function ComplaintForm({ complaintId }) {
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState({
    unitId: "",
    occupantId: "",
    severity: 3,
    incidentType: "",
    description: "",
    resolutionNotes: "",
  });
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [studentId, setStudentId] = useState("");
  const fallbackUnit = useMemo(() => ({ unitId: "", name: "this unit", address: "" }), []);

  const selectedUnit = useMemo(
    () => units.find((unit) => String(unit.unitId) === String(form.unitId)) || units[0] || fallbackUnit,
    [fallbackUnit, form.unitId, units]
  );

  useEffect(() => {
    let active = true;

    async function loadUnits() {
      try {
        const role = localStorage.getItem("role");
        setStudentId(localStorage.getItem("studentId") || "");
        let nextUnits = [];

        if (role === "student") {
          const profile = await getProfile();
          const corridorId = profile?.identity?.corridor?.id;
          if (corridorId) {
            const response = await getUnits(corridorId);
            nextUnits = Array.isArray(response)
              ? response.map((unit) => ({
                  unitId: String(unit.id),
                  name: `Unit ${unit.id}`,
                  address: `${Number(unit.distanceKm || 0).toFixed(1)} km away`,
                }))
              : [];
          }
        } else if (role === "landlord") {
          const response = await getLandlordUnits();
          nextUnits = Array.isArray(response)
            ? response.map((unit) => ({
                unitId: String(unit.id),
                name: `Unit ${unit.id}`,
                address: `${unit.status || "unknown"} status`,
              }))
            : [];
        }

        if (!active) return;
        setUnits(nextUnits);
        setForm((current) => ({
          ...current,
          unitId: current.unitId || nextUnits[0]?.unitId || "",
        }));
      } catch {
        if (active) {
          setUnits([]);
        }
      }
    }

    loadUnits();
    return () => {
      active = false;
    };
  }, []);

  function updateField(field, value) {
    setError("");
    setResult(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function requestDraft() {
    setLoadingDraft(true);
    setResult(null);
    setError("");
    try {
      const payload = await queryDawn({
        message: `Draft a complaint for: ${form.description || form.incidentType || "general issue"}`,
        intent: "complaint_draft",
      });
      updateField("description", payload?.assistant || form.description);
    } catch (draftError) {
      setError(draftError.message || "Draft request failed");
    } finally {
      setLoadingDraft(false);
    }
  }

  async function submitComplaint(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    try {
      if (complaintId) {
        const payload = await resolveComplaint(complaintId);
        setResult(payload);
        return;
      }

      if (!studentId) {
        throw new Error("Student identity is missing. Please sign in again.");
      }

      const parsedSeverity = Number(form.severity);
      if (!Number.isInteger(parsedSeverity) || parsedSeverity < 1 || parsedSeverity > 5) {
        throw new Error("Severity must be an integer from 1 to 5.");
      }

      const body = {
        unitId: Number(form.unitId),
        severity: parsedSeverity,
        message: form.description || null,
        ...(form.occupantId ? { occupantId: form.occupantId } : {}),
        ...(form.incidentType ? { incidentType: form.incidentType } : {}),
      };

      const payload = await createComplaint(body);
      setResult(payload);
    } catch (submitError) {
      setError(submitError.message || "Complaint submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={`${styles.form} panel`} onSubmit={submitComplaint}>
      <div className={styles.header}>
        <div>
          <p className="label-caps">Dawn Assisted Intake</p>
          <h3 className={styles.title}>{complaintId ? "Resolve complaint" : "Create a complaint"}</h3>
        </div>
        {!complaintId ? (
          <button className="btn-soft blue" onClick={requestDraft} type="button">
            {loadingDraft ? "Drafting..." : "Draft with Dawn"}
          </button>
        ) : null}
      </div>

      {error ? <div className="status-banner error">{error}</div> : null}
      {result && !complaintId ? (
        <div className="status-banner success">
          {`Complaint submitted. Unit trust score updated to ${result?.trustScore ?? "unknown"}.`}
        </div>
      ) : null}
      {result && complaintId ? (
        <div className="status-banner success">
          {`Complaint resolved. Unit trust score updated to ${result?.trustScore ?? "unknown"}.`}
        </div>
      ) : null}

      {!complaintId ? (
        <>
          <div className={styles.grid}>
            <label className={styles.field}>
              <span>Unit</span>
              <select className="app-input" value={form.unitId} onChange={(event) => updateField("unitId", event.target.value)}>
                {units.map((unit) => (
                  <option key={unit.unitId} value={unit.unitId}>
                    {unit.unitId} - {unit.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Occupant ID (optional)</span>
              <input className="app-input" onChange={(event) => updateField("occupantId", event.target.value)} type="text" value={form.occupantId} />
            </label>
          </div>

          <div className={styles.severityBlock}>
            <span>Severity</span>
            <div className={styles.severityRow}>
              {severityOptions.map((severity) => (
                <button
                  key={severity}
                  className={`${styles.severityButton} ${Number(form.severity) === severity ? styles.severityButtonActive : ""}`}
                  onClick={() => updateField("severity", severity)}
                  type="button"
                >
                  <span className={`chip ${severityTone(severity)}`}>{severity}</span>
                </button>
              ))}
            </div>
          </div>

          <label className={styles.field}>
            <span>Incident type</span>
            <select className="app-input" value={form.incidentType} onChange={(event) => updateField("incidentType", event.target.value)}>
              {incidentTypes.map((item) => (
                <option key={item || "blank"} value={item}>
                  {item || "None"}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Description</span>
            <textarea
              className="textAreaField"
              onChange={(event) => updateField("description", event.target.value)}
              placeholder={`Describe the issue in ${selectedUnit.name}...`}
              value={form.description}
            />
          </label>

          <div className={styles.footer}>
            <div className={styles.context}>
              <strong>{selectedUnit.unitId || "No unit selected"}</strong>
              <span>{selectedUnit.address}</span>
            </div>
            <button className="btn-primary" disabled={submitting} type="submit">
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>

          <p className="label-caps">Max 5 complaints per minute</p>
        </>
      ) : (
        <>
          <label className={styles.field}>
            <span>Resolution notes</span>
            <textarea
              className="textAreaField"
              onChange={(event) => updateField("resolutionNotes", event.target.value)}
              placeholder="Add any notes before resolving this complaint..."
              value={form.resolutionNotes}
            />
          </label>

          <button className="btn-primary" disabled={submitting} type="submit">
            {submitting ? "Resolving..." : "Mark resolved"}
          </button>
        </>
      )}
    </form>
  );
}
