import Link from "next/link";
import styles from "./UnitCard.module.css";

function toneForStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved" || normalized === "occupied") return styles.statusSuccess;
  if (normalized === "vacant" || normalized === "draft") return styles.statusNeutral;
  return styles.statusWarning;
}

export default function UnitCard(props) {
  const unitId = props.unitId || props.id;
  const name = props.name || `Unit ${unitId}`;
  const address = props.address || `${props.distanceKm ?? 0} km away`;
  const status = props.status;
  const bhkType = props.bhkType || props.occupancyType || "Unit";
  const openIssues = props.openIssues ?? props.activeComplaints ?? 0;

  return (
    <Link className={styles.card} href={`/unit/${unitId}`}>
      <div className={styles.media}>
        <div className={styles.blueprint}>
          <span className={styles.blueprintLine} />
          <span className={styles.blueprintLineShort} />
          <span className={styles.blueprintSquare} />
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.topRow}>
          <div>
            <p className={styles.eyebrow}>Unit {unitId}</p>
            <h3 className={styles.title}>{name}</h3>
          </div>
          <span className={`${styles.statusChip} ${toneForStatus(status)}`}>{status}</span>
        </div>

        <p className={styles.address}>{address}</p>

        <div className={styles.footer}>
          <span className={styles.meta}>{bhkType}</span>
          <span className={styles.issueBadge}>{openIssues} open issues</span>
        </div>
      </div>
    </Link>
  );
}
