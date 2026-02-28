"use client";

import { useState } from "react";
import { useEffect } from "react";
import { apiRequest } from "@/lib/api";

export default function ComplaintForm() {
  const [unitId, setUnitId] = useState("");
  const [occupantId, setOccupantId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [severity, setSeverity] = useState("1");
  const [incidentType, setIncidentType] = useState("");
  const [complaintText, setComplaintText] = useState("");
  const [resolveComplaintId, setResolveComplaintId] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [resolvingComplaint, setResolvingComplaint] = useState(false);
  const [role, setRole] = useState("");

  useEffect(() => {
    setStudentId(localStorage.getItem("studentId") || "");
    setRole(localStorage.getItem("role") || "");
  }, []);

  async function submitComplaint(e) {
    e.preventDefault();
    setStatusMessage("");
    setError("");
    setSubmittingComplaint(true);
    try {
      const result = await apiRequest("/complaint", {
        method: "POST",
        body: JSON.stringify({
          unitId: unitId ? Number(unitId) : undefined,
          occupantId: occupantId.trim() || undefined,
          studentId: Number(studentId),
          severity: Number(severity),
          incidentType: incidentType || undefined,
          message: complaintText.trim() || undefined,
        }),
      });
      setStatusMessage(`Complaint submitted. New trustScore: ${result.trustScore}`);
      setComplaintText("");
      setUnitId("");
      setOccupantId("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmittingComplaint(false);
    }
  }

  async function resolveComplaint(e) {
    e.preventDefault();
    setStatusMessage("");
    setError("");
    setResolvingComplaint(true);
    try {
      const result = await apiRequest(`/complaint/${Number(resolveComplaintId)}/resolve`, {
        method: "PATCH",
      });
      setStatusMessage(`Complaint resolved. New trustScore: ${result.trustScore}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setResolvingComplaint(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-xl font-semibold">Complaints</h2>

      <form onSubmit={submitComplaint} className="grid gap-2 md:grid-cols-6">
        <input
          className="rounded border p-2"
          placeholder="unitId"
          value={unitId}
          onChange={(e) => setUnitId(e.target.value)}
        />
        <input
          className="rounded border p-2"
          placeholder="occupantId (12 digits)"
          value={occupantId}
          onChange={(e) => setOccupantId(e.target.value)}
        />
        <input
          className="rounded border p-2"
          placeholder="studentId"
          value={studentId}
          readOnly
        />
        <input
          className="rounded border p-2"
          placeholder="severity (1-5)"
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        />
        <select className="rounded border p-2" value={incidentType} onChange={(e) => setIncidentType(e.target.value)}>
          <option value="">Incident type (optional)</option>
          <option value="safety">Safety</option>
          <option value="injury">Injury</option>
          <option value="fire">Fire</option>
          <option value="harassment">Harassment</option>
          <option value="other">Other</option>
        </select>
        <textarea
          className="rounded border p-2 md:col-span-5"
          placeholder="Describe the complaint (optional)"
          value={complaintText}
          onChange={(e) => setComplaintText(e.target.value)}
          maxLength={1200}
        />
        <button className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60" type="submit" disabled={submittingComplaint}>
          {submittingComplaint ? "Submitting..." : "Submit Complaint"}
        </button>
      </form>

      {(role === "admin" || role === "landlord") && (
        <form onSubmit={resolveComplaint} className="grid gap-2 md:grid-cols-3">
          <input
            className="rounded border p-2 md:col-span-2"
            placeholder="complaintId"
            value={resolveComplaintId}
            onChange={(e) => setResolveComplaintId(e.target.value)}
          />
          <button className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60" type="submit" disabled={resolvingComplaint}>
            {resolvingComplaint ? "Resolving..." : "Resolve Complaint"}
          </button>
        </form>
      )}

      {statusMessage && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{statusMessage}</p>}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
