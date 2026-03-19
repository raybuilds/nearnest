"use client";

import { useEffect, useState } from "react";
import UnitCard from "@/components/UnitCard";
import { getLandlordUnits, getProfile, getUnits } from "@/lib/api";
import styles from "./page.module.css";

export default function UnitsPage() {
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadUnits() {
      setLoading(true);
      setError("");
      try {
        const role = localStorage.getItem("role");
        let nextUnits = [];

        if (role === "student") {
          const profile = await getProfile();
          const corridorId = profile?.identity?.corridorId;
          nextUnits = corridorId ? await getUnits(corridorId) : [];
          nextUnits = Array.isArray(nextUnits) ? nextUnits.filter((unit) => unit.visibleToStudents !== false) : [];
        } else {
          nextUnits = await getLandlordUnits();
        }

        if (active) {
          setUnits(Array.isArray(nextUnits) ? nextUnits : []);
        }
      } catch (loadError) {
        if (active) {
          setUnits([]);
          setError(loadError.message || "Unable to load units.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUnits();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={styles.page}>
      <section className="glass fade-up">
        <p className="label-caps">Units portfolio</p>
        <h1 className={styles.title}>Live unit portfolio</h1>
        <p className={styles.subtitle}>Browse real inventory data with trust visibility, complaints, audit signals, and current capacity.</p>
      </section>

      {error ? <div className="status-banner error">{error}</div> : null}

      <section className={styles.grid}>
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <div key={index} className={styles.skeleton} />)
        ) : units.length ? (
          units.map((unit) => <UnitCard key={unit.id || unit.unitId} showDetails unit={unit} />)
        ) : (
          <div className="empty-state panel-light">No units are available for this view.</div>
        )}
      </section>
    </div>
  );
}
