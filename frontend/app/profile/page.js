"use client";

import { useEffect, useState } from "react";
import { getProfile } from "@/lib/api";
import styles from "./page.module.css";

const defaultProfile = {
  name: "",
  email: "",
  phone: "",
  initials: "NN",
  notifications: {
    escalations: true,
    riskDigests: true,
    residentMessages: false,
  },
};

export default function ProfilePage() {
  const [profile, setProfile] = useState(defaultProfile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const payload = await getProfile();
        const identity = payload?.identity || {};
        const name = identity.name || "";
        const email = identity.email || JSON.parse(localStorage.getItem("user") || "{}")?.email || "";

        if (!active) return;
        setProfile((prev) => ({
          ...prev,
          name,
          email,
          phone: identity.occupantIdDisplay || prev.phone,
          initials: name
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() || "")
            .join("") || "NN",
        }));
      } catch {
        // Keep local editable defaults if profile loading fails.
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  function update(field, value) {
    setSaved(false);
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  function toggle(notification) {
    setSaved(false);
    setProfile((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [notification]: !prev.notifications[notification],
      },
    }));
  }

  return (
    <div className={`pageShell ${styles.page}`}>
      <div className={styles.hero}>
        <div className={styles.avatar}>{profile.initials}</div>
        <div>
          <h1 className="pageTitle">Profile settings</h1>
          <p className="pageSubtitle">Update your identity, contact preferences, and Dawn notification controls.</p>
        </div>
      </div>

      <section className={styles.card}>
        <div className={styles.grid}>
          <label>
            <span>Name</span>
            <input className="inputField" value={profile.name} onChange={(event) => update("name", event.target.value)} />
          </label>
          <label>
            <span>Email</span>
            <input className="inputField" value={profile.email} onChange={(event) => update("email", event.target.value)} />
          </label>
          <label>
            <span>Phone</span>
            <input className="inputField" value={profile.phone} onChange={(event) => update("phone", event.target.value)} />
          </label>
        </div>
      </section>

      <section className={styles.card}>
        <div className="sectionHeader">
          <div>
            <h2>Notification preferences</h2>
            <p className="mutedText">Choose which operational signals should reach you directly.</p>
          </div>
        </div>

        <div className={styles.toggleList}>
          {Object.entries(profile.notifications).map(([key, value]) => (
            <button key={key} className={styles.toggleRow} onClick={() => toggle(key)} type="button">
              <div>
                <strong>{key}</strong>
                <span>Control real-time alerts for {key}.</span>
              </div>
              <span className={`${styles.toggle} ${value ? styles.toggleActive : ""}`} />
            </button>
          ))}
        </div>
      </section>

      <div className={styles.actions}>
        <button
          className="primaryButton"
          onClick={() => {
            localStorage.setItem("userName", profile.name);
            setSaved(true);
          }}
          type="button"
        >
          Save Changes
        </button>
        {saved && <span className={styles.saved}>Profile updated successfully.</span>}
      </div>
    </div>
  );
}
