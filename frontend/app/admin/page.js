"use client";

import { useEffect, useMemo, useState } from "react";
import { getAdminUnits, getCorridors } from "@/lib/api";
import styles from "./page.module.css";

export default function AdminPage() {
  const [selection, setSelection] = useState([]);
  const [users, setUsers] = useState([]);
  const allSelected = useMemo(() => selection.length === users.length, [selection, users.length]);

  useEffect(() => {
    let active = true;

    async function loadAdminRows() {
      try {
        const corridors = await getCorridors();
        const firstCorridorId = Array.isArray(corridors) ? corridors[0]?.id : null;
        if (!firstCorridorId) {
          if (active) setUsers([]);
          return;
        }

        const units = await getAdminUnits(firstCorridorId);
        const nextUsers = Array.isArray(units)
          ? units.map((unit) => ({
              id: unit.id,
              name: `Unit ${unit.id}`,
              email: `corridor-${unit.corridorId}@nearnest.local`,
              role: unit.status,
              status: unit.auditRequired ? "flagged" : "active",
            }))
          : [];

        if (active) {
          setUsers(nextUsers);
        }
      } catch {
        if (active) {
          setUsers([]);
        }
      }
    }

    loadAdminRows();
    return () => {
      active = false;
    };
  }, []);

  function toggleUser(id) {
    setSelection((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleAll() {
    setSelection(allSelected ? [] : users.map((user) => user.id));
  }

  function changeRole(id, role) {
    setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, role } : user)));
  }

  return (
    <div className={`pageShell ${styles.page}`}>
      <div>
        <h1 className="pageTitle">Admin control room</h1>
        <p className="pageSubtitle">Manage user access, assign roles, and coordinate bulk operational actions.</p>
      </div>

      <div className={styles.bulkBar}>
        <button className="secondaryButton" onClick={toggleAll} type="button">
          {allSelected ? "Clear Selection" : "Select All"}
        </button>
        <span>{selection.length} selected</span>
        <div className={styles.bulkActions}>
          <button className="primaryButton" type="button">
            Assign Admin
          </button>
          <button className="secondaryButton" type="button">
            Suspend Access
          </button>
        </div>
      </div>

      <div className="tableShell">
        <table className="luxuryTable">
          <thead>
            <tr>
              <th />
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <input checked={selection.includes(user.id)} onChange={() => toggleUser(user.id)} type="checkbox" />
                </td>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <select className={styles.roleSelect} value={user.role} onChange={(event) => changeRole(user.id, event.target.value)}>
                    <option value="tenant">tenant</option>
                    <option value="landlord">landlord</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>{user.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
