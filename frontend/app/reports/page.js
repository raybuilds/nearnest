import { reportsSnapshot, riskForecastByBlock } from "@/lib/mockData";
import styles from "./page.module.css";

export default function ReportsPage() {
  return (
    <div className={`pageShell ${styles.page}`}>
      <div>
        <h1 className="pageTitle">Reports & intelligence briefs</h1>
        <p className="pageSubtitle">Portfolio snapshots and export-ready operating metrics prepared for leadership review.</p>
      </div>

      <section className={styles.snapshotGrid}>
        {reportsSnapshot.map((item) => (
          <article key={item.title} className={styles.snapshotCard}>
            <p>{item.title}</p>
            <strong>{item.value}</strong>
            <span>{item.note}</span>
          </article>
        ))}
      </section>

      <article className={styles.forecastCard}>
        <div className="sectionHeader">
          <div>
            <h2>Risk outlook</h2>
            <p className="mutedText">High-level block performance prepared for board-ready summaries.</p>
          </div>
          <button className="secondaryButton" type="button">
            Export PDF
          </button>
        </div>
        <div className={styles.chart}>
          {riskForecastByBlock.map((block) => (
            <div key={block.block} className={styles.barGroup}>
              <div className={styles.track}>
                <div className={styles.fill} style={{ width: `${block.risk}%` }} />
              </div>
              <span>{block.block}</span>
              <strong>{block.risk}%</strong>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
