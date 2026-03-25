"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ComplaintForm from "@/components/ComplaintForm";
import {
  explainUnit,
  getAdminAuditLogs,
  getAdminUnitDetail,
  getLandlordOverview,
  getStudentUnitDetail,
  patchOperationalCL,
  patchStructuralCL,
  penalizeSelfDecl,
  putOperationalCL,
  putStructuralCL,
  reviewUnit,
  resolveAuditLog,
  setCorrectivePlan,
  submitUnit,
  triggerAudit,
  uploadMedia,
} from "@/lib/api";
import { formatDateTime, getStatusTone, getTrustBand } from "@/lib/governance";
import { getStoredRole } from "@/lib/session";

const structuralFields = ["fireExit", "wiringSafe", "plumbingSafe", "occupancyCompliant"];
const operationalFields = ["bedAvailable", "waterAvailable", "toiletsAvailable", "ventilationGood"];
const evidenceTypes = ["photo", "document", "walkthrough360"];

function ToggleGrid({ values, setValues, fields }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((field) => (
        <label key={field} className="flex items-center justify-between rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
          <span>{field}</span>
          <input
            checked={Boolean(values?.[field])}
            onChange={() => setValues((current) => ({ ...current, [field]: !current?.[field] }))}
            type="checkbox"
          />
        </label>
      ))}
    </div>
  );
}

