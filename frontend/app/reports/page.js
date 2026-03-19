import styles from "./page.module.css";

const reportsSnapshot = [
  { title: "Governance visibility", value: "Real-time", note: "Metrics are now sourced from backend governance APIs" },
  { title: "Complaint lifecycle", value: "SLA tracked", note: "Open, late, and breached states are available in live data" },
  { title: "Trust bands", value: "3 bands", note: "Priority, standard, and hidden are enforced consistently" },
];

const riskForecastByBlock = [
  { block: "Trust", risk: 80 },
  { block: "SLA", risk: 64 },
  { block: "Audit", risk: 52 },
  { block: "Demand", risk: 71 },
];

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
