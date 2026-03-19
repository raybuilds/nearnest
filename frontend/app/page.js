"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./page.module.css";

const dashboardStats = [
  { label: "Trust visibility", value: 50, suffix: "+", delta: "Minimum score for student visibility" },
  { label: "Complaint SLA", value: 48, suffix: "h", delta: "Deadline tracked on every complaint" },
  { label: "Audit triggers", value: 3, suffix: "", delta: "Capacity, trust, and complaint governance" },
  { label: "User roles", value: 3, suffix: "", delta: "Student, landlord, and admin workflows" },
];

const featureCards = [
  {
    title: "Predictive Portfolio Intelligence",
    body: "Spot risk signals, complaint surges, and operational blind spots before residents feel the impact.",
  },
  {
    title: "Editorial-Grade Operations Oversight",
    body: "Luxury dashboards, granular workflows, and beautifully clear remediation priorities for every team.",
  },
  {
    title: "Dawn AI Embedded Everywhere",
    body: "From intake drafting to risk briefings, Dawn turns raw property signals into action-ready guidance.",
  },
];

export default function HomePage() {
  const [counts, setCounts] = useState(dashboardStats.map(() => 0));

  useEffect(() => {
    const duration = 1200;
    const start = performance.now();
    let frameId = 0;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      setCounts(dashboardStats.map((item) => Math.round(item.value * progress)));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div className={`pageShell ${styles.page}`}>
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <span className="chip">Dawn Property OS</span>
          <h1 className="pageTitle">Intelligent property management, powered by Dawn AI</h1>
          <p className="pageSubtitle">
            A full operational command center for landlords, administrators, and resident-facing teams with risk visibility,
            complaint orchestration, and editorial-grade portfolio oversight.
          </p>
          <div className={styles.actions}>
            <Link className="primaryButton" href="/dashboard">
              Enter Dashboard
            </Link>
            <Link className="secondaryButton" href="/register">
              Create Account
            </Link>
          </div>
        </div>

        <div className={styles.heroPanel}>
          <div className={styles.panelHeader}>
            <p>Dawn Live Overview</p>
            <span className={styles.livePill}>Updated just now</span>
          </div>
          <div className={styles.signalRow}>
            <div>
              <strong>Garden Block</strong>
              <span>Highest risk trajectory</span>
            </div>
            <b>81%</b>
          </div>
          <div className={styles.signalRow}>
            <div>
              <strong>Avg SLA Response</strong>
              <span>Holding below target</span>
            </div>
            <b>6.2h</b>
          </div>
          <div className={styles.signalRow}>
            <div>
              <strong>Occupancy Health</strong>
              <span>Portfolio confidence</span>
            </div>
            <b>93%</b>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        {featureCards.map((feature, index) => (
          <article key={feature.title} className={styles.featureCard} style={{ animationDelay: `${0.12 * index}s` }}>
            <h2>{feature.title}</h2>
            <p>{feature.body}</p>
          </article>
        ))}
      </section>

      <section className={styles.stats}>
        {dashboardStats.map((item, index) => (
          <article key={item.label} className={styles.statCard} style={{ animationDelay: `${0.18 * index}s` }}>
            <p>{item.label}</p>
            <strong>
              {counts[index]}
              {item.suffix}
            </strong>
            <span>{item.delta}</span>
          </article>
        ))}
      </section>
    </div>
  );
}
