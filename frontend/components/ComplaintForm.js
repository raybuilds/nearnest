"use client";

import { useMemo, useState } from "react";
import { mockUnits } from "@/lib/mockData";
import styles from "./ComplaintForm.module.css";

const categories = ["Plumbing", "Electrical", "Structural", "Other"];
const priorities = ["Low", "Medium", "High"];

export default function ComplaintForm() {
  const [form, setForm] = useState({
    unitId: mockUnits[0].unitId,
    category: categories[0],
    priority: priorities[1],
    description: "",
    fileName: "",
  });
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const selectedUnit = useMemo(
    () => mockUnits.find((unit) => unit.unitId === form.unitId) || mockUnits[0],
    [form.unitId]
  );

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function requestDraft() {
    setLoadingDraft(true);
    setResult(null);
    try {
      const response = await fetch("/api/dawn/draft-complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: form.unitId,
          category: form.category,
          priority: form.priority,
        }),
      });
      const payload = await response.json();
      updateField("description", payload.draft || "");
    } finally {
      setLoadingDraft(false);
    }
  }

  async function submitComplaint(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
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
            {mockUnits.map((unit) => (
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
          Complaint {result.id} submitted for {form.unitId}. Dawn has queued it for review.
        </div>
      )}
    </form>
  );
}
