"use client";

import { useEffect, useState } from "react";
import { getUnitComplaints } from "@/lib/api";
import styles from "./page.module.css";

export default function UnitComplaintsPage({ params }) {
  const [complaints, setComplaints] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadComplaints() {
      try {
        const payload = await getUnitComplaints(params.unitId);
        let nextComplaints = [];

        if (Array.isArray(payload?.complaints)) {
          nextComplaints = payload.complaints.map((complaint) => ({
            id: complaint.id,
            category: complaint.incidentType || "other",
            status: complaint.slaStatus || (complaint.resolved ? "resolved" : "open"),
            priority: complaint.severity >= 4 ? "High" : complaint.severity === 3 ? "Medium" : "Low",
            createdAt: complaint.createdAt,
            summary: complaint.message || "No summary provided.",
          }));
        } else if (Array.isArray(payload?.ownComplaints)) {
          nextComplaints = payload.ownComplaints.map((complaint) => ({
            id: complaint.id,
            category: complaint.incidentType || "other",
            status: complaint.slaStatus || (complaint.resolved ? "resolved" : "open"),
            priority: complaint.severity >= 4 ? "High" : complaint.severity === 3 ? "Medium" : "Low",
            createdAt: complaint.createdAt,
            summary: complaint.message || "No summary provided.",
          }));
        }

        if (active) {
          setComplaints(nextComplaints);
        }
      } catch {
        if (active) {
          setComplaints([]);
        }
      }
    }

    loadComplaints();
    return () => {
      active = false;
    };
  }, [params.unitId]);

  return (
    <div className={`pageShell ${styles.page}`}>
      <div>
        <h1 className="pageTitle">Unit complaints</h1>
        <p className="pageSubtitle">Complaint activity scoped to unit {params.unitId} with the same global table structure.</p>
      </div>

      <div className="tableShell">
        <table className="luxuryTable">
          <thead>
            <tr>
              <th>ID</th>
              <th>Category</th>
              <th>Status</th>
              <th>Priority</th>
              <th>Created</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((complaint) => (
              <tr key={complaint.id}>
                <td>{complaint.id}</td>
                <td>{complaint.category}</td>
                <td>{complaint.status}</td>
                <td>{complaint.priority}</td>
                <td>{complaint.createdAt}</td>
                <td>{complaint.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
