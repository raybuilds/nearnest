"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getProfile } from "@/lib/api";
import styles from "./page.module.css";

function trustBandLabel(trustBand) {
  if (trustBand === "priority") return "Priority";
  if (trustBand === "standard") return "Standard";
  return "Hidden";
}

function trustBandClass(trustBand) {
  if (trustBand === "priority") return "band-priority";
  if (trustBand === "standard") return "band-standard";
  return "band-hidden";
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString();
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionUser, setSessionUser] = useState({ name: "", email: "", role: "" });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "/login";
      return;
    }

    setSessionUser({
      ...(JSON.parse(localStorage.getItem("user") || "{}") || {}),
      role: localStorage.getItem("role") || "",
    });

    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const payload = await getProfile();
        if (active) setProfile(payload);
      } catch (loadError) {
        if (active) setError(loadError.message || "Unable to load profile.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  const initials = useMemo(() => {
    const name = profile?.identity?.name || sessionUser?.name || "Near Nest";
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }, [profile, sessionUser]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeletonHero} />
        <div className={styles.skeletonBlock} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {error ? <div className="status-banner error">{error}</div> : null}

      <section className={`${styles.hero} glass fade-up`}>
        <div className={styles.avatar}>{initials || "NN"}</div>
        <div className={styles.heroCopy}>
          <div className={styles.heroHeading}>
            <h1 className={styles.title}>{profile?.identity?.name || "Profile"}</h1>
            <span className={`role-pill rp-${profile?.role || sessionUser?.role || "student"}`}>{profile?.role || sessionUser?.role || "student"}</span>
          </div>
          <p className={styles.email}>{profile?.identity?.email || sessionUser?.email || "No email available"}</p>
        </div>
      </section>

      {profile?.role === "student" ? (
        <>
          <section className={`${styles.grid} fade-up-d1`}>
            <article className="panel">
              <p className="label-caps">Identity</p>
              <div className={styles.infoGrid}>
                <div className="metric-card"><span className="ml">Name</span><strong className="mv">{profile.identity?.name || "Not available"}</strong></div>
                <div className="metric-card"><span className="ml">Intake</span><strong className="mv">{profile.identity?.intake || "Not available"}</strong></div>
                <div className="metric-card"><span className="ml">Corridor</span><strong className="mv">{profile.identity?.corridorId || "Not available"}</strong></div>
                <div className="metric-card"><span className="ml">Institution</span><strong className="mv">{profile.identity?.institutionId || "Not available"}</strong></div>
              </div>
            </article>

            <article className="panel">
              <p className="label-caps">Current accommodation</p>
              {profile.currentAccommodation ? (
                <>
                  <div className="trust-bar-track">
                    <div className={`trust-bar-fill ${profile.currentAccommodation.trustBand || "hidden"}`} style={{ width: `${profile.currentAccommodation.trustScore || 0}%` }} />
                  </div>
                  <div className={styles.trustRow}>
                    <strong className={styles.score}>{profile.currentAccommodation.trustScore || 0}</strong>
                    <span className={`trust-band-badge ${trustBandClass(profile.currentAccommodation.trustBand)}`}>
                      {trustBandLabel(profile.currentAccommodation.trustBand)}
                    </span>
                  </div>
                  <div className={styles.chipRow}>
                    <span className="chip ch-warn">{profile.currentAccommodation.activeComplaints || 0} active complaints</span>
                    <Link className="btn-soft blue" href={`/unit/${profile.currentAccommodation.unitId}`}>
                      View unit
                    </Link>
                  </div>
                </>
              ) : (
                <div className="empty-state">You do not currently have an active occupancy record.</div>
              )}
            </article>
          </section>

          <section className={`${styles.grid} fade-up-d2`}>
            <article className="panel">
              <p className="label-caps">Occupant IDs</p>
              <div className={styles.list}>
                {(profile.occupancy?.occupantIds || []).map((item) => (
                  <div key={item.id} className="panel-light">
                    <div className={styles.row}>
                      <code className={styles.code}>{item.publicIdDisplay || item.publicId}</code>
                      <span className={`chip ${item.active ? "ch-ok" : "ch-warn"}`}>{item.active ? "Active" : "Inactive"}</span>
                    </div>
                    <p className={styles.meta}>Room {item.roomNumber || "Not assigned"}</p>
                    <p className={styles.meta}>Created {formatDate(item.createdAt)}</p>
                  </div>
                ))}
                {!profile.occupancy?.occupantIds?.length ? <div className="empty-state">No occupant IDs are currently assigned to your record.</div> : null}
              </div>
            </article>

            <article className="panel">
              <p className="label-caps">Complaint summary</p>
              <div className={styles.infoGrid}>
                <div className="metric-card"><span className="ml">Submitted</span><strong className="mv">{profile.complaintSummary?.totalSubmitted || 0}</strong></div>
                <div className="metric-card"><span className="ml">Open</span><strong className="mv">{profile.complaintSummary?.openComplaints || 0}</strong></div>
                <div className="metric-card"><span className="ml">Avg resolution</span><strong className="mv">{profile.complaintSummary?.avgResolutionHours || 0}h</strong></div>
              </div>
            </article>
          </section>

          <section className="panel fade-up-d3">
            <p className="label-caps">Occupancy history</p>
            <div className={styles.timeline}>
              {(profile.occupancy?.history || []).map((item) => (
                <div key={item.occupancyId} className={styles.timelineItem}>
                  <strong>Unit {item.unitId}</strong>
                  <span>{formatDate(item.startDate)} to {item.endDate ? formatDate(item.endDate) : "Present"}</span>
                </div>
              ))}
              {!profile.occupancy?.history?.length ? <div className="empty-state">No previous occupancy history is available.</div> : null}
            </div>
          </section>
        </>
      ) : null}

      {profile?.role === "landlord" ? (
        <>
          <section className={`${styles.grid} fade-up-d1`}>
            <article className="panel">
              <p className="label-caps">Identity</p>
              <div className={styles.infoGrid}>
                <div className="metric-card"><span className="ml">Name</span><strong className="mv">{profile.identity?.name || "Not available"}</strong></div>
                <div className="metric-card"><span className="ml">Joined</span><strong className="mv">{formatDate(profile.identity?.joinedDate)}</strong></div>
              </div>
            </article>
            <article className="panel">
              <p className="label-caps">Portfolio summary</p>
              <div className={styles.infoGrid}>
                <div className="metric-card"><span className="ml">Total units</span><strong className="mv">{profile.portfolioSummary?.totalUnits || 0}</strong></div>
                <div className="metric-card"><span className="ml">Approved</span><strong className="mv">{profile.portfolioSummary?.approvedUnits || 0}</strong></div>
                <div className="metric-card"><span className="ml">Suspended</span><strong className="mv">{profile.portfolioSummary?.suspendedUnits || 0}</strong></div>
                <div className="metric-card"><span className="ml">SLA compliance</span><strong className="mv">{profile.portfolioSummary?.slaCompliance ?? 0}%</strong></div>
              </div>
            </article>
          </section>

          <section className="panel fade-up-d2">
            <p className="label-caps">Risk snapshot</p>
            <div className={styles.infoGrid}>
              <div className="metric-card"><span className="ml">Units at audit risk</span><strong className="mv">{profile.riskSnapshot?.unitsAtAuditRisk || 0}</strong></div>
              <div className="metric-card"><span className="ml">Active complaints</span><strong className="mv">{profile.riskSnapshot?.activeComplaints || 0}</strong></div>
              <div className="metric-card"><span className="ml">Average trust</span><strong className="mv">{profile.portfolioSummary?.avgTrustAcrossUnits || 0}</strong></div>
            </div>
          </section>
        </>
      ) : null}

      {profile?.role === "admin" ? (
        <>
          <section className={`${styles.grid} fade-up-d1`}>
            <article className="panel">
              <p className="label-caps">Governance scope</p>
              <div className={styles.chipRow}>
                {(profile.governanceScope?.assignedCorridors || []).map((corridor) => (
                  <span key={corridor.id} className="chip ch-purple">
                    {corridor.name}
                  </span>
                ))}
              </div>
            </article>
            <article className="panel">
              <p className="label-caps">Operations</p>
              <div className={styles.infoGrid}>
                <div className="metric-card"><span className="ml">Governed units</span><strong className="mv">{profile.governanceScope?.totalUnitsGoverned || 0}</strong></div>
                <div className="metric-card"><span className="ml">Audits triggered</span><strong className="mv">{profile.governanceScope?.totalAuditsTriggered || 0}</strong></div>
                <div className="metric-card"><span className="ml">Suspensions</span><strong className="mv">{profile.governanceScope?.activeSuspensions || 0}</strong></div>
                <div className="metric-card"><span className="ml">30 day density</span><strong className="mv">{profile.governanceScope?.complaintDensityLast30Days || 0}</strong></div>
              </div>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}
