import { getComplaintsByUnit, getUnitById } from "@/lib/mockData";
import styles from "./page.module.css";

export default function UnitDetailPage({ params }) {
  const unit = getUnitById(params.unitId);
  const complaints = getComplaintsByUnit(unit.unitId);

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
