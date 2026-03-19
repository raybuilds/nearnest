"use client";

import Link from "next/link";
import { useState } from "react";
import { shortlistUnit } from "@/lib/api";
import styles from "./UnitCard.module.css";

function getStatusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved" || normalized === "live" || normalized === "occupied") return "ch-ok";
  if (normalized === "pending" || normalized === "submitted" || normalized === "draft") return "ch-warn";
  if (normalized === "suspended" || normalized === "rejected") return "ch-err";
  return "ch-blue";
}

function getTrustBandLabel(trustBand) {
  if (trustBand === "priority") return "Priority";
  if (trustBand === "standard") return "Standard";
  return "Hidden";
}

function getTrustBandClass(trustBand) {
  if (trustBand === "priority") return "band-priority";
  if (trustBand === "standard") return "band-standard";
  return "band-hidden";
}

export default function UnitCard(props) {
  const unit = props.unit || props;
  const unitId = unit.unitId || unit.id;
  const status = unit.status || "unknown";
  const trustScore = Number(unit.trustScore ?? 0);
  const trustBand = unit.trustBand || (trustScore >= 80 ? "priority" : trustScore >= 50 ? "standard" : "hidden");
  const visibleToStudents = unit.visibleToStudents !== false;
  const [shortlistState, setShortlistState] = useState({ loading: false, success: "", error: "" });

  const name = unit.name || `Unit ${unitId}`;
  const occupancyType = unit.occupancyType || unit.bhkType || "Unit";
  const address = unit.address || `${Number(unit.distanceKm ?? 0).toFixed(1)} km away`;
  const rent = Number(unit.rent ?? 0);
  const activeComplaints = Number(unit.activeComplaints ?? unit.openIssues ?? 0);
  const openAuditLogCount = Number(unit.openAuditLogCount ?? 0);
  const availableSlots = Number(unit.availableSlots ?? 0);
  const capacity = Number(unit.capacity ?? 0);
  const mediaCount = Number(unit.mediaCount ?? 0);
  const shortlistedCount = Number(unit.shortlistedCount ?? 0);

  async function handleShortlist(event) {
    event.preventDefault();
    event.stopPropagation();

    if (!unitId) return;

    setShortlistState({ loading: true, success: "", error: "" });
    try {
      await shortlistUnit({ unitId: Number(unitId) });
      setShortlistState({ loading: false, success: "Shortlisted successfully.", error: "" });
      props.onShortlist?.();
    } catch (error) {
      setShortlistState({ loading: false, success: "", error: error.message || "Shortlist failed" });
    }
  }

  if (props.showForStudent && !visibleToStudents) {
    return null;
  }

  return (
    <Link className={`${styles.card} glass`} href={`/unit/${unitId}`} prefetch={false}>
      <div className={styles.thumbnail}>
        <div className={styles.houseIcon}>
          <svg fill="none" height="20" viewBox="0 0 24 24" width="20">
            <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="rgba(108,142,245,0.72)" strokeWidth="1.5" />
          </svg>
        </div>
        <span className={`chip ${styles.statusChip} ${getStatusTone(status)}`}>{status}</span>
        <span className={`chip ch-blue ${styles.typeChip}`}>{occupancyType}</span>
        {unit.auditRequired ? <span className={`chip ch-err ${styles.auditChip}`}>Audit</span> : null}
      </div>

      <div className={styles.body}>
        <div className={styles.headingRow}>
          <div>
            <p className="label-caps">Unit {unitId}</p>
            <h3 className={styles.title}>{name}</h3>
          </div>
          <div className={styles.priceBlock}>
            <strong>{`£${rent}/mo`}</strong>
            <span>{address}</span>
          </div>
        </div>

        <div className={styles.metaRow}>
          <span className="chip ch-purple">{`${Number(unit.distanceKm ?? 0).toFixed(1)} km away`}</span>
          {unit.ac ? <span className="chip ch-blue">AC included</span> : null}
        </div>

        <div className={styles.trustSection}>
          <div className={styles.trustRow}>
            <span className="label-caps">Trust</span>
            <strong
              className={styles.trustValue}
              style={{
                color:
                  trustBand === "priority"
                    ? "var(--accent-mint)"
                    : trustBand === "standard"
                      ? "var(--accent-gold)"
                      : "var(--color-error)",
              }}
            >
              {trustScore}
            </strong>
          </div>
          <div className="trust-bar-track">
            <div className={`trust-bar-fill ${trustBand}`} style={{ width: `${trustScore}%` }} />
          </div>
          <span className={`trust-band-badge ${getTrustBandClass(trustBand)}`}>{getTrustBandLabel(trustBand)}</span>
        </div>

        <div className={styles.signalRow}>
          {activeComplaints > 0 ? <span className="chip ch-warn">{`${activeComplaints} open complaints`}</span> : null}
          {openAuditLogCount > 0 ? <span className="chip ch-err">{`${openAuditLogCount} audits`}</span> : null}
        </div>

        {props.showDetails ? (
          <>
            <div className={styles.metricGrid}>
              <div className="metric-card">
                <p className="label-caps">Capacity</p>
                <strong>{capacity}</strong>
              </div>
              <div className="metric-card">
                <p className="label-caps">Available</p>
                <strong>{availableSlots}</strong>
              </div>
              <div className="metric-card">
                <p className="label-caps">Media</p>
                <strong>{mediaCount}</strong>
              </div>
              <div className="metric-card">
                <p className="label-caps">Shortlists</p>
                <strong>{shortlistedCount}</strong>
              </div>
            </div>

            <div className={styles.amenities}>
              {unit.ac ? <span className="chip ch-blue">AC</span> : null}
              {unit.bedAvailable ? <span className="chip ch-ok">Bed</span> : null}
              {unit.waterAvailable ? <span className="chip ch-ok">Water</span> : null}
              {Number(unit.toiletsAvailable ?? 0) > 0 ? <span className="chip ch-ok">{`${unit.toiletsAvailable} toilets`}</span> : null}
              {unit.ventilationGood ? <span className="chip ch-ok">Ventilated</span> : null}
            </div>
          </>
        ) : null}

        {props.showForStudent ? (
          <div className={styles.studentActions}>
            <button className="btn-soft mint" disabled={shortlistState.loading} onClick={handleShortlist} type="button">
              {shortlistState.loading ? "Shortlisting..." : "Shortlist"}
            </button>
            {shortlistState.success ? <div className="status-banner success">{shortlistState.success}</div> : null}
            {shortlistState.error ? <div className="status-banner error">{shortlistState.error}</div> : null}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