export default function UnitDetailPage({ params }) {
  const unitId = params.unitId;
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState("");
  const [explanation, setExplanation] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [landlordDetail, setLandlordDetail] = useState(null);
  const [adminDetail, setAdminDetail] = useState(null);
  const [adminAuditLogs, setAdminAuditLogs] = useState([]);
  const [structuralForm, setStructuralForm] = useState({});
  const [operationalForm, setOperationalForm] = useState({});
  const [selfDeclaration, setSelfDeclaration] = useState("");
  const [auditReason, setAuditReason] = useState("");
  const [penaltyForm, setPenaltyForm] = useState({ reason: "", penaltyPoints: 8 });
  const [auditForms, setAuditForms] = useState({});

  async function loadPage(currentRole) {
    setLoading(true);
    setError("");
    try {
      if (currentRole === "student") {
        const payload = await getStudentUnitDetail(unitId);
        setStudentDetail(payload);
        setLandlordDetail(null);
        setAdminDetail(null);
      } else if (currentRole === "landlord") {
        const payload = await getLandlordOverview(unitId);
        setLandlordDetail(payload);
        setStructuralForm(payload?.checklists?.structural || {});
        setOperationalForm(payload?.checklists?.operational || {});
        setSelfDeclaration(payload?.checklists?.operational?.selfDeclaration || "");
        setStudentDetail(null);
        setAdminDetail(null);
      } else {
        const [payload, auditLogs] = await Promise.all([
          getAdminUnitDetail(unitId),
          getAdminAuditLogs(unitId).catch(() => []),
        ]);
        setAdminDetail(payload);
        setAdminAuditLogs(Array.isArray(auditLogs) ? auditLogs : []);
        setStructuralForm(payload?.evidence?.structuralChecklist || {});
        setOperationalForm(payload?.evidence?.operationalChecklist || {});
        setSelfDeclaration(payload?.evidence?.selfDeclaration || "");
        setStudentDetail(null);
        setLandlordDetail(null);
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to load unit detail.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const currentRole = getStoredRole();
    setRole(currentRole);
    if (currentRole) {
      loadPage(currentRole);
    } else {
      setLoading(false);
    }
  }, [unitId]);

  const trustScore =
    studentDetail?.trustSignals?.trustScore ||
    landlordDetail?.trustScore ||
    adminDetail?.governanceCore?.trustScore ||
    0;
  const trust = getTrustBand(trustScore);
  const status =
    adminDetail?.governanceCore?.status ||
    landlordDetail?.status ||
    (studentDetail?.transparency?.visibleToStudents ? "visible" : "hidden");

  const visibilityNotes = useMemo(() => {
    if (studentDetail?.transparency?.visibilityReasons) return studentDetail.transparency.visibilityReasons;
    if (adminDetail?.behavioralHistory) {
      return [
        `${adminDetail.behavioralHistory.slaMetrics?.lateResolvedCount || 0} late resolution events shape governance.`,
        `${adminDetail.behavioralHistory.recurrenceAnalytics?.complaintsLast30Days || 0} complaints landed in the last 30 days.`,
      ];
    }
    if (landlordDetail?.visibleToStudents === false) {
      return ["Hidden because governance or trust conditions are not yet cleared."];
    }
    return ["Visibility reasoning will update as governance signals change."];
  }, [adminDetail, landlordDetail, studentDetail]);

  async function handleExplain() {
    setError("");
    try {
      const payload = await explainUnit(unitId);
      setExplanation(payload);
    } catch (requestError) {
      setError(requestError.message || "Unable to explain trust score.");
    }
  }

  async function saveChecklist(kind) {
    setError("");
    setBanner("");
    try {
      if (role === "landlord") {
        if (kind === "structural") {
          await putStructuralCL(unitId, structuralForm);
        } else {
          await putOperationalCL(unitId, { ...operationalForm, selfDeclaration });
        }
      } else {
        if (kind === "structural") {
          await patchStructuralCL(unitId, structuralForm);
        } else {
          await patchOperationalCL(unitId, { ...operationalForm, selfDeclaration });
        }
      }
      setBanner(`${kind} checklist saved.`);
      await loadPage(role);
    } catch (requestError) {
      setError(requestError.message || "Unable to save checklist.");
    }
  }

  async function handleUpload(event, type) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setBanner("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      await uploadMedia(unitId, formData);
      setBanner(`${type} uploaded.`);
      await loadPage(role);
    } catch (requestError) {
      setError(requestError.message || "Unable to upload evidence.");
    }
  }

  async function handleSubmitUnit() {
    setError("");
    setBanner("");
    try {
      await submitUnit(unitId);
      setBanner("Unit submitted for governance review.");
      await loadPage(role);
    } catch (requestError) {
      setError(requestError.message || "Unable to submit unit.");
    }
  }

  async function handleAdminStatus(nextStatus) {
    setError("");
    setBanner("");
    try {
      const body =
        nextStatus === "approved"
          ? { status: "approved", structuralApproved: true, operationalBaselineApproved: true }
          : { status: nextStatus };
      await reviewUnit(unitId, body);
      setBanner(`Unit moved to ${nextStatus}.`);
      await loadPage(role);
    } catch (requestError) {
      setError(requestError.message || "Unable to update governance status.");
    }
  }

  async function handleTriggerAudit() {
    setError("");
    setBanner("");
    try {
      await triggerAudit(unitId, { reason: auditReason });
      setAuditReason("");
      setBanner("Audit triggered successfully.");
      await loadPage(role);
    } catch (requestError) {
      setError(requestError.message || "Unable to trigger audit.");
    }
  }

  async function handlePenalty() {
    setError("");
    setBanner("");
    try {
      await penalizeSelfDecl(unitId, {
        reason: penaltyForm.reason,
        penaltyPoints: Number(penaltyForm.penaltyPoints || 8),
      });
      setPenaltyForm({ reason: "", penaltyPoints: 8 });
      setBanner("Self-declaration penalty applied.");
      await loadPage(role);
    } catch (requestError) {
      setError(requestError.message || "Unable to apply penalty.");
    }
  }

  function updateAuditForm(auditLogId, field, value) {
    setAuditForms((current) => ({
      ...current,
      [auditLogId]: {
        ...(current[auditLogId] || {}),
        [field]: value,
      },
    }));
  }

  async function handleSetCorrectivePlan(auditLogId) {
    const form = auditForms[auditLogId] || {};
    setError("");
    setBanner("");
    try {
      await setCorrectivePlan(auditLogId, {
        correctiveAction: form.correctiveAction,
        correctiveDeadline: form.correctiveDeadline || undefined,
      });
      setBanner(`Corrective plan saved for audit ${auditLogId}.`);
      await loadPage(role);
    } catch (requestError) {
      setError(requestError.message || "Unable to save corrective plan.");
    }
  }

  async function handleResolveAudit(auditLogId) {
    const form = auditForms[auditLogId] || {};
    setError("");
    setBanner("");
    try {
      await resolveAuditLog(auditLogId, {
        verificationNotes: form.verificationNotes || "",
        reopenUnit: Boolean(form.reopenUnit),
      });
      setBanner(`Audit ${auditLogId} resolved.`);
      await loadPage(role);
    } catch (requestError) {
      setError(requestError.message || "Unable to resolve audit.");
    }
  }

  const evidenceList =
    studentDetail?.discovery?.media ||
    landlordDetail?.media?.all ||
    adminDetail?.evidence?.media ||
    [];

  if (loading) {
    return (
      <div className="grid gap-5">
        <div className="surface-panel h-56 animate-pulse" />
        <div className="surface-panel h-96 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <Link className="btn-secondary w-fit" href="/dashboard">
        Back to dashboard
      </Link>

      {error ? <div className="status-banner error">{error}</div> : null}
      {banner ? <div className="status-banner success">{banner}</div> : null}

      <section className="glass-panel-strong blueprint-border p-8 sm:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="eyebrow">Unit Detail</div>
            <h1 className="page-title mt-5 text-gradient">Unit {unitId}</h1>
            <p className="subtle-copy mt-4 max-w-3xl">
              Governance core, trust breakdown, evidence, and history live together here so visibility never feels like a black box.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className={`signal-chip ${getStatusTone(status)}`}>{status}</span>
              <span className={`signal-chip ${trust.tone}`}>{trust.label}</span>
              {adminDetail?.governanceCore?.auditRequired || landlordDetail?.auditRequired ? <span className="signal-chip signal-danger">Audit required</span> : null}
            </div>
          </div>

          <div className="grid gap-3 sm:min-w-[280px]">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Trust score</p>
              <strong className="mt-2 block text-3xl text-white">{trustScore}</strong>
              <div className="mt-4 trust-track">
                <div className={`trust-fill ${trust.fillClass}`} style={{ width: `${trustScore}%` }} />
              </div>
            </div>
            <button className="btn-secondary" onClick={handleExplain} type="button">
              Explain trust score
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
        <article className="glass-panel p-6">
          <div className="eyebrow">Governance Core</div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Trust Band</p><strong className="mt-2 block text-white">{trust.label}</strong></div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Risk level</p><strong className="mt-2 block text-white">{trust.key === "A" ? "Stable" : trust.key === "B" ? "Warning" : "Critical"}</strong></div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Audit required</p><strong className="mt-2 block text-white">{adminDetail?.governanceCore?.auditRequired || landlordDetail?.auditRequired ? "Yes" : "No"}</strong></div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Visible to students</p><strong className="mt-2 block text-white">{studentDetail?.transparency?.visibleToStudents === false || landlordDetail?.visibleToStudents === false ? "No" : "Yes"}</strong></div>
          </div>
        </article>

        <article className="glass-panel p-6">
          <div className="eyebrow">Trust Breakdown</div>
          <div className="mt-5 grid gap-3">
            {visibilityNotes.map((note) => (
              <div key={note} className="rounded-[24px] border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-300">
                {note}
              </div>
            ))}
            {explanation?.visibilityReasons?.map((note) => (
              <div key={note} className="rounded-[24px] border border-sky-300/20 bg-sky-300/10 p-4 text-sm leading-6 text-slate-200">
                {note}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="glass-panel p-6">
          <div className="eyebrow">Checklists</div>
          <h2 className="section-title mt-4">Structural and operational readiness</h2>

          {(role === "landlord" || role === "admin") ? (
            <div className="mt-6 grid gap-6">
              <div>
                <h3 className="mb-4 text-lg font-semibold text-white">Structural</h3>
                <ToggleGrid fields={structuralFields} setValues={setStructuralForm} values={structuralForm} />
                <button className="btn-secondary mt-4" onClick={() => saveChecklist("structural")} type="button">
                  Save structural checklist
                </button>
              </div>
              <div>
                <h3 className="mb-4 text-lg font-semibold text-white">Operational</h3>
                <ToggleGrid fields={operationalFields} setValues={setOperationalForm} values={operationalForm} />
                <label className="mt-4 grid gap-2">
                  <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Self declaration</span>
                  <textarea className="textarea-shell" onChange={(event) => setSelfDeclaration(event.target.value)} value={selfDeclaration} />
                </label>
                <button className="btn-secondary mt-4" onClick={() => saveChecklist("operational")} type="button">
                  Save operational checklist
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 text-sm leading-6 text-slate-400">
              Checklist status is reflected indirectly through trust and visibility for student users.
            </div>
          )}
        </article>

        <article className="glass-panel p-6">
          <div className="eyebrow">Evidence</div>
          <h2 className="section-title mt-4">Photos, docs, and 360 proof</h2>
          <div className="mt-5 grid gap-3">
            {evidenceList.length ? (
              evidenceList.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="signal-chip signal-info">{item.type}</span>
                    {item.createdAt ? <span className="text-xs text-slate-500">{formatDateTime(item.createdAt)}</span> : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{item.publicUrl || "Evidence file attached to backend storage."}</p>
                </div>
              ))
            ) : (
              <div className="empty-state">No evidence uploaded yet.</div>
            )}
          </div>

          {role === "landlord" ? (
            <div className="mt-6 grid gap-3">
              {evidenceTypes.map((type) => (
                <label key={type} className="rounded-[24px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                  <span className="mb-2 block">{type}</span>
                  <input onChange={(event) => handleUpload(event, type)} type="file" />
                </label>
              ))}
              <button className="btn-primary mt-2" onClick={handleSubmitUnit} type="button">
                Submit for review
              </button>
            </div>
          ) : null}
        </article>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="glass-panel p-6">
          <div className="eyebrow">History</div>
          <div className="mt-5 grid gap-3">
            {adminDetail?.behavioralHistory?.complaintTimeline?.length ? (
              adminDetail.behavioralHistory.complaintTimeline.slice(0, 6).map((item) => (
                <div key={item.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="signal-chip signal-warning">Severity {item.severity}</span>
                    <span className={`signal-chip ${item.resolved ? "signal-success" : "signal-danger"}`}>{item.resolved ? "Resolved" : "Open"}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">Created {formatDateTime(item.createdAt)}</p>
                </div>
              ))
            ) : studentDetail?.transparency?.ownComplaintHistory?.length ? (
              studentDetail.transparency.ownComplaintHistory.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="signal-chip signal-warning">Severity {item.severity}</span>
                    <span className={`signal-chip ${item.resolved ? "signal-success" : "signal-danger"}`}>{item.resolved ? "Resolved" : "Open"}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">Created {formatDateTime(item.createdAt)}</p>
                </div>
              ))
            ) : (
              <div className="empty-state">No complaint timeline available for this unit.</div>
            )}
          </div>
        </article>

        <article className="glass-panel p-6">
          <div className="eyebrow">Actions</div>
          {role === "student" ? (
            <div className="mt-5 grid gap-4">
              <Link className="btn-secondary" href={`/unit/${unitId}/complaints`}>
                Open complaint history
              </Link>
              <ComplaintForm initialUnitId={unitId} />
            </div>
          ) : role === "admin" ? (
            <div className="mt-5 grid gap-6">
              <div>
                <p className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">Governance status</p>
                <div className="flex flex-wrap gap-3">
                  <button className="btn-primary" onClick={() => handleAdminStatus("approved")} type="button">Approve</button>
                  <button className="btn-secondary" onClick={() => handleAdminStatus("suspended")} type="button">Suspend</button>
                  <button className="btn-secondary" onClick={() => handleAdminStatus("rejected")} type="button">Reject</button>
                </div>
              </div>

              <div className="soft-divider pt-5">
                <p className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">Manual audit trigger</p>
                <textarea
                  className="textarea-shell"
                  onChange={(event) => setAuditReason(event.target.value)}
                  placeholder="Explain why this unit should enter audit review..."
                  value={auditReason}
                />
                <button className="btn-secondary mt-3" onClick={handleTriggerAudit} type="button">
                  Trigger audit
                </button>
              </div>

              <div className="soft-divider pt-5">
                <p className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">Self-declaration penalty</p>
                <textarea
                  className="textarea-shell"
                  onChange={(event) => setPenaltyForm((current) => ({ ...current, reason: event.target.value }))}
                  placeholder="Reason for misrepresentation penalty..."
                  value={penaltyForm.reason}
                />
                <input
                  className="input-shell mt-3"
                  min="1"
                  onChange={(event) => setPenaltyForm((current) => ({ ...current, penaltyPoints: event.target.value }))}
                  type="number"
                  value={penaltyForm.penaltyPoints}
                />
                <button className="btn-secondary mt-3" onClick={handlePenalty} type="button">
                  Apply penalty
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 text-sm leading-6 text-slate-400">
              Landlords can update evidence and checklists above. Complaint resolution remains on the complaints page.
            </div>
          )}
        </article>
      </section>

      {role === "admin" ? (
        <section className="glass-panel p-6">
          <div className="eyebrow">Audit Logs</div>
          <h2 className="section-title mt-4">Audit timeline and corrective actions</h2>
          <div className="mt-6 grid gap-4">
            {adminAuditLogs.length ? (
              adminAuditLogs.map((log) => (
                <article key={log.id} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      <span className="signal-chip signal-danger">{log.triggerType}</span>
                      <span className={`signal-chip ${log.resolved ? "signal-success" : "signal-warning"}`}>
                        {log.resolved ? "Resolved" : "Open"}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-300">{log.reason}</p>
                  {log.correctiveAction ? <p className="mt-2 text-sm leading-6 text-slate-400">Corrective action: {log.correctiveAction}</p> : null}
                  {log.correctiveDeadline ? <p className="text-sm leading-6 text-slate-400">Deadline: {formatDateTime(log.correctiveDeadline)}</p> : null}

                  {!log.resolved ? (
                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                      <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">Corrective plan</p>
                        <textarea
                          className="textarea-shell"
                          onChange={(event) => updateAuditForm(log.id, "correctiveAction", event.target.value)}
                          placeholder="Define the corrective plan..."
                          value={auditForms[log.id]?.correctiveAction || ""}
                        />
                        <input
                          className="input-shell mt-3"
                          onChange={(event) => updateAuditForm(log.id, "correctiveDeadline", event.target.value)}
                          type="date"
                          value={auditForms[log.id]?.correctiveDeadline || ""}
                        />
                        <button className="btn-secondary mt-3" onClick={() => handleSetCorrectivePlan(log.id)} type="button">
                          Save corrective plan
                        </button>
                      </div>

                      <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">Resolve audit</p>
                        <textarea
                          className="textarea-shell"
                          onChange={(event) => updateAuditForm(log.id, "verificationNotes", event.target.value)}
                          placeholder="Verification notes before resolving..."
                          value={auditForms[log.id]?.verificationNotes || ""}
                        />
                        <label className="mt-3 flex items-center justify-between rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                          <span>Reopen unit to approved status</span>
                          <input
                            checked={Boolean(auditForms[log.id]?.reopenUnit)}
                            onChange={(event) => updateAuditForm(log.id, "reopenUnit", event.target.checked)}
                            type="checkbox"
                          />
                        </label>
                        <button className="btn-primary mt-3" onClick={() => handleResolveAudit(log.id)} type="button">
                          Resolve audit log
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[24px] border border-emerald-300/15 bg-emerald-300/5 p-4 text-sm leading-6 text-slate-300">
                      {log.verificationNotes || "This audit log has already been resolved."}
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="empty-state">No audit logs are currently associated with this unit.</div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
