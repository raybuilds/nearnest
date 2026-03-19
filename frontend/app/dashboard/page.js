"use client";

import { useMemo } from "react";
import { dashboardStats, mockComplaints, proactiveInsights, riskForecastByBlock } from "@/lib/mockData";
import styles from "./page.module.css";

export default function DashboardPage() {
  const recentComplaints = useMemo(() => mockComplaints.slice(0, 4), []);

  return (
    <div className={`pageShell ${styles.page}`}>
      <div className={styles.header}>
        <div>
          <span className="chip">Landlord / Admin Console</span>
          <h1 className="pageTitle">Property performance at a glance</h1>
          <p className="pageSubtitle">Monitor operational health, risk exposure, and complaint throughput across the portfolio.</p>
        </div>
      </div>

      <section className={styles.statsGrid}>
        {dashboardStats.map((item) => (
          <article key={item.label} className={styles.statCard}>
            <p>{item.label}</p>
            <strong>
              {item.value}
              {item.suffix}
            </strong>
            <span>{item.delta}</span>
          </article>
        ))}
      </section>

      <section className={styles.mainGrid}>
        <article className={styles.chartCard}>
          <div className="sectionHeader">
            <div>
              <h2>Risk forecast by block</h2>
              <p className="mutedText">Projected heat map based on complaints, occupancy, and Dawn intelligence.</p>
            </div>
          </div>
          <div className={styles.chart}>
            {riskForecastByBlock.map((item) => (
              <div key={item.block} className={styles.barCard}>
                <div className={styles.barTrack}>
                  <div className={styles.bar} style={{ height: `${item.risk}%` }} />
                </div>
                <strong>{item.risk}%</strong>
                <span>{item.block}</span>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.tableCard}>
          <div className="sectionHeader">
            <div>
              <h2>Recent complaints</h2>
              <p className="mutedText">High-signal incidents requiring immediate visibility.</p>
            </div>
          </div>
          <div className="tableShell">
            <table className="luxuryTable">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Unit</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {recentComplaints.map((complaint) => (
                  <tr key={complaint.id}>
                    <td>{complaint.id}</td>
                    <td>{complaint.unitId}</td>
                    <td>{complaint.category}</td>
                    <td>{complaint.status}</td>
                    <td>{complaint.priority}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className={styles.insightGrid}>
        {proactiveInsights.map((insight, index) => (
          <article key={insight.title} className={styles.insightCard} style={{ animationDelay: `${0.1 * index}s` }}>
            <div className={styles.insightGlow} />
            <p className={styles.insightType}>{insight.type.replaceAll("_", " ")}</p>
            <h3>{insight.title}</h3>
            {insight.body && <p>{insight.body}</p>}
            {insight.summary && <p>{insight.summary}</p>}
            {insight.score ? <strong className={styles.score}>{insight.score}</strong> : null}
            {insight.recommendation ? <span>{insight.recommendation}</span> : null}
            {insight.recommendations ? (
              <ul>
                {insight.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
