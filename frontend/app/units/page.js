import UnitCard from "@/components/UnitCard";
import { mockUnits } from "@/lib/mockData";
import styles from "./page.module.css";

export default function UnitsPage() {
  return (
    <div className={`pageShell ${styles.page}`}>
      <div>
        <h1 className="pageTitle">Units portfolio</h1>
        <p className="pageSubtitle">Browse your inventory with live status, BHK type, and open operational issues.</p>
      </div>

      <section className={styles.grid}>
        {mockUnits.map((unit) => (
          <UnitCard key={unit.unitId} {...unit} />
        ))}
      </section>
    </div>
  );
}
