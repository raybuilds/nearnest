"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

function formatDate(date) {
  if (!date) return "N/A";
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value ?? "N/A"}</p>
    </div>
  );
}

function StudentProfile({ data }) {
  const identity = data?.identity || {};
  const occupancy = data?.occupancy || {};
  const complaintSummary = data?.complaintSummary || {};
  const history = Array.isArray(occupancy.history) ? occupancy.history : [];

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Identity</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <Stat label="Name" value={identity.name} />
          <Stat label="Student ID" value={identity.studentId} />
          <Stat label="Institution" value={identity.institution?.name || "N/A"} />
          <Stat label="Intake" value={identity.intake} />
          <Stat label="Corridor" value={identity.corridor ? `#${identity.corridor.id} - ${identity.corridor.name}` : "N/A"} />
          <Stat label="VDP Status" value={identity.vdp?.status || "not_joined"} />
          <Stat label="Status" value={identity.status} />
          <Stat label="Joined Date" value={formatDate(identity.joinedDate)} />
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Occupancy</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <Stat label="Current Unit" value={occupancy.currentUnit ? `Unit #${occupancy.currentUnit.unitId}` : "None"} />
          <Stat label="Check-in Date" value={formatDate(occupancy.currentUnit?.checkInDate)} />
        </div>
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">Occupancy History</p>
          {history.length === 0 && <p className="text-sm text-slate-600">No occupancy history yet.</p>}
          {history.length > 0 && (
            <div className="space-y-2">
              {history.slice(0, 10).map((item) => (
                <div className="rounded-lg border border-slate-200 p-3" key={item.occupancyId}>
                  <p className="text-sm font-semibold text-slate-900">Unit #{item.unitId}</p>
                  <p className="text-xs text-slate-600">Start: {formatDate(item.startDate)}</p>
                  <p className="text-xs text-slate-600">End: {formatDate(item.endDate)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Complaint History Summary</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <Stat label="Total Complaints Submitted" value={complaintSummary.totalSubmitted ?? 0} />
          <Stat label="Open Complaints" value={complaintSummary.openComplaints ?? 0} />
          <Stat label="Avg Resolution Time" value={complaintSummary.avgResolutionHours !== null && complaintSummary.avgResolutionHours !== undefined ? `${complaintSummary.avgResolutionHours}h` : "N/A"} />
        </div>
      </section>
    </div>
  );
}

function LandlordProfile({ data }) {
  const identity = data?.identity || {};
  const portfolio = data?.portfolioSummary || {};
  const risk = data?.riskSnapshot || {};
  const corridors = Array.isArray(identity.corridorsActiveIn) ? identity.corridorsActiveIn : [];

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Identity</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <Stat label="Name" value={identity.name} />
          <Stat label="Landlord ID" value={identity.landlordId} />
          <Stat label="Joined Date" value={formatDate(identity.joinedDate)} />
          <Stat
            label="Corridors Active In"
            value={corridors.length > 0 ? corridors.map((item) => `#${item.id}`).join(", ") : "None"}
          />
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Portfolio Summary</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <Stat label="Total Units" value={portfolio.totalUnits ?? 0} />
          <Stat label="Approved Units" value={portfolio.approvedUnits ?? 0} />
          <Stat label="Suspended Units" value={portfolio.suspendedUnits ?? 0} />
          <Stat label="Avg Trust Across Units" value={portfolio.avgTrustAcrossUnits ?? "N/A"} />
          <Stat label="SLA Compliance %" value={portfolio.slaCompliance ?? "N/A"} />
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Risk Snapshot</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <Stat label="Units at Audit Risk" value={risk.unitsAtAuditRisk ?? 0} />
          <Stat label="Active Complaints" value={risk.activeComplaints ?? 0} />
        </div>
      </section>
    </div>
  );
}

function AdminProfile({ data }) {
  const identity = data?.identity || {};
  const scope = data?.governanceScope || {};
  const corridors = Array.isArray(scope.assignedCorridors) ? scope.assignedCorridors : [];

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Identity</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <Stat label="Admin ID" value={identity.adminId} />
          <Stat label="Name" value={identity.name} />
          <Stat label="Joined Date" value={formatDate(identity.joinedDate)} />
          <Stat
            label="Assigned Corridors"
            value={corridors.length > 0 ? corridors.map((item) => `#${item.id}`).join(", ") : "None"}
          />
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold">Governance Scope</h2>
        <div className="grid gap-2 md:grid-cols-3">
          <Stat label="Total Units Governed" value={scope.totalUnitsGoverned ?? 0} />
          <Stat label="Total Audits Triggered" value={scope.totalAuditsTriggered ?? 0} />
          <Stat label="Active Suspensions" value={scope.activeSuspensions ?? 0} />
          <Stat label="Complaint Density (30d)" value={scope.complaintDensityLast30Days ?? 0} />
        </div>
      </section>
    </div>
  );
}

export default function ProfilePage() {
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    const roleFromStorage = localStorage.getItem("role") || "";
    setRole(roleFromStorage);
  }, []);

  useEffect(() => {
    if (!role) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await apiRequest("/profile");
        setPayload(data);
      } catch (err) {
        setError(err.message || "Failed to load profile");
      } finally {
        setLoading(false);
      }
    })();
  }, [role]);

  if (!role) {
    return <p className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Please login first.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Profile</h1>
      {loading && <p className="text-sm text-slate-600">Loading profile...</p>}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {!loading && !error && role === "student" && <StudentProfile data={payload} />}
      {!loading && !error && role === "landlord" && <LandlordProfile data={payload} />}
      {!loading && !error && role === "admin" && <AdminProfile data={payload} />}
    </div>
  );
}
