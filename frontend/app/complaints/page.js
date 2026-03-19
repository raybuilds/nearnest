"use client";

import { useMemo, useState } from "react";
import ComplaintForm from "@/components/ComplaintForm";
import { mockComplaints } from "@/lib/mockData";
import styles from "./page.module.css";

export default function ComplaintsPage() {
  const [filters, setFilters] = useState({ unit: "all", status: "all", category: "all" });
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(
    () =>
      mockComplaints.filter((complaint) => {
        if (filters.unit !== "all" && complaint.unitId !== filters.unit) return false;
        if (filters.status !== "all" && complaint.status !== filters.status) return false;
        if (filters.category !== "all" && complaint.category !== filters.category) return false;
        return true;
      }),
    [filters]
  );

  return (
    <div className={`pageShell ${styles.page}`}>
      <div>
        <h1 className="pageTitle">Complaints command center</h1>
        <p className="pageSubtitle">Filter by unit, status, or category and open any row for a full operational timeline.</p>
      </div>

      <section className={styles.filters}>
        <select className="selectField" value={filters.unit} onChange={(event) => setFilters((prev) => ({ ...prev, unit: event.target.value }))}>
          <option value="all">All units</option>
          {Array.from(new Set(mockComplaints.map((item) => item.unitId))).map((unitId) => (
            <option key={unitId} value={unitId}>
              {unitId}
            </option>
          ))}
        </select>
        <select className="selectField" value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="escalated">Escalated</option>
        </select>
        <select className="selectField" value={filters.category} onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}>
          <option value="all">All categories</option>
          <option value="Plumbing">Plumbing</option>
          <option value="Electrical">Electrical</option>
          <option value="Structural">Structural</option>
          <option value="Other">Other</option>
        </select>
      </section>

      <div className={styles.layout}>
        <div className="tableShell">
          <table className="luxuryTable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Unit</th>
                <th>Category</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((complaint) => (
                <tr key={complaint.id} onClick={() => setSelected(complaint)}>
                  <td>{complaint.id}</td>
                  <td>{complaint.unitId}</td>
                  <td>{complaint.category}</td>
                  <td>
                    <span className={`${styles.chip} ${styles[`chip${complaint.status[0].toUpperCase()}${complaint.status.slice(1)}`]}`}>
                      {complaint.status}
                    </span>
                  </td>
                  <td>{complaint.priority}</td>
                  <td>{complaint.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ComplaintForm />
      </div>

      {selected && (
        <div className={styles.drawerOverlay} onClick={() => setSelected(null)}>
          <aside className={styles.drawer} onClick={(event) => event.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <p className={styles.drawerKicker}>{selected.id}</p>
                <h2>{selected.summary}</h2>
              </div>
              <button className="secondaryButton" onClick={() => setSelected(null)} type="button">
                Close
              </button>
            </div>
            <p className={styles.drawerText}>{selected.description}</p>
            <div className={styles.timeline}>
              {selected.timeline.map((item) => (
                <div key={item.time} className={styles.timelineItem}>
                  <strong>{item.time}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
