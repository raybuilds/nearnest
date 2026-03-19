import { getUnitById } from "@/lib/mockData";
import styles from "./page.module.css";

export default function LandlordUnitPage({ params }) {
  const unit = getUnitById(params.unitId);

  return (
    <div className={`pageShell ${styles.page}`}>
      <div>
        <span className="chip">Landlord Scope</span>
        <h1 className="pageTitle">{unit.name}</h1>
        <p className="pageSubtitle">A Dawn-led review of remediation priorities, tenant contact context, and maintenance history.</p>
      </div>

      <section className={styles.grid}>
        <article className={styles.card}>
          <p className={styles.kicker}>Dawn risk assessment</p>
          <h2>Elevated watch status</h2>
          <ul>
            <li>Multiple unresolved issues affecting resident confidence.</li>
            <li>Complaint concentration increased in the last seven days.</li>
            <li>Trust score needs stabilization through faster response handling.</li>
          </ul>
        </article>

        <article className={styles.card}>
          <p className={styles.kicker}>Remediation priorities</p>
          <ol>
            <li>Assign senior plumbing vendor within 2 hours.</li>
            <li>Update resident with ETA and resolution plan.</li>
            <li>Inspect adjacent stack for repeat incident exposure.</li>
          </ol>
        </article>

        <article className={styles.card}>
          <p className={styles.kicker}>Tenant contact</p>
          <div className={styles.contactCard}>
            <strong>{unit.occupantName}</strong>
            <span>{unit.occupantPhone}</span>
            <span>{unit.occupantEmail}</span>
          </div>
        </article>

        <article className={styles.card}>
          <p className={styles.kicker}>Maintenance history</p>
          <div className={styles.history}>
            {unit.maintenanceHistory.map((item) => (
              <div key={`${item.date}-${item.event}`} className={styles.historyItem}>
                <strong>{item.date}</strong>
                <span>{item.event}</span>
                <em>{item.status}</em>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
