 "use client";

import { useEffect, useState } from "react";
import UnitCard from "@/components/UnitCard";
import { getLandlordUnits, getProfile, getUnits } from "@/lib/api";
import styles from "./page.module.css";

export default function UnitsPage() {
  const [units, setUnits] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadUnits() {
      try {
        const role = localStorage.getItem("role");
        let nextUnits = [];

        if (role === "student") {
          const profile = await getProfile();
          const corridorId = profile?.identity?.corridor?.id;
          nextUnits = corridorId ? await getUnits(corridorId) : [];
        } else {
          nextUnits = await getLandlordUnits();
        }

        if (active) {
          setUnits(Array.isArray(nextUnits) ? nextUnits : []);
        }
      } catch {
        if (active) {
          setUnits([]);
        }
      }
    }

    loadUnits();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className={`pageShell ${styles.page}`}>
      <div>
        <h1 className="pageTitle">Units portfolio</h1>
        <p className="pageSubtitle">Browse your inventory with live status, BHK type, and open operational issues.</p>
      </div>

      <section className={styles.grid}>
        {units.map((unit) => (
          <UnitCard key={unit.id || unit.unitId} {...unit} />
        ))}
      </section>
    </div>
  );
}
