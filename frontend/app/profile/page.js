"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

function OccupantIdStat({ label, displayValue, rawValue }) {
  const primary = displayValue || rawValue || "N/A";
  const showRaw = Boolean(displayValue && rawValue && displayValue !== rawValue);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{primary}</p>
      {showRaw && <p className="mt-1 text-xs text-slate-500">Raw: {rawValue}</p>}
    </div>
  );
}

function boolLabel(value) {
  if (value === undefined || value === null) return "N/A";
  return value ? "Yes" : "No";
}

function trustBandTone(trustBand) {
  if (trustBand === "priority") return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (trustBand === "hidden") return "text-red-700 bg-red-50 border-red-200";
  return "text-amber-700 bg-amber-50 border-amber-200";
}

function DensityBadge({ count }) {
  let tone = "border-slate-300 bg-slate-50 text-slate-700";
  if (count >= 5) tone = "border-red-300 bg-red-50 text-red-700";
  else if (count >= 3) tone = "border-amber-300 bg-amber-50 text-amber-700";
  return <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${tone}`}>Density: {count}/30d</span>;
}

function MediaGrid({ title, items }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
      {list.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No items</p>
      ) : (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {list.slice(0, 4).map((item) => (
            <a
              key={`media-${item.id}`}
              href={item.publicUrl}
              target="_blank"
              rel="noreferrer"
              className="truncate rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
            >
              {item.publicUrl}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function CurrentAccommodationCard({ data }) {
  if (!data) return null;

  const identity = data.identity || {};
  const trust = data.trust || {};
  const properties = data.properties || {};
  const availability = data.availability || {};
  const complaintHealth = data.complaintHealth || {};
  const trend = complaintHealth.trend || {};

  return (
    <section className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Current Accommodation</h2>
        <div className="flex gap-2">
          {data.links?.unitPage && (
            <Link className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={data.links.unitPage}>
              View Unit
            </Link>
          )}
          {data.links?.unitComplaintsPage && (
            <Link className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50" href={data.links.unitComplaintsPage}>
              View Complaint Ledger
            </Link>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <Stat label="Unit" value={identity.hostelLabel || identity.unitLabel} />
        <Stat label="Corridor" value={identity.corridor ? `#${identity.corridor.id} - ${identity.corridor.name}` : "N/A"} />
        <Stat label="Room Number" value={identity.roomNumber || "N/A"} />
        <Stat label="Bed Slot" value={identity.bedSlot ? `${identity.bedSlot}` : "N/A"} />
        <OccupantIdStat label="Occupant ID" displayValue={identity.occupantIdDisplay || null} rawValue={identity.occupantId || null} />
        <Stat label="Check-in Date" value={formatDate(identity.checkInDate)} />
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${trustBandTone(trust.trustBand)}`}>
            Trust: {trust.trustScore ?? "N/A"} ({trust.trustBand || "unknown"})
          </span>
          <DensityBadge count={trust.complaintDensity30d || 0} />
          <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${trust.status === "suspended" ? "border-red-300 bg-red-50 text-red-700" : "border-slate-300 bg-white text-slate-700"}`}>
            Status: {trust.status || "N/A"}
          </span>
          {trust.auditRequired && <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Audit Required</span>}
        </div>
        <p className={`mt-2 text-sm ${trust.visibilityThresholdBreached ? "text-red-700" : "text-slate-700"}`}>
          {trust.message || "Unit governance status unavailable."}
        </p>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <Stat label="Rent" value={properties.rent !== undefined ? `Rs ${properties.rent}` : "N/A"} />
        <Stat label="Distance" value={properties.distanceKm !== undefined ? `${properties.distanceKm} km` : "N/A"} />
        <Stat label="Institution Proximity" value={properties.institutionProximityKm !== undefined ? `${properties.institutionProximityKm} km` : "N/A"} />
        <Stat label="Occupancy Type" value={properties.occupancyType || "N/A"} />
        <Stat label="AC" value={boolLabel(properties.ac)} />
        <Stat label="Bed Available" value={boolLabel(properties.bedAvailable)} />
        <Stat label="Water Access" value={boolLabel(properties.waterAvailable)} />
        <Stat label="Toilets Available" value={properties.toiletsAvailable ?? "N/A"} />
        <Stat label="Ventilation" value={boolLabel(properties.ventilationGood)} />
        <Stat label="Availability" value={`${availability.availableSlots ?? 0} / ${availability.capacity ?? 0} slots`} />
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <MediaGrid title="Photos" items={data.media?.photos} />
        <MediaGrid title="Documents" items={data.media?.documents} />
        <MediaGrid title="360 Walkthroughs" items={data.media?.walkthroughs360} />
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-sm font-semibold text-slate-900">Unit Health (Last {complaintHealth.windowDays || 30} Days)</p>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <Stat label="Complaints (30d)" value={complaintHealth.totalComplaints30d ?? 0} />
          <Stat label="Open (30d)" value={complaintHealth.openComplaints30d ?? 0} />
          <Stat label="My Open Complaints" value={complaintHealth.myOpenComplaints ?? 0} />
          <Stat label="Avg Resolution" value={complaintHealth.avgResolutionHours30d !== null && complaintHealth.avgResolutionHours30d !== undefined ? `${complaintHealth.avgResolutionHours30d}h` : "N/A"} />
          <Stat label="SLA Breaches" value={complaintHealth.slaBreaches30d ?? 0} />
          <Stat label="Incident Flags" value={complaintHealth.incidentFlags30d ?? 0} />
        </div>
        <p className="mt-2 text-xs text-slate-600">
          Trend: {trend.direction || "flat"} ({trend.previous14d ?? 0} to {trend.current14d ?? 0} complaints in successive 14-day windows)
        </p>
      </div>
    </section>
  );
}

function StudentProfile({ data }) {
  const identity = data?.identity || {};
  const occupancy = data?.occupancy || {};
  const complaintSummary = data?.complaintSummary || {};
  const history = Array.isArray(occupancy.history) ? occupancy.history : [];
  const currentAccommodation = data?.currentAccommodation || null;

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
          <OccupantIdStat
            label="Occupant ID"
            displayValue={identity.occupantIdDisplay || null}
            rawValue={identity.occupantId || identity.currentOccupantId || null}
          />
          <Stat label="VDP Status" value={identity.vdp?.status || "not_joined"} />
          <Stat label="Status" value={identity.status} />
          <Stat label="Joined Date" value={formatDate(identity.joinedDate)} />
        </div>
      </section>

      <CurrentAccommodationCard data={currentAccommodation} />

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
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-slate-800">Occupant IDs</p>
          {!Array.isArray(occupancy.occupantIds) || occupancy.occupantIds.length === 0 ? (
            <p className="text-sm text-slate-600">No occupant IDs yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {occupancy.occupantIds.map((item) => (
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    item.active ? "border-green-300 bg-green-50 text-green-700" : "border-slate-300 bg-slate-50 text-slate-700"
                  }`}
                  key={`occupant-id-${item.id}`}
                >
                  {item.publicIdDisplay || item.publicId} {item.active ? "(Active)" : "(Inactive)"}
                </span>
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
