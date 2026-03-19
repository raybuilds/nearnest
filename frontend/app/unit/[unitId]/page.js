"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ComplaintForm from "@/components/ComplaintForm";
import {
  checkIn,
  explainUnit,
  getAdminAuditLogs,
  getAdminDemand,
  getAdminUnitDetail,
  getInterestedStudents,
  getLandlordAuditLogs,
  getLandlordComplaints,
  getLandlordOverview,
  getStudentUnitDetail,
  patchOperationalCL,
  patchStructuralCL,
  penalizeSelfDecl,
  putOperationalCL,
  putStructuralCL,
  queryDawn,
  reviewUnit,
  shortlistUnit,
  submitUnit,
  triggerAudit,
  uploadMedia,
} from "@/lib/api";
import styles from "./page.module.css";

function trustBandLabel(trustBand) {
  if (trustBand === "priority") return "Priority";
  if (trustBand === "standard") return "Standard";
  return "Hidden";
}

function trustBandClass(trustBand) {
  if (trustBand === "priority") return "band-priority";
  if (trustBand === "standard") return "band-standard";
  return "band-hidden";
}

function statusChip(status) {
  if (status === "approved" || status === "live") return "ch-ok";
  if (status === "submitted" || status === "pending") return "ch-warn";
  return "ch-err";
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function mediaTypesSubmitted(overview) {
  return Array.from(new Set((overview?.media?.all || []).map((item) => String(item.type || "").trim().toLowerCase())));
}

const requiredMediaTypes = ["photo", "document", "walkthrough360"];

export default function UnitDetailPage({ params }) {
  const unitId = params.unitId;
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");
  const [banner, setBanner] = useState("");
  const [studentDetail, setStudentDetail] = useState(null);
  const [landlordOverview, setLandlordOverview] = useState(null);
  const [landlordComplaints, setLandlordComplaints] = useState([]);
  const [landlordAudits, setLandlordAudits] = useState([]);
  const [interestedStudents, setInterestedStudents] = useState(null);
  const [adminDetail, setAdminDetail] = useState(null);
  const [adminAuditLogs, setAdminAuditLogs] = useState([]);
  const [adminDemand, setAdminDemand] = useState(null);
  const [dawnTrustCard, setDawnTrustCard] = useState(null);
  const [actionError, setActionError] = useState("");
  const [structuralForm, setStructuralForm] = useState({});
  const [operationalForm, setOperationalForm] = useState({});
  const [penaltyForm, setPenaltyForm] = useState({ reason: "", penaltyPoints: 8 });
  const [auditReason, setAuditReason] = useState("");
  const [checkInStudentId, setCheckInStudentId] = useState("");

  async function loadPageData(currentRole) {
    setLoading(true);
    setError("");
    try {
      if (currentRole === "student") {
        const payload = await getStudentUnitDetail(unitId);
        setStudentDetail(payload);
        setLandlordOverview(null);
        setAdminDetail(null);
      } else if (currentRole === "landlord") {
        const [overview, complaintsPayload, auditsPayload, interestedPayload] = await Promise.all([
          getLandlordOverview(unitId),
          getLandlordComplaints(unitId),
          getLandlordAuditLogs(unitId),
          getInterestedStudents(unitId),
        ]);
        setLandlordOverview(overview);
        setLandlordComplaints(complaintsPayload?.complaints || []);
        setLandlordAudits(auditsPayload?.logs || []);
        setInterestedStudents(interestedPayload);
        setStructuralForm(overview?.checklists?.structural || {});
        setOperationalForm(overview?.checklists?.operational || {});
        setStudentDetail(null);
        setAdminDetail(null);
      } else if (currentRole === "admin") {
        const detail = await getAdminUnitDetail(unitId);
        const audits = await getAdminAuditLogs(unitId);
        const corridorId = detail?.evidence?.corridor?.id;
        const demand = corridorId ? await getAdminDemand(corridorId) : null;
        setAdminDetail(detail);
        setAdminAuditLogs(audits || []);
        setAdminDemand(demand);
        setStructuralForm(detail?.evidence?.structuralChecklist || {});
        setOperationalForm(detail?.evidence?.operationalChecklist || {});
        setStudentDetail(null);
        setLandlordOverview(null);
      } else {
        setError("Unsupported role");
      }
    } catch (loadError) {
      setError(loadError.message || "Unable to load unit details.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const currentRole = localStorage.getItem("role") || "";
    setRole(currentRole);
    if (currentRole === "landlord") setTab("overview");
    if (currentRole === "admin") setTab("governance");
    if (currentRole === "student") setTab("overview");
    if (currentRole) {
      loadPageData(currentRole);
    } else {
      setLoading(false);
      setError("Please sign in to view unit details.");
    }
  }, [unitId]);

  const landlordMediaTypes = useMemo(() => mediaTypesSubmitted(landlordOverview), [landlordOverview]);
  const canSubmitUnit = requiredMediaTypes.every((type) => landlordMediaTypes.includes(type));
  const currentTrustBand =
    studentDetail?.trustSignals?.trustBand ||
    adminDetail?.governanceCore?.trustBand ||
    (Number(landlordOverview?.trustScore || 0) >= 80 ? "priority" : Number(landlordOverview?.trustScore || 0) >= 50 ? "standard" : "hidden");

  async function handleTrustExplain() {
    setActionError("");
    setBanner("");
    try {
      const [explainPayload, dawnPayload] = await Promise.all([
        explainUnit(unitId),
        queryDawn({ message: `Explain trust score for unit ${unitId}`, intent: "trust_explanation" }),
      ]);
      setDawnTrustCard({
        trustScore: explainPayload?.trustScore ?? null,
        trustBand: explainPayload?.trustBand ?? null,
        visibilityReasons: explainPayload?.visibilityReasons || [],
        assistant: dawnPayload?.assistant || "",
      });
    } catch (requestError) {
      setActionError(requestError.message || "Unable to explain this trust score right now.");
    }
  }

  async function handleShortlist() {
    setActionError("");
    setBanner("");
    try {
      await shortlistUnit({ unitId: Number(unitId) });
      setBanner("Unit shortlisted successfully.");
    } catch (requestError) {
      setActionError(requestError.message || "Unable to shortlist this unit.");
    }
  }

  async function saveLandlordChecklist(kind) {
    setActionError("");
    setBanner("");
    try {
      if (kind === "structural") {
        await putStructuralCL(unitId, {
          fireExit: Boolean(structuralForm.fireExit),
          wiringSafe: Boolean(structuralForm.wiringSafe),
          plumbingSafe: Boolean(structuralForm.plumbingSafe),
          occupancyCompliant: Boolean(structuralForm.occupancyCompliant),
        });
        setBanner("Structural checklist saved.");
      } else {
        await putOperationalCL(unitId, {
          bedAvailable: Boolean(operationalForm.bedAvailable),
          waterAvailable: Boolean(operationalForm.waterAvailable),
          toiletsAvailable: Boolean(operationalForm.toiletsAvailable),
          ventilationGood: Boolean(operationalForm.ventilationGood),
          selfDeclaration: operationalForm.selfDeclaration || "",
        });
        setBanner("Operational checklist saved.");
      }
      await loadPageData("landlord");
    } catch (requestError) {
      setActionError(requestError.message || "Checklist update failed.");
    }
  }

  async function handleMediaUpload(event, type) {
    const file = event.target.files?.[0];
    if (!file) return;
    setActionError("");
    setBanner("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      await uploadMedia(unitId, formData);
      setBanner(`${type} uploaded successfully.`);
      await loadPageData("landlord");
    } catch (requestError) {
      setActionError(requestError.message || "Media upload failed.");
    }
  }

  async function handleSubmitUnit() {
    setActionError("");
    setBanner("");
    try {
      await submitUnit(unitId);
      setBanner("Unit submitted for review.");
      await loadPageData("landlord");
    } catch (requestError) {
      setActionError(requestError.message || "Unable to submit unit.");
    }
  }

  async function handleCheckIn() {
    setActionError("");
    setBanner("");
    try {
      const payload = await checkIn({ unitId: Number(unitId), studentId: Number(checkInStudentId) });
      setBanner(`Student checked in. Occupant ID: ${payload?.occupant?.publicId || "generated"}.`);
      setCheckInStudentId("");
      await loadPageData("landlord");
    } catch (requestError) {
      setActionError(requestError.message || "Check-in failed.");
    }
  }

  async function handleAdminStatus(status) {
    setActionError("");
    setBanner("");
    try {
      const body =
        status === "approved"
          ? { status: "approved", structuralApproved: true, operationalBaselineApproved: true }
          : { status };
      await reviewUnit(unitId, body);
      setBanner(`Unit moved to ${status}.`);
      await loadPageData("admin");
    } catch (requestError) {
      setActionError(requestError.message || "Status update failed.");
    }
  }

  async function saveAdminChecklist(kind) {
    setActionError("");
    setBanner("");
    try {
      if (kind === "structural") {
        await patchStructuralCL(unitId, {
          fireExit: Boolean(structuralForm.fireExit),
          wiringSafe: Boolean(structuralForm.wiringSafe),
          plumbingSafe: Boolean(structuralForm.plumbingSafe),
          occupancyCompliant: Boolean(structuralForm.occupancyCompliant),
        });
        setBanner("Structural checklist updated.");
      } else {
        await patchOperationalCL(unitId, {
          bedAvailable: Boolean(operationalForm.bedAvailable),
          waterAvailable: Boolean(operationalForm.waterAvailable),
          toiletsAvailable: Boolean(operationalForm.toiletsAvailable),
          ventilationGood: Boolean(operationalForm.ventilationGood),
          selfDeclaration: operationalForm.selfDeclaration || "",
        });
        setBanner("Operational checklist updated.");
      }
      await loadPageData("admin");
    } catch (requestError) {
      setActionError(requestError.message || "Checklist update failed.");
    }
  }

  async function handlePenalty() {
    setActionError("");
    setBanner("");
    try {
      await penalizeSelfDecl(unitId, {
        reason: penaltyForm.reason,
        penaltyPoints: Number(penaltyForm.penaltyPoints || 8),
      });
      setBanner("Self-declaration penalty applied.");
      await loadPageData("admin");
    } catch (requestError) {
      setActionError(requestError.message || "Penalty could not be applied.");
    }
  }

  async function handleTriggerAudit() {
    setActionError("");
    setBanner("");
    try {
      await triggerAudit(unitId, { reason: auditReason });
      setBanner("Audit triggered successfully.");
      setAuditReason("");
      await loadPageData("admin");
    } catch (requestError) {
      setActionError(requestError.message || "Manual audit trigger failed.");
    }
  }

  function toggleFormValue(setter, field) {
    setter((current) => ({ ...current, [field]: !current[field] }));
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeleton} />
        <div className={styles.skeletonTall} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link className={styles.backLink} href="/dashboard">
        ← Back to dashboard
      </Link>

      {error ? <div className="status-banner error">{error}</div> : null}
      {actionError ? <div className="status-banner error">{actionError}</div> : null}
      {banner ? <div className="status-banner success">{banner}</div> : null}
      {role === "student" && studentDetail ? (
        <>
          <section className={`${styles.hero} glass fade-up`}>
            <div>
              <p className="label-caps">Student view</p>
              <h1 className={styles.heroTitle}>£{studentDetail.discovery?.rent || 0}/mo</h1>
              <div className={styles.heroMeta}>
                <span className="chip ch-blue">{studentDetail.discovery?.occupancyType || "shared"}</span>
                <span className={styles.heroDistance}>{studentDetail.discovery?.distanceKm || 0} km away</span>
              </div>
            </div>
            <div className={styles.heroActions}>
              <button className="btn-soft blue" onClick={handleTrustExplain} type="button">
                Explain Trust Score
              </button>
              <button className="btn-primary" onClick={handleShortlist} type="button">
                Shortlist this unit
              </button>
            </div>
          </section>

          {studentDetail.transparency?.visibilityReasons?.map((reason) => (
            <div key={reason} className="status-banner warn">
              {reason}
            </div>
          ))}

          <section className={`${styles.grid} fade-up-d1`}>
            <article className="panel">
              <div className={styles.sectionRow}>
                <div>
                  <p className="label-caps">Trust score</p>
                  <h2 className="section-heading">Current trust</h2>
                </div>
                <span className={`trust-band-badge ${trustBandClass(studentDetail.trustSignals?.trustBand)}`}>
                  {trustBandLabel(studentDetail.trustSignals?.trustBand)}
                </span>
              </div>
              <div className="trust-bar-track">
                <div
                  className={`trust-bar-fill ${studentDetail.trustSignals?.trustBand || "hidden"}`}
                  style={{ width: `${studentDetail.trustSignals?.trustScore || 0}%` }}
                />
              </div>
              <p className={styles.score}>{studentDetail.trustSignals?.trustScore || 0}</p>
              <div className={styles.metricGrid}>
                <div className="metric-card">
                  <span className="ml">Active complaints</span>
                  <strong className="mv">{studentDetail.trustSignals?.complaintSummary?.activeComplaints || 0}</strong>
                </div>
                <div className="metric-card">
                  <span className="ml">Complaints in 30 days</span>
                  <strong className="mv">{studentDetail.trustSignals?.complaintSummary?.complaintsLast30Days || 0}</strong>
                </div>
                <div className="metric-card">
                  <span className="ml">Last audit</span>
                  <strong className="mv">
                    {studentDetail.trustSignals?.lastAuditDate ? formatDate(studentDetail.trustSignals.lastAuditDate) : "None"}
                  </strong>
                </div>
              </div>
            </article>

            <article className="panel">
              <p className="label-caps">Availability</p>
              <h2 className="section-heading">Current occupancy</h2>
              <div className={styles.metricGrid}>
                <div className="metric-card">
                  <span className="ml">Capacity</span>
                  <strong className="mv">{studentDetail.availability?.capacity || 0}</strong>
                </div>
                <div className="metric-card">
                  <span className="ml">Occupied</span>
                  <strong className="mv">{studentDetail.availability?.occupancyCount || 0}</strong>
                </div>
                <div className="metric-card">
                  <span className="ml">Available slots</span>
                  <strong className="mv">{studentDetail.availability?.availableSlots || 0}</strong>
                </div>
              </div>
              <div className={styles.chipRow}>
                <span className={`chip ${studentDetail.discovery?.ac ? "ch-blue" : "ch-warn"}`}>
                  {studentDetail.discovery?.ac ? "AC included" : "No AC"}
                </span>
                <span className={`chip ${studentDetail.availability?.availableSlots > 0 ? "ch-ok" : "ch-err"}`}>
                  {studentDetail.availability?.availableSlots > 0 ? "Slots available" : "Full occupancy"}
                </span>
              </div>
            </article>
          </section>

          <section className={`${styles.grid} fade-up-d2`}>
            <article className="panel">
              <p className="label-caps">Transparency</p>
              <h2 className="section-heading">Media and history</h2>
              <div className={styles.mediaGrid}>
                {(studentDetail.discovery?.media || []).map((media) => (
                  <div key={media.id} className="panel-light">
                    <div className={styles.mediaHeader}>
                      <span className="chip ch-blue">{media.type}</span>
                      {media.locked ? <span className="chip ch-warn">Locked</span> : null}
                    </div>
                    <p className={styles.mediaText}>{media.publicUrl || "Stored media asset"}</p>
                  </div>
                ))}
                {!studentDetail.discovery?.media?.length ? <div className="empty-state">No media is currently attached to this unit.</div> : null}
              </div>
              {dawnTrustCard ? (
                <div className={`${styles.trustExplain} panel-light`}>
                  <p className="label-caps">Trust explanation</p>
                  <div className="trust-bar-track">
                    <div className={`trust-bar-fill ${dawnTrustCard.trustBand || "hidden"}`} style={{ width: `${dawnTrustCard.trustScore || 0}%` }} />
                  </div>
                  <div className={styles.explainHeader}>
                    <strong>{dawnTrustCard.trustScore || 0}</strong>
                    <span className={`trust-band-badge ${trustBandClass(dawnTrustCard.trustBand)}`}>{trustBandLabel(dawnTrustCard.trustBand)}</span>
                  </div>
                  {dawnTrustCard.assistant ? <p className={styles.muted}>{dawnTrustCard.assistant}</p> : null}
                  {(dawnTrustCard.visibilityReasons || []).map((reason) => (
                    <div key={reason} className="status-banner warn">
                      {reason}
                    </div>
                  ))}
                </div>
              ) : null}
            </article>

            <article className="panel">
              <p className="label-caps">Complaint history</p>
              <h2 className="section-heading">Your recent reports</h2>
              <div className={styles.timeline}>
                {(studentDetail.transparency?.ownComplaintHistory || []).map((item) => (
                  <div key={item.id} className="panel-light">
                    <div className={styles.timelineHeader}>
                      <span className={`chip ${item.resolved ? "ch-ok" : "ch-warn"}`}>{item.resolved ? "Resolved" : "Open"}</span>
                      <span className="label-caps">{formatDate(item.createdAt)}</span>
                    </div>
                    <p className={styles.muted}>Severity {item.severity}</p>
                  </div>
                ))}
                {!studentDetail.transparency?.ownComplaintHistory?.length ? <div className="empty-state">You have not reported issues for this unit yet.</div> : null}
              </div>
            </article>
          </section>
        </>
      ) : null}

      {role === "landlord" && landlordOverview ? (
        <>
          <section className={`${styles.hero} glass fade-up`}>
            <div>
              <p className="label-caps">Landlord view</p>
              <h1 className={styles.heroTitle}>Unit {landlordOverview.id}</h1>
              <div className={styles.heroMeta}>
                <span className={`chip ${statusChip(landlordOverview.status)}`}>{landlordOverview.status}</span>
                <span className={`trust-band-badge ${trustBandClass(currentTrustBand)}`}>{trustBandLabel(currentTrustBand)}</span>
              </div>
            </div>
            <div className={styles.heroStats}>
              <span className="chip ch-blue">Trust {landlordOverview.trustScore}</span>
              {landlordOverview.auditRequired ? <span className="chip ch-err">Audit required</span> : null}
              {landlordOverview.status === "suspended" ? <span className="chip ch-err">Unit suspended</span> : null}
            </div>
          </section>

          <div className={styles.tabBar}>
            {["overview", "occupants", "shortlists", "complaints", "audits"].map((item) => (
              <button key={item} className={tab === item ? styles.tabActive : styles.tab} onClick={() => setTab(item)} type="button">
                {item}
              </button>
            ))}
          </div>

          {tab === "overview" ? (
            <section className={`${styles.grid} fade-up-d1`}>
              <article className="panel">
                <p className="label-caps">Property details</p>
                <div className={styles.infoGrid}>
                  <div className="metric-card"><span className="ml">Rent</span><strong className="mv">£{landlordOverview.propertyDetails?.rent || 0}</strong></div>
                  <div className="metric-card"><span className="ml">Distance</span><strong className="mv">{landlordOverview.propertyDetails?.distanceKm || 0} km</strong></div>
                  <div className="metric-card"><span className="ml">Institution proximity</span><strong className="mv">{landlordOverview.propertyDetails?.institutionProximityKm || 0} km</strong></div>
                  <div className="metric-card"><span className="ml">Capacity</span><strong className="mv">{landlordOverview.capacity || 0}</strong></div>
                  <div className="metric-card"><span className="ml">Occupancy count</span><strong className="mv">{landlordOverview.occupancyCount || 0}</strong></div>
                  <div className="metric-card"><span className="ml">Open audits</span><strong className="mv">{landlordOverview.openAuditLogCount || 0}</strong></div>
                </div>
              </article>

              <article className="panel">
                <p className="label-caps">Structural checklist</p>
                <div className={styles.checklist}>
                  {["fireExit", "wiringSafe", "plumbingSafe", "occupancyCompliant"].map((field) => (
                    <label key={field} className={styles.checkRow}>
                      <span>{field}</span>
                      <input checked={Boolean(structuralForm[field])} onChange={() => toggleFormValue(setStructuralForm, field)} type="checkbox" />
                    </label>
                  ))}
                </div>
                <button className="btn-secondary" onClick={() => saveLandlordChecklist("structural")} type="button">
                  Save structural checklist
                </button>
              </article>

              <article className="panel">
                <p className="label-caps">Operational checklist</p>
                <div className={styles.checklist}>
                  {["bedAvailable", "waterAvailable", "toiletsAvailable", "ventilationGood"].map((field) => (
                    <label key={field} className={styles.checkRow}>
                      <span>{field}</span>
                      <input checked={Boolean(operationalForm[field])} onChange={() => toggleFormValue(setOperationalForm, field)} type="checkbox" />
                    </label>
                  ))}
                </div>
                <label className={styles.field}>
                  <span>Self declaration</span>
                  <textarea className="app-input" onChange={(event) => setOperationalForm((current) => ({ ...current, selfDeclaration: event.target.value }))} value={operationalForm.selfDeclaration || ""} />
                </label>
                <button className="btn-secondary" onClick={() => saveLandlordChecklist("operational")} type="button">
                  Save operational checklist
                </button>
              </article>

              <article className="panel">
                <p className="label-caps">Media</p>
                <div className={styles.uploadGrid}>
                  {requiredMediaTypes.map((type) => (
                    <label key={type} className="panel-light">
                      <span className="chip ch-blue">{type}</span>
                      <input disabled={landlordOverview.status !== "draft"} onChange={(event) => handleMediaUpload(event, type)} type="file" />
                    </label>
                  ))}
                </div>
                <div className={styles.chipRow}>
                  {landlordMediaTypes.map((type) => (
                    <span key={type} className="chip ch-ok">
                      {type}
                    </span>
                  ))}
                </div>
                <button className="btn-primary" disabled={landlordOverview.status !== "draft" || !canSubmitUnit} onClick={handleSubmitUnit} type="button">
                  Submit for review
                </button>
              </article>
            </section>
          ) : null}

          {tab === "occupants" ? (
            <section className={`${styles.grid} fade-up-d1`}>
              <article className="panel">
                <p className="label-caps">Check in</p>
                <div className={styles.inlineForm}>
                  <input className="app-input" onChange={(event) => setCheckInStudentId(event.target.value)} placeholder="Student ID" type="number" value={checkInStudentId} />
                  <button className="btn-primary" onClick={handleCheckIn} type="button">
                    Check in
                  </button>
                </div>
              </article>
              <article className="panel">
                <p className="label-caps">Current occupants</p>
                <div className={styles.timeline}>
                  {(interestedStudents?.students || [])
                    .filter((item) => item.status === "occupant")
                    .map((item) => (
                      <div key={`${item.studentId}-${item.status}`} className="panel-light">
                        <div className={styles.timelineHeader}>
                          <strong>{item.name}</strong>
                          <span className="chip ch-blue">{item.status}</span>
                        </div>
                        <p className={styles.muted}>{item.email || "No email available"}</p>
                        <p className={styles.muted}>Since {formatDate(item.since)}</p>
                      </div>
                    ))}
                  {!interestedStudents?.students?.some((item) => item.status === "occupant") ? <div className="empty-state">No active occupants are currently listed for this unit.</div> : null}
                </div>
              </article>
            </section>
          ) : null}
          {tab === "shortlists" ? (
            <section className="panel fade-up-d1">
              <p className="label-caps">Interested students</p>
              <div className={styles.timeline}>
                {(interestedStudents?.students || []).map((item) => (
                  <div key={`${item.studentId}-${item.status}`} className="panel-light">
                    <div className={styles.timelineHeader}>
                      <strong>{item.name}</strong>
                      <span className={`chip ${item.status === "occupant" ? "ch-blue" : "ch-gold"}`}>{item.status}</span>
                    </div>
                    <p className={styles.muted}>{item.email || "No email available"}</p>
                    <p className={styles.muted}>{item.institutionName || "Institution unavailable"}</p>
                  </div>
                ))}
                {!interestedStudents?.students?.length ? <div className="empty-state">No shortlisted or occupied students are available for this unit.</div> : null}
              </div>
            </section>
          ) : null}

          {tab === "complaints" ? (
            <section className={`${styles.grid} fade-up-d1`}>
              {(landlordComplaints || []).map((complaint) => (
                <article key={complaint.id} className="panel">
                  <div className={styles.timelineHeader}>
                    <span className={`chip ${complaint.severity >= 4 ? "ch-err" : complaint.severity === 3 ? "ch-warn" : "ch-ok"}`}>Severity {complaint.severity}</span>
                    <span className={`chip ${complaint.resolved ? "ch-ok" : "ch-warn"}`}>{complaint.resolved ? "Resolved" : "Open"}</span>
                  </div>
                  <p className={styles.muted}>{complaint.incidentType || "other"}</p>
                  <p className={styles.muted}>
                    {complaint.student?.name || "Student"} • {complaint.student?.email || "No email"}
                  </p>
                  <p className={styles.muted}>Created {formatDate(complaint.createdAt)}</p>
                  {!complaint.resolved ? <ComplaintForm complaintId={complaint.id} /> : null}
                </article>
              ))}
              {!landlordComplaints?.length ? <div className="empty-state">No complaints have been submitted for this unit.</div> : null}
            </section>
          ) : null}

          {tab === "audits" ? (
            <section className="panel fade-up-d1">
              <p className="label-caps">Audit timeline</p>
              <div className={styles.timeline}>
                {(landlordAudits || []).map((item) => (
                  <div key={item.id} className="panel-light">
                    <div className={styles.timelineHeader}>
                      <span className="chip ch-err">{item.triggerType}</span>
                      <span className={`chip ${item.resolved ? "ch-ok" : "ch-warn"}`}>{item.resolved ? "Resolved" : "Open"}</span>
                    </div>
                    <p className={styles.muted}>{item.reason}</p>
                    <p className={styles.muted}>{item.correctiveAction || "No corrective action set."}</p>
                    <p className={styles.muted}>Created {formatDate(item.createdAt)}</p>
                  </div>
                ))}
                {!landlordAudits?.length ? <div className="empty-state">No audit logs are currently associated with this unit.</div> : null}
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {role === "admin" && adminDetail ? (
        <>
          <section className={`${styles.hero} glass fade-up`}>
            <div>
              <p className="label-caps">Admin view</p>
              <h1 className={styles.heroTitle}>Unit {adminDetail.unitId}</h1>
              <div className={styles.heroMeta}>
                <span className={`chip ${statusChip(adminDetail.governanceCore?.status)}`}>{adminDetail.governanceCore?.status}</span>
                <span className={`trust-band-badge ${trustBandClass(adminDetail.governanceCore?.trustBand)}`}>{trustBandLabel(adminDetail.governanceCore?.trustBand)}</span>
              </div>
            </div>
            <div className={styles.heroStats}>
              <span className="chip ch-blue">Trust {adminDetail.governanceCore?.trustScore || 0}</span>
              {adminDetail.governanceCore?.auditRequired ? <span className="chip ch-err">Audit required</span> : null}
            </div>
          </section>

          <div className={styles.tabBar}>
            {["governance", "evidence", "checklist", "audit", "demand"].map((item) => (
              <button key={item} className={tab === item ? styles.tabActive : styles.tab} onClick={() => setTab(item)} type="button">
                {item}
              </button>
            ))}
          </div>

          {tab === "governance" ? (
            <section className={`${styles.grid} fade-up-d1`}>
              <article className="panel">
                <p className="label-caps">Governance core</p>
                <div className={styles.infoGrid}>
                  <div className="metric-card"><span className="ml">Status</span><strong className="mv">{adminDetail.governanceCore?.status}</strong></div>
                  <div className="metric-card"><span className="ml">Trust score</span><strong className="mv">{adminDetail.governanceCore?.trustScore || 0}</strong></div>
                  <div className="metric-card"><span className="ml">Structural approved</span><strong className="mv">{adminDetail.governanceCore?.structuralApproved ? "Yes" : "No"}</strong></div>
                  <div className="metric-card"><span className="ml">Operational approved</span><strong className="mv">{adminDetail.governanceCore?.operationalBaselineApproved ? "Yes" : "No"}</strong></div>
                </div>
                <div className={styles.buttonRow}>
                  <button className="btn-soft mint" onClick={() => handleAdminStatus("approved")} type="button">Approve</button>
                  <button className="btn-soft red" onClick={() => handleAdminStatus("rejected")} type="button">Reject</button>
                  <button className="btn-soft gold" onClick={() => handleAdminStatus("suspended")} type="button">Suspend</button>
                  <button className="btn-secondary" onClick={() => handleAdminStatus("archived")} type="button">Archive</button>
                </div>
              </article>

              <article className="panel">
                <p className="label-caps">Self-declaration penalty</p>
                <label className={styles.field}>
                  <span>Reason</span>
                  <textarea className="app-input" onChange={(event) => setPenaltyForm((current) => ({ ...current, reason: event.target.value }))} value={penaltyForm.reason} />
                </label>
                <label className={styles.field}>
                  <span>Penalty points</span>
                  <input className="app-input" min="1" onChange={(event) => setPenaltyForm((current) => ({ ...current, penaltyPoints: event.target.value }))} type="number" value={penaltyForm.penaltyPoints} />
                </label>
                <button className="btn-soft red" onClick={handlePenalty} type="button">
                  Apply penalty
                </button>
              </article>

              <article className="panel">
                <p className="label-caps">Manual audit</p>
                <label className={styles.field}>
                  <span>Reason</span>
                  <textarea className="app-input" onChange={(event) => setAuditReason(event.target.value)} value={auditReason} />
                </label>
                <button className="btn-secondary" onClick={handleTriggerAudit} type="button">
                  Trigger audit
                </button>
              </article>
            </section>
          ) : null}

          {tab === "evidence" ? (
            <section className="panel fade-up-d1">
              <p className="label-caps">Evidence</p>
              <div className={styles.chipRow}>
                {(adminDetail.evidence?.media || []).map((media) => (
                  <span key={media.id} className="chip ch-blue">
                    {media.type}
                  </span>
                ))}
              </div>
              <div className={styles.timeline}>
                {(adminDetail.evidence?.media || []).map((media) => (
                  <div key={media.id} className="panel-light">
                    <div className={styles.timelineHeader}>
                      <span className="chip ch-blue">{media.type}</span>
                      <span className={`chip ${media.locked ? "ch-warn" : "ch-ok"}`}>{media.locked ? "Locked" : "Open"}</span>
                    </div>
                    <p className={styles.muted}>{media.publicUrl || "Media stored in backend"}</p>
                    <p className={styles.muted}>{formatDate(media.createdAt)}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "checklist" ? (
            <section className={`${styles.grid} fade-up-d1`}>
              <article className="panel">
                <p className="label-caps">Structural checklist</p>
                <div className={styles.checklist}>
                  {["fireExit", "wiringSafe", "plumbingSafe", "occupancyCompliant"].map((field) => (
                    <label key={field} className={styles.checkRow}>
                      <span>{field}</span>
                      <input checked={Boolean(structuralForm[field])} onChange={() => toggleFormValue(setStructuralForm, field)} type="checkbox" />
                    </label>
                  ))}
                </div>
                <button className="btn-secondary" onClick={() => saveAdminChecklist("structural")} type="button">
                  Save structural review
                </button>
              </article>

              <article className="panel">
                <p className="label-caps">Operational checklist</p>
                <div className={styles.checklist}>
                  {["bedAvailable", "waterAvailable", "toiletsAvailable", "ventilationGood"].map((field) => (
                    <label key={field} className={styles.checkRow}>
                      <span>{field}</span>
                      <input checked={Boolean(operationalForm[field])} onChange={() => toggleFormValue(setOperationalForm, field)} type="checkbox" />
                    </label>
                  ))}
                </div>
                <label className={styles.field}>
                  <span>Self declaration</span>
                  <textarea className="app-input" onChange={(event) => setOperationalForm((current) => ({ ...current, selfDeclaration: event.target.value }))} value={operationalForm.selfDeclaration || ""} />
                </label>
                <button className="btn-secondary" onClick={() => saveAdminChecklist("operational")} type="button">
                  Save operational review
                </button>
              </article>
            </section>
          ) : null}

          {tab === "audit" ? (
            <section className="panel fade-up-d1">
              <p className="label-caps">Audit logs</p>
              <div className={styles.timeline}>
                {(adminAuditLogs || []).map((item) => (
                  <div key={item.id} className="panel-light">
                    <div className={styles.timelineHeader}>
                      <span className="chip ch-err">{item.triggerType}</span>
                      <span className={`chip ${item.resolved ? "ch-ok" : "ch-warn"}`}>{item.resolved ? "Resolved" : "Open"}</span>
                    </div>
                    <p className={styles.muted}>{item.reason}</p>
                    <p className={styles.muted}>{item.correctiveAction || "No corrective action recorded."}</p>
                    <p className={styles.muted}>{item.correctiveDeadline ? `Due ${formatDate(item.correctiveDeadline)}` : "No corrective deadline set."}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {tab === "demand" ? (
            <section className={`${styles.grid} fade-up-d1`}>
              <article className="panel">
                <p className="label-caps">Demand context</p>
                <div className={styles.infoGrid}>
                  <div className="metric-card"><span className="ml">Shortlists</span><strong className="mv">{adminDetail.demandContext?.shortlistCount || 0}</strong></div>
                  <div className="metric-card"><span className="ml">Unique shortlisted</span><strong className="mv">{adminDetail.demandContext?.uniqueShortlistedStudents || 0}</strong></div>
                  <div className="metric-card"><span className="ml">Active occupancy</span><strong className="mv">{adminDetail.demandContext?.activeOccupancyCount || 0}</strong></div>
                  <div className="metric-card"><span className="ml">Conversion rate</span><strong className="mv">{adminDetail.demandContext?.conversionRate || 0}%</strong></div>
                </div>
              </article>
              <article className="panel">
                <p className="label-caps">Corridor demand</p>
                <div className={styles.timeline}>
                  {(adminDemand?.byInstitution || []).map((item) => (
                    <div key={item.institutionId} className="panel-light">
                      <div className={styles.timelineHeader}>
                        <strong>{item.institutionName}</strong>
                        <span className="chip ch-blue">{item.count}</span>
                      </div>
                    </div>
                  ))}
                  {!adminDemand?.byInstitution?.length ? <div className="empty-state">No institution demand data is available for this corridor.</div> : null}
                </div>
              </article>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
