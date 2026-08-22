"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getProfile } from "@/lib/api";
import { formatShortDate, getRoleClass, getTrustBand } from "@/lib/governance";
import { clearSession, getStoredRole, getStoredUser, requireSessionOrRedirect } from "@/lib/session";

function SectionCard({ title, children }) {
  return (
    <article className="glass-panel p-6">
      <div className="eyebrow">{title}</div>
      <div className="mt-5">{children}</div>
    </article>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState({});
  const [role, setRole] = useState("");

  useEffect(() => {
    if (!requireSessionOrRedirect()) return;

    setUser(getStoredUser());
    setRole(getStoredRole());

    let active = true;

    async function loadProfile() {
      try {
        const payload = await getProfile();
        if (active) setProfile(payload);
      } catch (requestError) {
        const message = requestError.message || "Unable to load profile.";
        if (!active) return;

        if (message === "User not found") {
          clearSession();
          window.location.href = "/login?reason=session-expired";
          return;
        }

        setError(message);
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
    const source = profile?.identity?.name || user?.name || "NearNest";
    return source
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((chunk) => chunk[0]?.toUpperCase())
      .join("");
  }, [profile, user]);

  const roleValue = profile?.role || role || "student";
  const currentTrust = getTrustBand(profile?.currentAccommodation?.trustScore || profile?.portfolioSummary?.avgTrustAcrossUnits || 0);
  const posture = (() => {
    if (roleValue === "student" || roleValue === "landlord") {
      return {
        title: currentTrust.label,
        body: currentTrust.narrative,
      };
    }

    if (roleValue === "admin") {
      return {
        title: "Governance Control",
        body: "Administrative visibility spans corridor risk, audits, suspensions, and complaint density.",
      };
    }

    return {
      title: "Profile Active",
      body: "Role-based visibility is active for this account.",
    };
  })();

  if (loading) {
    return (
      <div className="grid gap-5">
        <div className="surface-panel h-56 animate-pulse" />
        <div className="surface-panel h-72 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {error ? <div className="status-banner error">{error}</div> : null}

      <section className="glass-panel-strong blueprint-border flex flex-col gap-6 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div className="flex items-center gap-5">
          <div className="grid h-20 w-20 place-items-center rounded-[28px] bg-gradient-to-br from-violet-300 via-sky-300 to-emerald-200 text-2xl font-bold text-slate-950">
            {initials || "NN"}
          </div>
          <div>
            <div className="eyebrow">Profile</div>
            <h1 className="page-title mt-4 text-gradient">{profile?.identity?.name || user?.name || "NearNest User"}</h1>
            <p className="subtle-copy mt-3">{profile?.identity?.email || user?.email || "Email unavailable"}</p>
            <div className="mt-4">
              <span className={getRoleClass(roleValue)}>{roleValue}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:min-w-[260px]">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Governance posture</p>
            <strong className="mt-2 block text-2xl text-white">{posture.title}</strong>
            <span className="mt-2 block text-sm leading-6 text-slate-400">{posture.body}</span>
          </div>
        </div>
      </section>

      {profile?.role === "student" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Identity">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Corridor</p><strong className="mt-2 block text-white">{profile?.identity?.corridorId || "Not set"}</strong></div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Institution</p><strong className="mt-2 block text-white">{profile?.identity?.institutionId || "Not set"}</strong></div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Intake</p><strong className="mt-2 block text-white">{profile?.identity?.intake || "Not set"}</strong></div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Complaints filed</p><strong className="mt-2 block text-white">{profile?.complaintSummary?.totalSubmitted || 0}</strong></div>
            </div>
          </SectionCard>

          <SectionCard title="Current Unit">
            {profile?.currentAccommodation ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <strong className="text-2xl text-white">Unit {profile.currentAccommodation.unitId}</strong>
                  <span className={`signal-chip ${getTrustBand(profile.currentAccommodation.trustScore).tone}`}>
                    {getTrustBand(profile.currentAccommodation.trustScore).label}
                  </span>
                </div>
                <div className="mt-4 trust-track">
                  <div className={`trust-fill ${getTrustBand(profile.currentAccommodation.trustScore).fillClass}`} style={{ width: `${profile.currentAccommodation.trustScore || 0}%` }} />
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Trust score</p><strong className="mt-2 block text-white">{profile.currentAccommodation.trustScore || 0}</strong></div>
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Active complaints</p><strong className="mt-2 block text-white">{profile.currentAccommodation.activeComplaints || 0}</strong></div>
                </div>
                <Link className="btn-secondary mt-5" href={`/unit/${profile.currentAccommodation.unitId}`}>
                  Open unit governance detail
                </Link>
              </>
            ) : (
              <div className="empty-state">No current unit is associated with this profile.</div>
            )}
          </SectionCard>
        </div>
      ) : null}

      {profile?.role === "landlord" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Portfolio">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Total units</p><strong className="mt-2 block text-white">{profile?.portfolioSummary?.totalUnits || 0}</strong></div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Approved</p><strong className="mt-2 block text-white">{profile?.portfolioSummary?.approvedUnits || 0}</strong></div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Suspended</p><strong className="mt-2 block text-white">{profile?.portfolioSummary?.suspendedUnits || 0}</strong></div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">SLA compliance</p><strong className="mt-2 block text-white">{profile?.portfolioSummary?.slaCompliance ?? 0}%</strong></div>
            </div>
          </SectionCard>
          <SectionCard title="Risk Snapshot">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Audit risk</p><strong className="mt-2 block text-white">{profile?.riskSnapshot?.unitsAtAuditRisk || 0}</strong></div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Active complaints</p><strong className="mt-2 block text-white">{profile?.riskSnapshot?.activeComplaints || 0}</strong></div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Avg trust</p><strong className="mt-2 block text-white">{profile?.portfolioSummary?.avgTrustAcrossUnits || 0}</strong></div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {profile?.role === "admin" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Governance Scope">
            <div className="flex flex-wrap gap-2">
              {(profile?.governanceScope?.assignedCorridors || []).map((corridor) => (
                <span key={corridor.id} className="signal-chip signal-info">{corridor.name}</span>
              ))}
              {!profile?.governanceScope?.assignedCorridors?.length ? <div className="empty-state w-full">No assigned corridors found.</div> : null}
            </div>
          </SectionCard>
          <SectionCard title="Audit Stats">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Governed units</p><strong className="mt-2 block text-white">{profile?.governanceScope?.totalUnitsGoverned || 0}</strong></div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">Audits triggered</p><strong className="mt-2 block text-white">{profile?.governanceScope?.totalAuditsTriggered || 0}</strong></div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4"><p className="text-xs text-slate-500">30 day density</p><strong className="mt-2 block text-white">{profile?.governanceScope?.complaintDensityLast30Days || 0}</strong></div>
            </div>
          </SectionCard>
        </div>
      ) : null}

      <section className="glass-panel p-6">
        <div className="eyebrow">Activity history</div>
        <div className="mt-5 grid gap-3">
          {(profile?.occupancy?.history || []).map((item) => (
            <div key={item.occupancyId} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
              <strong className="text-white">Unit {item.unitId}</strong>
              <p className="mt-2 text-sm text-slate-400">
                {formatShortDate(item.startDate)} to {item.endDate ? formatShortDate(item.endDate) : "Present"}
              </p>
            </div>
          ))}
          {!profile?.occupancy?.history?.length ? <div className="empty-state">No additional history is available for this profile.</div> : null}
        </div>
      </section>
    </div>
  );
}
