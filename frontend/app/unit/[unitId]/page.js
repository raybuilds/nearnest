"use client";

import { useEffect, useState } from "react";
import {
  getAdminUnitDetail,
  getLandlordAuditLogs,
  getLandlordComplaints,
  getLandlordOverview,
  getStudentUnitDetail,
} from "@/lib/api";
import styles from "./page.module.css";

export default function UnitDetailPage({ params }) {
  const [unit, setUnit] = useState(null);
  const [complaints, setComplaints] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadUnit() {
      try {
        const role = localStorage.getItem("role");
        if (role === "student") {
          const payload = await getStudentUnitDetail(params.unitId);
          if (!active) return;
          setUnit({
            unitId: params.unitId,
            name: `Unit ${params.unitId}`,
            address: `${payload?.discovery?.distanceKm ?? 0} km away`,
            status: payload?.trustSignals?.trustBand || "standard",
            floor: payload?.availability?.occupancyCount ?? 0,
            bhkType: payload?.discovery?.occupancyType || "Unit",
            occupantName: payload?.availability?.availableSlots ?? 0,
            area: `${payload?.availability?.capacity ?? 0} capacity`,
            imageLabel: `${payload?.discovery?.rent ?? 0} monthly rent`,
            healthScore: payload?.trustSignals?.trustScore ?? 0,
          });
          setComplaints([]);
          return;
        }

        if (role === "admin") {
          const payload = await getAdminUnitDetail(params.unitId);
          if (!active) return;
          setUnit({
            unitId: params.unitId,
            name: `Unit ${params.unitId}`,
            address: payload?.evidence?.corridor?.name || "Governance view",
            status: payload?.governanceCore?.status || "unknown",
            floor: payload?.demandContext?.activeOccupancyCount ?? 0,
            bhkType: payload?.evidence?.operationalChecklist?.selfDeclaration || "Unit",
            occupantName: payload?.behavioralHistory?.slaMetrics?.unresolvedComplaints ?? 0,
            area: `${payload?.demandContext?.shortlistCount ?? 0} shortlists`,
            imageLabel: `${payload?.governanceCore?.trustBand || "standard"} trust band`,
            healthScore: payload?.governanceCore?.trustScore ?? 0,
          });
          setComplaints(
            Array.isArray(payload?.behavioralHistory?.complaintTimeline)
              ? payload.behavioralHistory.complaintTimeline.map((complaint) => ({
                  id: complaint.id,
                  createdAt: complaint.createdAt,
                  summary: complaint.incidentType || complaint.severity,
                }))
              : []
          );
          return;
        }

        const [overview, complaintPayload, auditLogs] = await Promise.all([
          getLandlordOverview(params.unitId),
          getLandlordComplaints(params.unitId),
          getLandlordAuditLogs(params.unitId).catch(() => ({ logs: [] })),
        ]);

        if (!active) return;
        setUnit({
          unitId: params.unitId,
          name: `Unit ${params.unitId}`,
          address: overview?.corridor?.name || "Landlord view",
          status: overview?.status || "unknown",
          floor: overview?.occupancyCount ?? 0,
          bhkType: overview?.propertyDetails?.occupancyType || "Unit",
          occupantName: overview?.activeComplaints ?? complaintPayload?.activeComplaints ?? 0,
          area: `${auditLogs?.openLogs ?? 0} open audits`,
          imageLabel: `${overview?.propertyDetails?.rent ?? 0} monthly rent`,
          healthScore: overview?.trustScore ?? 0,
        });
        setComplaints(
          Array.isArray(complaintPayload?.complaints)
            ? complaintPayload.complaints.map((complaint) => ({
                id: complaint.id,
                createdAt: complaint.createdAt,
                summary: complaint.incidentType || complaint.severity,
              }))
            : []
        );
      } catch {
        if (active) {
          setUnit(null);
          setComplaints([]);
        }
      }
    }

    loadUnit();
    return () => {
      active = false;
    };
  }, [params.unitId]);

  if (!unit) {
    return null;
  }

  return (
    <div className={`pageShell ${styles.page}`}>
      <section className={styles.hero}>
        <div className={styles.photoCard}>
          <div className={styles.photoPlaceholder}>{unit.imageLabel}</div>
        </div>
        <div className={styles.metaCard}>
          <span className="chip">{unit.status}</span>
          <h1 className="pageTitle">{unit.name}</h1>
          <p className="pageSubtitle">{unit.address}</p>
          <div className={styles.metaGrid}>
            <div><span>Floor</span><strong>{unit.floor}</strong></div>
            <div><span>BHK</span><strong>{unit.bhkType}</strong></div>
            <div><span>Occupant</span><strong>{unit.occupantName}</strong></div>
            <div><span>Area</span><strong>{unit.area}</strong></div>
          </div>
        </div>
      </section>

      <section className={styles.contentGrid}>
        <article className={styles.gaugeCard}>
          <p className={styles.cardLabel}>Health score</p>
          <div className={styles.gauge} style={{ "--score": `${unit.healthScore}%` }}>
            <span>{unit.healthScore}</span>
          </div>
          <p className={styles.cardText}>Dawn sees this residence as operationally stable with room for preventive optimization.</p>
        </article>

        <article className={styles.timelineCard}>
          <p className={styles.cardLabel}>Complaint history</p>
          <div className={styles.timeline}>
            {complaints.map((complaint) => (
              <div key={complaint.id} className={styles.timelineItem}>
                <strong>{complaint.createdAt}</strong>
                <span>{complaint.summary}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
