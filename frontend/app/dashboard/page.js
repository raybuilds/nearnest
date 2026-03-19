"use client";

import { useEffect, useMemo, useState } from "react";
import { getComplaints, getCorridors, getCorridorOverview, getDawnInsights, getLandlordUnits } from "@/lib/api";
import styles from "./page.module.css";

export default function DashboardPage() {
  const [stats, setStats] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [insights, setInsights] = useState([]);
  const [forecast, setForecast] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const role = localStorage.getItem("role");
        const [complaintPayload, dawnPayload] = await Promise.all([
          getComplaints(),
          getDawnInsights().catch(() => null),
        ]);

        const complaintList = Array.isArray(complaintPayload?.complaints) ? complaintPayload.complaints : [];
        const mappedComplaints = complaintList.map((complaint) => ({
          id: complaint.id,
          unitId: complaint.unitId,
          category: complaint.incidentType || "other",
          status: complaint.slaStatus || (complaint.resolved ? "resolved" : "open"),
          priority: complaint.severity >= 4 ? "High" : complaint.severity === 3 ? "Medium" : "Low",
        }));

        let nextStats = [];
        let nextForecast = [];

        if (role === "landlord") {
          const units = await getLandlordUnits().catch(() => []);
          const safeUnits = Array.isArray(units) ? units : [];
          nextStats = [
            { label: "Total Units", value: safeUnits.length, suffix: "", delta: "Portfolio inventory" },
            { label: "Open Complaints", value: complaintPayload?.metrics?.openComplaints || 0, suffix: "", delta: "Across your units" },
            {
              label: "Occupancy",
              value: safeUnits.reduce((sum, unit) => sum + Number(unit.occupancyCount || 0), 0),
              suffix: "",
              delta: "Current active occupants",
            },
            {
              label: "At-Risk Units",
              value: safeUnits.filter((unit) => unit.auditRequired || Number(unit.trustScore || 0) < 60).length,
              suffix: "",
              delta: "Need attention",
            },
          ];
          nextForecast = safeUnits.slice(0, 5).map((unit) => ({
            block: `Unit ${unit.id}`,
            risk: Math.max(0, Math.min(100, 100 - Number(unit.trustScore || 0))),
          }));
        } else {
          const corridors = await getCorridors().catch(() => []);
          const firstCorridors = Array.isArray(corridors) ? corridors.slice(0, 5) : [];
          const overviews = await Promise.all(firstCorridors.map((corridor) => getCorridorOverview(corridor.id).catch(() => null)));
          nextStats = [
            { label: "Corridors", value: firstCorridors.length, suffix: "", delta: "Visible governance areas" },
            { label: "Open Complaints", value: complaintPayload?.metrics?.openComplaints || 0, suffix: "", delta: "Current workload" },
            { label: "Late Or Breached", value: complaintPayload?.metrics?.lateOrBreached || 0, suffix: "", delta: "SLA pressure" },
            {
              label: "Audits Open",
              value: overviews.reduce((sum, overview) => sum + Number(overview?.riskSummary?.unitsNearSuspension || 0), 0),
              suffix: "",
              delta: "Corridor watchlist",
            },
          ];
          nextForecast = overviews
            .filter(Boolean)
            .map((overview) => ({
              block: overview.corridor?.name || `Corridor ${overview?.corridor?.id || ""}`.trim(),
              risk: Math.max(0, Math.min(100, Math.round(Number(overview.riskSummary?.complaintDensity || 0) * 20))),
            }));
        }

        if (!active) return;
        setComplaints(mappedComplaints);
        setStats(nextStats);
        setForecast(nextForecast);
        setInsights(Array.isArray(dawnPayload?.insights) ? dawnPayload.insights : []);
      } catch {
        if (!active) return;
        setComplaints([]);
        setStats([]);
        setForecast([]);
        setInsights([]);
      }
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  const recentComplaints = useMemo(() => complaints.slice(0, 4), [complaints]);

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
        {stats.map((item) => (
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
            {forecast.map((item) => (
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
        {insights.map((insight, index) => (
          <article key={`${insight.type}-${index}`} className={styles.insightCard} style={{ animationDelay: `${0.1 * index}s` }}>
            <div className={styles.insightGlow} />
            <p className={styles.insightType}>{String(insight.type || "insight").replaceAll("_", " ")}</p>
            <h3>{insight.title || "Operational insight"}</h3>
            {insight.body && <p>{insight.body}</p>}
            {insight.message && <p>{insight.message}</p>}
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
