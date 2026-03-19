"use client";

import { useEffect, useMemo, useState } from "react";
import { createComplaint, getLandlordUnits, getProfile, getUnits, queryDawn } from "@/lib/api";
import styles from "./ComplaintForm.module.css";

const categories = ["Plumbing", "Electrical", "Structural", "Other"];
const priorities = ["Low", "Medium", "High"];

export default function ComplaintForm() {
  const [units, setUnits] = useState([]);
  const [form, setForm] = useState({
    unitId: "",
    category: categories[0],
    priority: priorities[1],
    description: "",
    fileName: "",
  });
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
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
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function requestDraft() {
    setLoadingDraft(true);
    setResult(null);
    try {
      const payload = await queryDawn({
        message: `Draft a complaint for unit ${form.unitId || "unknown"} about ${form.category} with ${form.priority} priority`,
        intent: "student_complaint",
      });
      updateField("description", payload?.assistant || form.description);
    } finally {
      setLoadingDraft(false);
    }
  }

  async function submitComplaint(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const severity =
        form.priority === "Low" ? 2 : form.priority === "Medium" ? 3 : 5;
      const payload = await createComplaint({
        unitId: Number(form.unitId),
        severity,
        message: form.description || null,
      });
      setResult(payload);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submitComplaint}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>Dawn Assisted Intake</p>
          <h3 className={styles.title}>Create a complaint</h3>
        </div>
        <button className={styles.draftButton} onClick={requestDraft} type="button">
          {loadingDraft ? "Drafting..." : "Dawn AI Draft"}
        </button>
      </div>

      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Unit</span>
          <select className="selectField" value={form.unitId} onChange={(event) => updateField("unitId", event.target.value)}>
            {units.map((unit) => (
              <option key={unit.unitId} value={unit.unitId}>
                {unit.unitId} - {unit.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Category</span>
          <select className="selectField" value={form.category} onChange={(event) => updateField("category", event.target.value)}>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>Priority</span>
          <select className="selectField" value={form.priority} onChange={(event) => updateField("priority", event.target.value)}>
            {priorities.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>File upload</span>
          <label className={styles.upload}>
            <input
              className={styles.hiddenInput}
              type="file"
              onChange={(event) => updateField("fileName", event.target.files?.[0]?.name || "")}
            />
            <span>{form.fileName || "Attach image or report"}</span>
          </label>
        </label>
      </div>

      <label className={styles.field}>
        <span>Description</span>
        <textarea
          className="textAreaField"
          placeholder={`Describe the issue in ${selectedUnit.name}...`}
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
        />
      </label>

      <div className={styles.footer}>
        <div className={styles.context}>
          <strong>{selectedUnit.unitId}</strong>
          <span>{selectedUnit.address}</span>
        </div>
        <button className={styles.submitButton} disabled={submitting} type="submit">
          {submitting ? <span className={styles.spinner} /> : null}
          {submitting ? "Submitting..." : "Submit Complaint"}
        </button>
      </div>

      {result && (
        <div className={styles.result}>
          Complaint {result?.complaint?.id || result?.id} submitted for {form.unitId}. Dawn has queued it for review.
        </div>
      )}
    </form>
  );
}
