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
  getLandlordGuestStays,
  getLandlordPayments,
  verifyPayment,
  getLandlordCompliance,
  uploadCompliance,
  createAgreement,
  createAgreementVersion,
  submitAgreement,
  signLandlordAgreement,
  getInterestedStudents,
  getLandlordAgreements,
  getLandlordUnitAnalytics,
  BASE,
} from "@/lib/api";
import { formatDateTime, getStatusTone, getTrustBand } from "@/lib/governance";
import { getStoredRole } from "@/lib/session";
import DawnAnalyticsViewer from "@/components/DawnAnalyticsViewer";
import { FadeIn, Reveal, Expand } from "@/components/ui/Motion";

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
  const [landlordGuests, setLandlordGuests] = useState([]);
  const [landlordPayments, setLandlordPayments] = useState([]);
  const [landlordCompliance, setLandlordCompliance] = useState([]);
  const [interestedStudents, setInterestedStudents] = useState([]);
  const [landlordAgreements, setLandlordAgreements] = useState([]);
  const [landlordLoading, setLandlordLoading] = useState(false);
  const [agreementForm, setAgreementForm] = useState({ occupancyId: "", rentAmount: "", securityDeposit: "", noticePeriodDays: 30, startDate: "", endDate: "" });
  const [complianceDocForm, setComplianceDocForm] = useState({ docType: "KYC", expiryDate: "" });
  const [agreementFile, setAgreementFile] = useState(null);
  const [complianceFile, setComplianceFile] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [landlordAnalytics, setLandlordAnalytics] = useState(null);
  const [expandedLandlordPaymentId, setExpandedLandlordPaymentId] = useState(null);
  const [expandedLandlordAgreementId, setExpandedLandlordAgreementId] = useState(null);
  const [expandedLandlordComplianceId, setExpandedLandlordComplianceId] = useState(null);

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
        try {
          const [guestPayload, paymentPayload, compliancePayload, studentPayload, agreementPayload, analyticsPayload] = await Promise.all([
            getLandlordGuestStays(unitId).catch(() => []),
            getLandlordPayments(unitId).catch(() => []),
            getLandlordCompliance(unitId).catch(() => []),
            getInterestedStudents(unitId).catch(() => []),
            getLandlordAgreements(unitId).catch(() => []),
            getLandlordUnitAnalytics(unitId).catch(() => null),
          ]);
          setLandlordGuests(Array.isArray(guestPayload) ? guestPayload : []);
          setLandlordPayments(Array.isArray(paymentPayload) ? paymentPayload : []);
          setLandlordCompliance(Array.isArray(compliancePayload) ? compliancePayload : []);
          setInterestedStudents(Array.isArray(studentPayload?.students) ? studentPayload.students : []);
          setLandlordAgreements(Array.isArray(agreementPayload) ? agreementPayload : []);
          setLandlordAnalytics(analyticsPayload);
        } catch (err) {
          console.error(err);
        }
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

  async function handleCreateAgreement(e) {
    e.preventDefault();
    setLandlordLoading(true);
    setError("");
    setBanner("");
    try {
      const formData = new FormData();
      formData.append("occupancyId", agreementForm.occupancyId);
      formData.append("rentAmount", agreementForm.rentAmount);
      formData.append("securityDeposit", agreementForm.securityDeposit);
      formData.append("noticePeriodDays", agreementForm.noticePeriodDays);
      formData.append("startDate", agreementForm.startDate);
      formData.append("endDate", agreementForm.endDate);
      if (agreementFile) {
        formData.append("document", agreementFile);
      }

      await fetch(`${BASE}/agreement`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || "Failed to create agreement");
        }
        return r.json();
      });

      setBanner("Agreement draft created.");
      setAgreementForm({ occupancyId: "", rentAmount: "", securityDeposit: "", noticePeriodDays: 30, startDate: "", endDate: "" });
      setAgreementFile(null);
      await loadPage("landlord");
    } catch (err) {
      setError(err.message || "Failed to create agreement");
    } finally {
      setLandlordLoading(false);
    }
  }

  async function handleCreateAgreementVersion(parentId, e) {
    e.preventDefault();
    setLandlordLoading(true);
    setError("");
    setBanner("");
    try {
      const formData = new FormData();
      formData.append("rentAmount", agreementForm.rentAmount);
      formData.append("securityDeposit", agreementForm.securityDeposit);
      formData.append("noticePeriodDays", agreementForm.noticePeriodDays);
      formData.append("startDate", agreementForm.startDate);
      formData.append("endDate", agreementForm.endDate);
      if (agreementFile) {
        formData.append("document", agreementFile);
      }

      await fetch(`${BASE}/agreement/${parentId}/version`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      }).then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || "Failed to amend agreement version");
        }
        return r.json();
      });

      setBanner("New agreement version created.");
      setAgreementForm({ occupancyId: "", rentAmount: "", securityDeposit: "", noticePeriodDays: 30, startDate: "", endDate: "" });
      setAgreementFile(null);
      await loadPage("landlord");
    } catch (err) {
      setError(err.message || "Failed to amend agreement version");
    } finally {
      setLandlordLoading(false);
    }
  }

  async function handleSubmitAgreement(id) {
    setLandlordLoading(true);
    setError("");
    setBanner("");
    try {
      await submitAgreement(id);
      setBanner("Agreement terms submitted to tenant.");
      await loadPage("landlord");
    } catch (err) {
      setError(err.message || "Failed to submit agreement");
    } finally {
      setLandlordLoading(false);
    }
  }

  async function handleSignLandlord(id) {
    setLandlordLoading(true);
    setError("");
    setBanner("");
    try {
      await signLandlordAgreement(id);
      setBanner("Agreement signed and active.");
      await loadPage("landlord");
    } catch (err) {
      setError(err.message || "Failed to sign agreement");
    } finally {
      setLandlordLoading(false);
    }
  }

  async function handleComplianceUpload(e) {
    e.preventDefault();
    if (!complianceFile) {
      setError("Please select a file to upload.");
      return;
    }
    setLandlordLoading(true);
    setError("");
    setBanner("");
    try {
      const formData = new FormData();
      formData.append("document", complianceFile);
      formData.append("docType", complianceDocForm.docType);
      if (complianceDocForm.expiryDate) {
        formData.append("expiryDate", complianceDocForm.expiryDate);
      }
      await uploadCompliance(unitId, formData);
      setBanner("Compliance document uploaded successfully.");
      setComplianceDocForm({ docType: "KYC", expiryDate: "" });
      setComplianceFile(null);
      await loadPage("landlord");
    } catch (err) {
      setError(err.message || "Failed to upload compliance document");
    } finally {
      setLandlordLoading(false);
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
      <FadeIn className="grid gap-5">
        <div className="surface-panel h-56 animate-pulse rounded-2xl bg-stone-800" />
        <div className="surface-panel h-96 animate-pulse rounded-2xl bg-stone-800" />
      </FadeIn>
    );
  }

  return (
    <div className="grid gap-6">
      <Link className="btn-secondary w-fit text-xs tracking-wider uppercase font-semibold" href="/dashboard">
        Back to dashboard
      </Link>

      {error ? <div className="status-banner error">{error}</div> : null}
      {banner ? <div className="status-banner success">{banner}</div> : null}

      <Reveal duration={0.6}>
        <section className="glass-panel-strong blueprint-border p-8 sm:p-10 rounded-2xl bg-[var(--bg-surface-strong)]">
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
                {(adminDetail?.governanceCore?.auditRequired || landlordDetail?.auditRequired) ? (
                  <span className="signal-chip signal-danger">Audit required</span>
                ) : null}
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
              <button className="btn-secondary text-xs tracking-wider uppercase font-semibold" onClick={handleExplain} type="button">
                Explain trust score
              </button>
            </div>
          </div>
        </section>
      </Reveal>

      {role === "landlord" && (
        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4 mb-4">
          {[
            { id: "overview", label: "Overview & Evidence" },
            { id: "checklists", label: "Readiness Checklists" },
            { id: "stays", label: "Occupants & Stays" },
            { id: "payments", label: "Payments Ledger" },
            { id: "agreements", label: "Rental Agreements" },
            { id: "compliance", label: "Governance Compliance" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-wider transition ${
                activeTab === tab.id
                  ? "bg-sky-500 text-white shadow-lg"
                  : "bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {(role !== "landlord" || activeTab === "overview") && (
        <section className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
          <article className="glass-panel p-6 rounded-2xl bg-[var(--bg-surface-strong)]">
            <div className="eyebrow">Governance Core</div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Trust Band</p><strong className="mt-2 block text-white">{trust.label}</strong></div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Risk level</p><strong className="mt-2 block text-white">{trust.key === "A" ? "Stable" : trust.key === "B" ? "Warning" : "Critical"}</strong></div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Audit required</p><strong className="mt-2 block text-white">{(adminDetail?.governanceCore?.auditRequired || landlordDetail?.auditRequired) ? "Yes" : "No"}</strong></div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Visible to students</p><strong className="mt-2 block text-white">{(studentDetail?.transparency?.visibleToStudents === false || landlordDetail?.visibleToStudents === false) ? "No" : "Yes"}</strong></div>
            </div>
          </article>

          <article className="glass-panel p-6 rounded-2xl bg-[var(--bg-surface-strong)]">
            <div className="eyebrow">Trust Breakdown</div>
            <div className="mt-5 grid gap-3">
              {visibilityNotes.map((note) => (
                <div key={note} className="rounded-[24px] border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-300">
                  {note}
                </div>
              ))}
              <AnimatePresence>
                {explanation?.visibilityReasons?.map((note) => (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    key={note} 
                    className="rounded-[24px] border border-sky-300/20 bg-sky-300/10 p-4 text-sm leading-6 text-slate-200"
                  >
                    {note}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </article>
        </section>
      )}

      {/* Checklists & Evidence */}
      {role !== "landlord" ? (
        <FadeIn className="grid gap-5 lg:grid-cols-2">
          <article className="glass-panel p-6 rounded-2xl bg-[var(--bg-surface-strong)]">
            <div className="eyebrow">Checklists</div>
            <h2 className="section-title mt-4">Structural and operational readiness</h2>
            <div className="mt-5 text-sm leading-6 text-slate-400">
              Checklist status is reflected indirectly through trust and visibility for student users.
            </div>
          </article>

          <article className="glass-panel p-6 rounded-2xl bg-[var(--bg-surface-strong)]">
            <div className="eyebrow">Evidence & Media</div>
            <h2 className="section-title mt-4">Photos, docs, and 360 proof</h2>
            <div className="mt-5 grid gap-3">
              {evidenceList.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {evidenceList.map((item, idx) => (
                    <div key={item.id} className="relative overflow-hidden rounded-xl border border-white/5 group aspect-video">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 opacity-60" />
                      {item.publicUrl ? (
                        <img 
                          src={item.publicUrl} 
                          alt={`Evidence ${idx + 1}`} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                        />
                      ) : (
                        <div className="w-full h-full bg-stone-800 flex items-center justify-center text-xs text-stone-400">
                          Attached proof document
                        </div>
                      )}
                      <span className="absolute bottom-2.5 left-2.5 z-20 signal-chip signal-info text-[10px] uppercase">
                        {item.type}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No evidence uploaded yet.</div>
              )}
            </div>
          </article>
        </FadeIn>
      ) : (
        <>
          {activeTab === "checklists" && (
            <section className="grid gap-5">
              <article className="glass-panel p-6 rounded-2xl bg-[var(--bg-surface-strong)]">
                <div className="eyebrow">Checklists</div>
                <h2 className="section-title mt-4">Structural and operational readiness</h2>
                <div className="mt-6 grid gap-6">
                  <div>
                    <h3 className="mb-4 text-lg font-semibold text-white">Structural</h3>
                    <ToggleGrid fields={structuralFields} setValues={setStructuralForm} values={structuralForm} />
                    <button className="btn-secondary mt-4 text-xs font-semibold tracking-wider" onClick={() => saveChecklist("structural")} type="button">
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
                    <button className="btn-secondary mt-4 text-xs font-semibold tracking-wider" onClick={() => saveChecklist("operational")} type="button">
                      Save operational checklist
                    </button>
                  </div>
                </div>
              </article>
            </section>
          )}

          {activeTab === "overview" && (
            <section className="grid gap-5">
              <article className="glass-panel p-6 rounded-2xl bg-[var(--bg-surface-strong)]">
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
              </article>

              {landlordAnalytics && (
                <article className="glass-panel p-6 rounded-2xl bg-[var(--bg-surface-strong)]">
                  <div className="eyebrow">Operational Insights</div>
                  <h2 className="section-title mt-4 mb-4">DAWN Diagnostic Feed</h2>
                  <DawnAnalyticsViewer analytics={landlordAnalytics} />
                </article>
              )}
            </section>
          )}
        </>
      )}

      {(role !== "landlord" || activeTab === "overview") && (
        <section className="grid gap-5 lg:grid-cols-2">
          <article className="glass-panel p-6 rounded-2xl bg-[var(--bg-surface-strong)]">
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

          <article className="glass-panel p-6 rounded-2xl bg-[var(--bg-surface-strong)]">
            <div className="eyebrow">Actions</div>
            {role === "student" ? (
              <div className="mt-5 grid gap-4">
                <Link className="btn-secondary text-xs tracking-wider uppercase font-semibold text-center py-3" href={`/unit/${unitId}/complaints`}>
                  Open complaint history
                </Link>
                <ComplaintForm initialUnitId={unitId} />
              </div>
            ) : role === "admin" ? (
              <div className="mt-5 grid gap-6">
                <div>
                  <p className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">Governance status</p>
                  <div className="flex flex-wrap gap-3">
                    <button className="btn-primary text-xs font-semibold tracking-wider" onClick={() => handleAdminStatus("approved")} type="button">Approve</button>
                    <button className="btn-secondary text-xs font-semibold tracking-wider" onClick={() => handleAdminStatus("suspended")} type="button">Suspend</button>
                    <button className="btn-secondary text-xs font-semibold tracking-wider" onClick={() => handleAdminStatus("rejected")} type="button">Reject</button>
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
                  <button className="btn-secondary mt-3 text-xs font-semibold tracking-wider" onClick={handleTriggerAudit} type="button">
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
                  <button className="btn-secondary mt-3 text-xs font-semibold tracking-wider" onClick={handlePenalty} type="button">
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
      )}

      {role === "admin" ? (
        <section className="glass-panel p-6 rounded-2xl bg-[var(--bg-surface-strong)]">
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
                        {log.resolved ? "Resolved" : "Pending Action"}
                      </span>
                    </div>
                    {log.createdAt ? <span className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</span> : null}
                  </div>
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
                        <button className="btn-secondary mt-3 text-xs font-semibold tracking-wider" onClick={() => handleSetCorrectivePlan(log.id)} type="button">
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
                        <button className="btn-primary mt-3 text-xs font-semibold tracking-wider" onClick={() => handleResolveAudit(log.id)} type="button">
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

      {role === "landlord" && (
        <>
          {activeTab === "stays" && (
            <Reveal duration={0.5}>
              <section className="grid gap-6 mt-8">
                <article className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface-strong)] border border-white/5">
                  <div className="eyebrow">Guest Stay Logs</div>
                  <h2 className="section-title mt-2">Active and historical guest stays</h2>
                  {landlordGuests.length === 0 ? (
                    <p className="text-sm text-slate-400 mt-4">No guest logs found for this unit.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {landlordGuests.map((guest) => (
                        <div key={guest.id} className="flex justify-between items-center p-3 border border-white/5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                          <div>
                            <p className="text-sm font-semibold text-slate-200">{guest.guestName}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              In: {new Date(guest.startDate).toLocaleString()}
                              {guest.endDate && ` | Out: ${new Date(guest.endDate).toLocaleString()}`}
                            </p>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${guest.active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-300"}`}>
                            {guest.active ? "Active" : "Completed"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              </section>
            </Reveal>
          )}

          {activeTab === "payments" && (
            <Reveal duration={0.5}>
              <section className="grid gap-6 mt-8">
                <article className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface-strong)] border border-white/5">
                  <div className="eyebrow">Rent Verification</div>
                  <h2 className="section-title mt-2">Rent Statements and verification control</h2>
                  {landlordPayments.length === 0 ? (
                    <p className="text-sm text-slate-400 mt-4">No rent records found for this unit.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {landlordPayments.map((payment) => {
                        const isExpanded = expandedLandlordPaymentId === payment.id;
                        return (
                          <div key={payment.id} className="border border-white/5 rounded-xl bg-white/5 overflow-hidden transition-all hover:bg-white/10">
                            <div 
                              className="flex flex-wrap justify-between items-center p-4 cursor-pointer select-none"
                              onClick={() => setExpandedLandlordPaymentId(isExpanded ? null : payment.id)}
                            >
                              <div>
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-bold text-white">{payment.month}</span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                                    payment.status === "VERIFIED"
                                      ? "bg-emerald-500/20 text-emerald-300"
                                      : payment.status === "PAID"
                                      ? "bg-amber-500/20 text-amber-300"
                                      : "bg-rose-500/20 text-rose-300"
                                  }`}>
                                    {payment.status}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-1">Student: {payment.occupancy?.student?.name || "Occupant"}</p>
                              </div>
                              <div className="text-right flex items-center gap-4">
                                <div>
                                  <span className="text-xs text-slate-500 block">Amount</span>
                                  <span className="text-sm font-bold text-slate-200">₹{payment.amount}</span>
                                </div>
                                <span className="text-xs text-sky-400 font-semibold">{isExpanded ? "Hide" : "Expand"}</span>
                              </div>
                            </div>

                            <Expand isExpanded={isExpanded}>
                              <div className="p-4 bg-black/20 border-t border-white/5 text-xs text-slate-300 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-[10px] uppercase text-slate-500 tracking-wider font-semibold">Payment Receipt Reference</p>
                                    <p className="mt-1 text-sm font-mono text-white bg-black/40 px-2 py-1 rounded w-fit border border-white/5">
                                      {payment.receiptRef || "—"}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] uppercase text-slate-500 tracking-wider font-semibold">Action Center</p>
                                    {payment.status === "PAID" ? (
                                      <button
                                        className="btn-primary text-xs py-1.5 px-4 mt-1.5 font-bold tracking-wider"
                                        disabled={landlordLoading}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          setLandlordLoading(true);
                                          try {
                                            await verifyPayment(payment.id);
                                            const refreshed = await getLandlordPayments(unitId).catch(() => []);
                                            setLandlordPayments(Array.isArray(refreshed) ? refreshed : []);
                                          } catch (err) {
                                            alert(err.message || "Verification failed");
                                          } finally {
                                            setLandlordLoading(false);
                                          }
                                        }}
                                      >
                                        Verify & Settle Statement
                                      </button>
                                    ) : (
                                      <p className="mt-2 text-slate-400">
                                        {payment.status === "VERIFIED" ? "Statement verified and finalized." : "Awaiting student payment submission."}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </Expand>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </article>
              </section>
            </Reveal>
          )}

          {activeTab === "agreements" && (
            <Reveal duration={0.5}>
              <section className="grid gap-6 mt-8">
                <article className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface-strong)] border border-white/5">
                  <div className="eyebrow">Rental Agreements</div>
                  <h2 className="section-title mt-2">Tenancy Agreements & Versioning</h2>
                  <div className="space-y-4">
                    {landlordAgreements.length === 0 ? (
                      <p className="text-sm text-slate-400">No agreements generated yet.</p>
                    ) : (
                      landlordAgreements.map((agg) => {
                        const isExpanded = expandedLandlordAgreementId === agg.id;
                        return (
                          <div key={agg.id} className="p-4 border border-white/5 rounded-xl bg-white/5 space-y-3 overflow-hidden">
                            <div className="flex justify-between items-center text-sm font-semibold text-slate-200">
                              <span>v{agg.version} | Student: {agg.occupancy?.student?.name || "Occupant"}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                                agg.status === "ACTIVE"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : agg.status === "SUPERSEDED"
                                  ? "bg-indigo-500/20 text-indigo-300"
                                  : "bg-amber-500/20 text-amber-300"
                              }`}>
                                {agg.status}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-400">
                              <div>Rent: ₹{agg.rentAmount}/mo</div>
                              <div>Deposit: ₹{agg.securityDeposit}</div>
                              <div>Notice: {agg.noticePeriodDays} Days</div>
                              <div>Period: {new Date(agg.startDate).toLocaleDateString()} - {new Date(agg.endDate).toLocaleDateString()}</div>
                            </div>
                            <div className="flex flex-wrap gap-2 justify-between items-center pt-2 border-t border-white/5">
                              <div className="flex gap-3 text-[10px] text-slate-500">
                                <span>Tenant: {agg.tenantSigned ? "Signed" : "Unsigned"}</span>
                                <span>Landlord: {agg.landlordSigned ? "Signed" : "Unsigned"}</span>
                              </div>
                              <div className="flex gap-3 items-center">
                                <button 
                                  className="text-xs text-sky-400 font-semibold hover:underline"
                                  onClick={() => setExpandedLandlordAgreementId(isExpanded ? null : agg.id)}
                                >
                                  {isExpanded ? "Hide Actions" : "Show Actions"}
                                </button>
                                {agg.documentPath && (
                                  <a
                                    href={`/api/agreement/document/${agg.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-sky-300 hover:underline font-semibold"
                                  >
                                    View PDF
                                  </a>
                                )}
                              </div>
                            </div>

                            <Expand isExpanded={isExpanded}>
                              <div className="p-3 mt-2 rounded-lg bg-black/20 border border-white/5 space-y-3 text-xs text-slate-300">
                                <div className="flex flex-wrap gap-3">
                                  {agg.status === "DRAFT" && (
                                    <button
                                      className="btn-primary text-xs py-1.5 px-3 font-semibold"
                                      disabled={landlordLoading}
                                      onClick={() => handleSubmitAgreement(agg.id)}
                                    >
                                      Submit Terms to Tenant
                                    </button>
                                  )}
                                  {agg.status === "PENDING_LANDLORD" && (
                                    <button
                                      className="btn-primary text-xs py-1.5 px-3 font-semibold bg-emerald-600 border-emerald-500"
                                      disabled={landlordLoading}
                                      onClick={() => handleSignLandlord(agg.id)}
                                    >
                                      Sign & Activate Agreement
                                    </button>
                                  )}
                                  {(agg.status === "ACTIVE" || agg.status === "SUPERSEDED") && (
                                    <button
                                      className="btn-secondary text-xs py-1.5 px-3 font-semibold"
                                      onClick={() => {
                                        setAgreementForm({
                                          occupancyId: agg.occupancyId,
                                          rentAmount: agg.rentAmount,
                                          securityDeposit: agg.securityDeposit,
                                          noticePeriodDays: agg.noticePeriodDays,
                                          startDate: agg.startDate.split("T")[0],
                                          endDate: agg.endDate.split("T")[0],
                                        });
                                      }}
                                    >
                                      Use as Amendment Template
                                    </button>
                                  )}
                                </div>

                                {(agg.status === "ACTIVE" || agg.status === "SUPERSEDED") && agreementForm.occupancyId === agg.occupancyId && (
                                  <div className="mt-4 p-4 border border-indigo-500/20 bg-indigo-500/5 rounded-xl space-y-3">
                                    <p className="text-xs font-bold text-indigo-300">Amend/Correct Terms (Creates Version {agg.version + 1})</p>
                                    <form onSubmit={(e) => handleCreateAgreementVersion(agg.id, e)} className="space-y-2 text-xs">
                                      <div>
                                        <label className="block text-slate-400 mb-1">Rent Amount (₹)</label>
                                        <input
                                          type="number"
                                          required
                                          className="input-shell text-xs py-1 px-2"
                                          value={agreementForm.rentAmount}
                                          onChange={(e) => setAgreementForm({ ...agreementForm, rentAmount: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-slate-400 mb-1">Security Deposit (₹)</label>
                                        <input
                                          type="number"
                                          required
                                          className="input-shell text-xs py-1 px-2"
                                          value={agreementForm.securityDeposit}
                                          onChange={(e) => setAgreementForm({ ...agreementForm, securityDeposit: e.target.value })}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-slate-400 mb-1">Notice Period (Days)</label>
                                        <input
                                          type="number"
                                          required
                                          className="input-shell text-xs py-1 px-2"
                                          value={agreementForm.noticePeriodDays}
                                          onChange={(e) => setAgreementForm({ ...agreementForm, noticePeriodDays: e.target.value })}
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-slate-400 mb-1">Start Date</label>
                                          <input
                                            type="date"
                                            required
                                            className="input-shell text-xs py-1 px-2"
                                            value={agreementForm.startDate}
                                            onChange={(e) => setAgreementForm({ ...agreementForm, startDate: e.target.value })}
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-slate-400 mb-1">End Date</label>
                                          <input
                                            type="date"
                                            required
                                            className="input-shell text-xs py-1 px-2"
                                            value={agreementForm.endDate}
                                            onChange={(e) => setAgreementForm({ ...agreementForm, endDate: e.target.value })}
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-slate-400 mb-1">Contract PDF Representation</label>
                                        <input
                                          type="file"
                                          accept="application/pdf"
                                          className="text-xs text-slate-400"
                                          onChange={(e) => setAgreementFile(e.target.files?.[0] || null)}
                                        />
                                      </div>
                                      <div className="flex justify-end gap-2 pt-2">
                                        <button
                                          type="button"
                                          className="text-slate-400 hover:underline"
                                          onClick={() => setAgreementForm({ occupancyId: "", rentAmount: "", securityDeposit: "", noticePeriodDays: 30, startDate: "", endDate: "" })}
                                        >
                                          Cancel
                                        </button>
                                        <button type="submit" className="btn-primary text-xs py-1 px-3" disabled={landlordLoading}>
                                          Create Version {agg.version + 1}
                                        </button>
                                      </div>
                                    </form>
                                  </div>
                                )}
                              </div>
                            </Expand>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="border-t border-white/10 pt-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-200">Create Tenancy Agreement Draft</h3>
                    <form onSubmit={handleCreateAgreement} className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Active Occupant</label>
                        <select
                          required
                          className="input-shell text-xs py-1.5 px-2 bg-slate-900 text-white"
                          value={agreementForm.occupancyId}
                          onChange={(e) => setAgreementForm({ ...agreementForm, occupancyId: e.target.value })}
                        >
                          <option value="">Select Student Stay Context...</option>
                          {interestedStudents
                            .filter(s => s.status === "occupant")
                            .map((occupant) => {
                              const matchedOccupancy = landlordPayments.find(p => p.occupancy?.studentId === occupant.studentId)?.occupancyId;
                              return (
                                <option key={occupant.studentId} value={matchedOccupancy || ""}>
                                  {occupant.name} ({occupant.email}) - Stay Context ID: {matchedOccupancy || "N/A"}
                                </option>
                              );
                            })}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 mb-1">Rent Amount (₹)</label>
                          <input
                            type="number"
                            required
                            placeholder="e.g. 8000"
                            className="input-shell text-xs py-1.5 px-2"
                            value={agreementForm.rentAmount}
                            onChange={(e) => setAgreementForm({ ...agreementForm, rentAmount: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Security Deposit (₹)</label>
                          <input
                            type="number"
                            required
                            placeholder="e.g. 16000"
                            className="input-shell text-xs py-1.5 px-2"
                            value={agreementForm.securityDeposit}
                            onChange={(e) => setAgreementForm({ ...agreementForm, securityDeposit: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Notice Period (Days)</label>
                        <input
                          type="number"
                          required
                          className="input-shell text-xs py-1.5 px-2"
                          value={agreementForm.noticePeriodDays}
                          onChange={(e) => setAgreementForm({ ...agreementForm, noticePeriodDays: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-400 mb-1">Start Date</label>
                          <input
                            type="date"
                            required
                            className="input-shell text-xs py-1.5 px-2"
                            value={agreementForm.startDate}
                            onChange={(e) => setAgreementForm({ ...agreementForm, startDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">End Date</label>
                          <input
                            type="date"
                            required
                            className="input-shell text-xs py-1.5 px-2"
                            value={agreementForm.endDate}
                            onChange={(e) => setAgreementForm({ ...agreementForm, endDate: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">PDF Lease Snapshot Document (Optional)</label>
                        <input
                          type="file"
                          accept="application/pdf"
                          className="text-xs text-slate-400"
                          onChange={(e) => setAgreementFile(e.target.files?.[0] || null)}
                        />
                      </div>
                      <button type="submit" className="btn-primary w-full text-xs py-2.5 font-bold tracking-wider" disabled={landlordLoading}>
                        Create Draft Agreement
                      </button>
                    </form>
                  </div>
                </article>
              </section>
            </Reveal>
          )}

          {activeTab === "compliance" && (
            <Reveal duration={0.5}>
              <section className="grid gap-6 mt-8">
                <article className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface-strong)] border border-white/5">
                  <div className="eyebrow">Governance & Compliance</div>
                  <h2 className="section-title mt-2">Upload compliance files (KYC, safety)</h2>
                  
                  <div className="grid gap-4 sm:grid-cols-2">
                    {landlordCompliance.length === 0 ? (
                      <p className="text-sm text-slate-400 col-span-2">No compliance files uploaded yet.</p>
                    ) : (
                      landlordCompliance.map((comp) => {
                        const isExpanded = expandedLandlordComplianceId === comp.id;
                        return (
                          <div key={comp.id} className="p-4 border border-white/5 rounded-xl bg-white/5 space-y-2 hover:bg-white/10 transition-colors">
                            <div className="flex justify-between items-center text-sm font-semibold text-slate-200">
                              <span>{comp.docType}</span>
                              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                                comp.status === "APPROVED"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : comp.status === "REJECTED"
                                  ? "bg-rose-500/20 text-rose-300"
                                  : comp.status === "EXPIRED"
                                  ? "bg-slate-500/20 text-slate-400"
                                  : "bg-amber-500/20 text-amber-300"
                              }`}>
                                {comp.status}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-slate-400">
                              <span>File: {comp.fileName}</span>
                              {comp.expiryDate && <span>Expires: {new Date(comp.expiryDate).toLocaleDateString()}</span>}
                            </div>
                            <div className="flex justify-end pt-1">
                              <button 
                                className="text-xs text-sky-400 font-semibold hover:underline"
                                onClick={() => setExpandedLandlordComplianceId(isExpanded ? null : comp.id)}
                              >
                                {isExpanded ? "Hide Logs" : "Show Logs"}
                              </button>
                            </div>

                            <Expand isExpanded={isExpanded}>
                              <div className="p-3 bg-black/25 rounded border border-white/5 text-[11px] text-slate-400 space-y-1 mt-2">
                                <p>Verification log audits:</p>
                                {comp.status === "REJECTED" && (
                                  <p className="text-rose-400">Rejection Reason: {comp.audits?.[0]?.reason || "Not specified"}</p>
                                )}
                                {comp.status === "APPROVED" && <p className="text-emerald-400">Document passed structural validation checks.</p>}
                              </div>
                            </Expand>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t border-white/10 pt-4 space-y-3">
                    <h3 className="text-sm font-semibold text-slate-200">Submit Compliance Document</h3>
                    <form onSubmit={handleComplianceUpload} className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">Document Category</label>
                        <select
                          required
                          className="input-shell text-xs py-1.5 px-2 bg-slate-900 text-white"
                          value={complianceDocForm.docType}
                          onChange={(e) => setComplianceDocForm({ ...complianceDocForm, docType: e.target.value })}
                        >
                          <option value="KYC">Owner Identity KYC</option>
                          <option value="FIRE_SAFETY">Fire Safety Certificate</option>
                          <option value="LICENSE">Municipal Rental License</option>
                          <option value="STRUCTURAL_SAFETY">Structural Engineer Certificate</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Document Expiry Date</label>
                        <input
                          type="date"
                          className="input-shell text-xs py-1.5 px-2"
                          value={complianceDocForm.expiryDate}
                          onChange={(e) => setComplianceDocForm({ ...complianceDocForm, expiryDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">File Upload (PDF/Image)</label>
                        <input
                          type="file"
                          required
                          onChange={(e) => setComplianceFile(e.target.files?.[0] || null)}
                        />
                      </div>
                      <button type="submit" className="btn-primary w-full text-xs py-2.5 font-bold tracking-wider" disabled={landlordLoading}>
                        Submit Compliance Document
                      </button>
                    </form>
                  </div>
                </article>
              </section>
            </Reveal>
          )}
        </>
      )}
    </div>
  );
}


