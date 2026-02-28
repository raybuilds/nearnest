"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

function formatDate(dateString) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Section({ title, children }) {
  return (
    <section className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function InfoBadge({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function MediaList({ title, media, variant = "link", onPreview }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="mb-2 text-sm font-semibold text-slate-800">{title}</p>
      {media?.length ? (
        variant === "photo" ? (
          <div className="grid grid-cols-2 gap-2">
            {media.map((item) => {
              const src = item.publicUrl || item.url;
              return (
                <button
                  className="group relative block overflow-hidden rounded border border-slate-200 bg-slate-50"
                  key={`media-${title}-${item.id}`}
                  onClick={() => onPreview?.({ src, label: item.fileName || title })}
                  type="button"
                >
                  {item.locked && (
                    <span className="absolute right-1 top-1 z-10 rounded bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      Locked
                    </span>
                  )}
                  <img
                    alt={item.fileName || `Unit ${title}`}
                    className="h-24 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                    src={src}
                  />
                </button>
              );
            })}
          </div>
        ) : (
          <ul className="space-y-1 text-sm">
            {media.map((item) => {
              const src = item.publicUrl || item.url;
              return (
                <li key={`media-${title}-${item.id}`}>
                  <a className="break-all text-blue-700 underline" href={src} rel="noreferrer" target="_blank">
                    {src}
                  </a>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <p className="text-sm text-slate-600">No items</p>
      )}
    </div>
  );
}

function ChecklistRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2">
      <span className="text-sm text-slate-700">{label}</span>
      <span className={`text-sm font-semibold ${value ? "text-green-700" : "text-rose-700"}`}>{value ? "Yes" : "No"}</span>
    </div>
  );
}

function StudentUnitView({ data, onPreview }) {
  const photos = (data.discovery.media || []).filter((item) => String(item.type).toLowerCase() === "photo");
  const docs = (data.discovery.media || []).filter((item) => String(item.type).toLowerCase() === "document");
  const walkthroughs = (data.discovery.media || []).filter((item) => {
    const mediaType = String(item.type).toLowerCase();
    return mediaType === "walkthrough360" || mediaType === "360";
  });

  return (
    <div className="space-y-6">
      <Section title="Discovery">
        <div className="grid gap-2 md:grid-cols-3">
          <InfoBadge label="Rent" value={data.discovery.rent} />
          <InfoBadge label="Distance (km)" value={data.discovery.distanceKm} />
          <InfoBadge label="AC" value={data.discovery.ac ? "Yes" : "No"} />
          <InfoBadge label="Occupancy Type" value={data.discovery.occupancyType || "N/A"} />
          <InfoBadge label="Institution Proximity (km)" value={data.discovery.institutionProximityKm} />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <MediaList media={photos} onPreview={onPreview} title="Photos" variant="photo" />
          <MediaList title="Documents" media={docs} />
          <MediaList title="360 Walkthroughs" media={walkthroughs} />
        </div>
      </Section>

      <Section title="Availability">
        <div className="grid gap-2 md:grid-cols-3">
          <InfoBadge label="Occupancy Count" value={data.availability.occupancyCount} />
          <InfoBadge label="Capacity" value={data.availability.capacity} />
          <InfoBadge label="Available Slots" value={data.availability.availableSlots} />
        </div>
      </Section>

      <Section title="Trust Signals">
        <div className="grid gap-2 md:grid-cols-4">
          <InfoBadge label="Trust Score" value={data.trustSignals.trustScore} />
          <InfoBadge label="Trust Band" value={data.trustSignals.trustBand} />
          <InfoBadge label="Complaints (Total)" value={data.trustSignals.complaintSummary.totalComplaints} />
          <InfoBadge label="Complaints (Active)" value={data.trustSignals.complaintSummary.activeComplaints} />
          <InfoBadge label="Complaints (30 days)" value={data.trustSignals.complaintSummary.complaintsLast30Days} />
          <InfoBadge label="Last Audit Date" value={formatDate(data.trustSignals.lastAuditDate)} />
        </div>
      </Section>

      <Section title="Transparency">
        <div className="grid gap-2 md:grid-cols-2">
          <InfoBadge label="Visible To Students" value={data.transparency.visibleToStudents ? "Yes" : "No"} />
          <InfoBadge
            label="Visibility Reason"
            value={data.transparency.visibilityReasons?.length ? data.transparency.visibilityReasons.join(", ") : "Visible by baseline and trust rules"}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">Your Complaint History</p>
          {!data.transparency.ownComplaintHistory?.length && <p className="text-sm text-slate-600">No complaints filed by you for this unit.</p>}
          {data.transparency.ownComplaintHistory?.map((item) => (
            <article key={item.id} className={`rounded-lg border p-3 ${item.resolved ? "border-green-200 bg-green-50" : "border-rose-200 bg-rose-50"}`}>
              <p className="text-sm font-semibold text-slate-900">Complaint #{item.id}</p>
              <p className="text-sm text-slate-700">Severity: {item.severity}/5</p>
              <p className="text-sm text-slate-700">Status: {item.resolved ? "Resolved" : "Open"}</p>
              <p className="text-xs text-slate-500">Created: {formatDate(item.createdAt)}</p>
              <p className="text-xs text-slate-500">Resolved: {formatDate(item.resolvedAt)}</p>
            </article>
          ))}
        </div>
      </Section>
    </div>
  );
}

function LandlordUnitView({ overview, interested, complaints, auditLogs, onPreview }) {
  const occupants = interested.filter((item) => item.status === "occupant");
  const shortlisted = interested.filter((item) => item.status === "shortlisted");
  const photos = (overview?.media?.all || []).filter((item) => String(item.type).toLowerCase() === "photo");
  const docs = (overview?.media?.all || []).filter((item) => String(item.type).toLowerCase() === "document");
  const walkthroughs = (overview?.media?.all || []).filter((item) => {
    const mediaType = String(item.type).toLowerCase();
    return mediaType === "walkthrough360" || mediaType === "360";
  });

  return (
    <div className="space-y-6">
      <Section title="Operational Control">
        <div className="grid gap-2 md:grid-cols-4">
          <InfoBadge label="Status" value={overview.status} />
          <InfoBadge label="Trust Score" value={overview.trustScore} />
          <InfoBadge label="Occupancy" value={`${overview.occupancyCount}/${overview.capacity}`} />
          <InfoBadge label="Shortlisted" value={overview.shortlistCount} />
          <InfoBadge label="Open Audits" value={overview.openAuditLogCount} />
        </div>
      </Section>

      <Section title="Listing Details">
        <div className="grid gap-2 md:grid-cols-3">
          <InfoBadge label="Corridor" value={overview.corridor ? `#${overview.corridor.id} - ${overview.corridor.name}` : "N/A"} />
          <InfoBadge label="Rent" value={overview.propertyDetails?.rent ?? "N/A"} />
          <InfoBadge label="Distance (km)" value={overview.propertyDetails?.distanceKm ?? "N/A"} />
          <InfoBadge label="Institution Proximity (km)" value={overview.propertyDetails?.institutionProximityKm ?? "N/A"} />
          <InfoBadge label="Occupancy Type" value={overview.propertyDetails?.occupancyType || "N/A"} />
          <InfoBadge label="AC" value={overview.propertyDetails?.ac ? "Yes" : "No"} />
          <InfoBadge label="Bed Available" value={overview.propertyDetails?.bedAvailable ? "Yes" : "No"} />
          <InfoBadge label="Water Available" value={overview.propertyDetails?.waterAvailable ? "Yes" : "No"} />
          <InfoBadge label="Toilets Available" value={overview.propertyDetails?.toiletsAvailable ?? "N/A"} />
          <InfoBadge label="Ventilation Good" value={overview.propertyDetails?.ventilationGood ? "Yes" : "No"} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-800">Self Declaration</p>
          <p className="text-sm text-slate-700">{overview.declarations?.selfDeclaration || "N/A"}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <MediaList media={photos} onPreview={onPreview} title="Photos" variant="photo" />
          <MediaList title="Documents" media={docs} />
          <MediaList title="360 Walkthroughs" media={walkthroughs} />
        </div>
      </Section>

      <Section title="Occupants">
        {!occupants.length && <p className="text-sm text-slate-600">No current occupants.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {occupants.map((student) => (
            <article key={`occupant-${student.studentId}`} className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="font-semibold text-slate-900">{student.name}</p>
              <p className="text-sm text-slate-700">Student ID: {student.studentId}</p>
              <p className="text-sm text-slate-700">Intake: {student.intake}</p>
              <p className="text-sm text-slate-700">Institution: {student.institutionName || "N/A"}</p>
              <p className="text-sm text-slate-700">Email: {student.email || "N/A"}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Shortlisted Students">
        {!shortlisted.length && <p className="text-sm text-slate-600">No shortlisted students yet.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {shortlisted.map((student) => (
            <article key={`short-${student.studentId}`} className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="font-semibold text-slate-900">{student.name}</p>
              <p className="text-sm text-slate-700">Student ID: {student.studentId}</p>
              <p className="text-sm text-slate-700">Intake: {student.intake}</p>
              <p className="text-sm text-slate-700">Institution: {student.institutionName || "N/A"}</p>
              <p className="text-sm text-slate-700">Email: {student.email || "N/A"}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Complaints">
        {!complaints.length && <p className="text-sm text-slate-600">No complaints for this unit.</p>}
        {complaints.map((item) => (
          <article key={item.id} className={`rounded-lg border p-3 ${item.resolved ? "border-green-200 bg-green-50" : "border-rose-200 bg-rose-50"}`}>
            <p className="text-sm font-semibold text-slate-900">Complaint #{item.id}</p>
            <p className="text-sm text-slate-700">Severity: {item.severity}/5</p>
            <p className="text-sm text-slate-700">Incident: {item.incidentType || "N/A"}</p>
            <p className="text-sm text-slate-700">Student: {item.student?.name || "N/A"}</p>
          </article>
        ))}
      </Section>

      <Section title="Audit Results / Logs">
        {!auditLogs.length && <p className="text-sm text-slate-600">No audit logs.</p>}
        {auditLogs.map((log) => (
          <article key={log.id} className={`rounded-lg border p-3 ${log.resolved ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <p className="text-sm font-semibold text-slate-900">Audit #{log.id}</p>
            <p className="text-sm text-slate-700">Trigger: {log.triggerType || "manual"}</p>
            <p className="text-sm text-slate-700">Reason: {log.reason}</p>
            <p className="text-sm text-slate-700">Corrective Action: {log.correctiveAction || "N/A"}</p>
            <p className="text-xs text-slate-500">Created: {formatDate(log.createdAt)}</p>
          </article>
        ))}
      </Section>
    </div>
  );
}

function AdminUnitView({
  data,
  onSetStructuralApproved,
  onSetOperationalApproved,
  onSetStatus,
  updatingGovernance,
  actionMessage,
  structuralDraft,
  operationalDraft,
  onStructuralDraftChange,
  onOperationalDraftChange,
  onSaveStructuralChecklist,
  onSaveOperationalChecklist,
  updatingChecklist,
  onPreview,
}) {
  const photos = (data.evidence.media || []).filter((item) => String(item.type).toLowerCase() === "photo");
  const docs = (data.evidence.media || []).filter((item) => String(item.type).toLowerCase() === "document");
  const walkthroughs = (data.evidence.media || []).filter((item) => {
    const mediaType = String(item.type).toLowerCase();
    return mediaType === "walkthrough360" || mediaType === "360";
  });
  const structuralChecklist = data.evidence.structuralChecklist || {};
  const operationalChecklist = data.evidence.operationalChecklist || {};
  const structuralCanApprove =
    Boolean(structuralChecklist.fireExit) &&
    Boolean(structuralChecklist.wiringSafe) &&
    Boolean(structuralChecklist.plumbingSafe) &&
    Boolean(structuralChecklist.occupancyCompliant);
  const operationalCanApprove =
    Boolean(operationalChecklist.bedAvailable) &&
    Boolean(operationalChecklist.waterAvailable) &&
    Boolean(operationalChecklist.toiletsAvailable) &&
    Boolean(operationalChecklist.ventilationGood);

  return (
    <div className="space-y-6">
      <Section title="Governance Core">
        <div className="grid gap-2 md:grid-cols-4">
          <InfoBadge label="Status" value={data.governanceCore.status} />
          <InfoBadge label="Structural Approved" value={data.governanceCore.structuralApproved ? "Yes" : "No"} />
          <InfoBadge label="Operational Approved" value={data.governanceCore.operationalBaselineApproved ? "Yes" : "No"} />
          <InfoBadge label="Trust Score" value={data.governanceCore.trustScore} />
          <InfoBadge label="Trust Band" value={data.governanceCore.trustBand} />
          <InfoBadge label="Audit Required" value={data.governanceCore.auditRequired ? "Yes" : "No"} />
        </div>
      </Section>

      <Section title="Full Evidence">
        <div className="grid gap-2 md:grid-cols-2">
          <InfoBadge label="Corridor" value={data.evidence.corridor ? `#${data.evidence.corridor.id} - ${data.evidence.corridor.name}` : "N/A"} />
          <InfoBadge label="Self Declaration" value={data.evidence.selfDeclaration || "N/A"} />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-3 text-sm font-semibold text-slate-800">Structural Checklist</p>
            <div className="space-y-2">
              <ChecklistRow label="Fire Exit" value={Boolean(structuralChecklist.fireExit)} />
              <ChecklistRow label="Wiring Safe" value={Boolean(structuralChecklist.wiringSafe)} />
              <ChecklistRow label="Plumbing Safe" value={Boolean(structuralChecklist.plumbingSafe)} />
              <ChecklistRow label="Occupancy Compliant" value={Boolean(structuralChecklist.occupancyCompliant)} />
              <ChecklistRow label="Checklist Complete" value={structuralCanApprove} />
              <ChecklistRow label="Approved" value={Boolean(data.governanceCore.structuralApproved)} />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-3 text-sm font-semibold text-slate-800">Operational Checklist</p>
            <div className="space-y-2">
              <ChecklistRow label="Bed Available" value={Boolean(operationalChecklist.bedAvailable)} />
              <ChecklistRow label="Water Available" value={Boolean(operationalChecklist.waterAvailable)} />
              <ChecklistRow label="Toilets Available" value={Boolean(operationalChecklist.toiletsAvailable)} />
              <ChecklistRow label="Ventilation Good" value={Boolean(operationalChecklist.ventilationGood)} />
              <ChecklistRow label="Checklist Complete" value={operationalCanApprove} />
              <ChecklistRow label="Approved" value={Boolean(data.governanceCore.operationalBaselineApproved)} />
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <MediaList media={photos} onPreview={onPreview} title="Photos" variant="photo" />
          <MediaList title="Documents" media={docs} />
          <MediaList title="360 Walkthroughs" media={walkthroughs} />
        </div>
      </Section>

      <Section title="Behavioral History">
        <div className="grid gap-2 md:grid-cols-4">
          <InfoBadge label="Total Complaints" value={data.behavioralHistory.slaMetrics.totalComplaints} />
          <InfoBadge label="Resolved" value={data.behavioralHistory.slaMetrics.resolvedComplaints} />
          <InfoBadge label="Unresolved" value={data.behavioralHistory.slaMetrics.unresolvedComplaints} />
          <InfoBadge label="Late Resolved" value={data.behavioralHistory.slaMetrics.lateResolvedCount} />
          <InfoBadge label="Avg Resolution (hrs)" value={data.behavioralHistory.slaMetrics.avgResolutionHours ?? "N/A"} />
          <InfoBadge label="Complaints (30d)" value={data.behavioralHistory.recurrenceAnalytics.complaintsLast30Days} />
          <InfoBadge label="Complaints (60d)" value={data.behavioralHistory.recurrenceAnalytics.complaintsLast60Days} />
          <InfoBadge label="Incident Flags" value={data.behavioralHistory.incidentFlags.incidentFlaggedCount} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-800">Complaint Timeline</p>
          {data.behavioralHistory.complaintTimeline.map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-900">Complaint #{item.id}</p>
              <p className="text-sm text-slate-700">Severity: {item.severity}</p>
              <p className="text-sm text-slate-700">Incident: {item.incidentType || "N/A"}</p>
              <p className="text-sm text-slate-700">Student: {item.student?.name || "N/A"}</p>
              <p className="text-xs text-slate-500">Created: {formatDate(item.createdAt)}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section title="Audit Layer">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-800">Governance Actions (Audit Layer)</p>
          {actionMessage && <p className="mb-2 text-sm text-slate-700">{actionMessage}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-60"
              disabled={updatingGovernance}
              onClick={() => onSetStatus("approved")}
              type="button"
            >
              Set Approved
            </button>
            <button
              className="rounded bg-amber-600 px-3 py-2 text-sm text-white disabled:opacity-60"
              disabled={updatingGovernance}
              onClick={() => onSetStatus("suspended")}
              type="button"
            >
              Set Suspended
            </button>
            <button
              className="rounded bg-rose-600 px-3 py-2 text-sm text-white disabled:opacity-60"
              disabled={updatingGovernance}
              onClick={() => onSetStatus("rejected")}
              type="button"
            >
              Set Rejected
            </button>
            <button
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              disabled={updatingGovernance || ( !data.governanceCore.structuralApproved && !structuralCanApprove)}
              onClick={() => onSetStructuralApproved(!data.governanceCore.structuralApproved)}
              type="button"
            >
              {data.governanceCore.structuralApproved ? "Mark Structural Unapproved" : "Mark Structural Approved"}
            </button>
            <button
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              disabled={updatingGovernance || (!data.governanceCore.operationalBaselineApproved && !operationalCanApprove)}
              onClick={() => onSetOperationalApproved(!data.governanceCore.operationalBaselineApproved)}
              type="button"
            >
              {data.governanceCore.operationalBaselineApproved ? "Mark Operational Unapproved" : "Mark Operational Approved"}
            </button>
          </div>
          {!structuralCanApprove && !data.governanceCore.structuralApproved && (
            <p className="mt-2 text-xs text-rose-700">Structural checklist is incomplete. Complete all structural checklist items before approving.</p>
          )}
          {!operationalCanApprove && !data.governanceCore.operationalBaselineApproved && (
            <p className="mt-1 text-xs text-rose-700">Operational checklist is incomplete. Complete all operational checklist items before approving.</p>
          )}
          <p className="mt-2 text-xs text-slate-600">
            Checklist values are read-only here. Only governance decisions are controlled from the audit layer.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-800">Edit Structural Checklist</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={Boolean(structuralDraft.fireExit)}
                  onChange={(e) => onStructuralDraftChange("fireExit", e.target.checked)}
                  type="checkbox"
                />
                Fire Exit
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={Boolean(structuralDraft.wiringSafe)}
                  onChange={(e) => onStructuralDraftChange("wiringSafe", e.target.checked)}
                  type="checkbox"
                />
                Wiring Safe
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={Boolean(structuralDraft.plumbingSafe)}
                  onChange={(e) => onStructuralDraftChange("plumbingSafe", e.target.checked)}
                  type="checkbox"
                />
                Plumbing Safe
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={Boolean(structuralDraft.occupancyCompliant)}
                  onChange={(e) => onStructuralDraftChange("occupancyCompliant", e.target.checked)}
                  type="checkbox"
                />
                Occupancy Compliant
              </label>
            </div>
            <button
              className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              disabled={updatingChecklist}
              onClick={onSaveStructuralChecklist}
              type="button"
            >
              {updatingChecklist ? "Saving..." : "Save Structural Checklist"}
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-sm font-semibold text-slate-800">Edit Operational Checklist</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={Boolean(operationalDraft.bedAvailable)}
                  onChange={(e) => onOperationalDraftChange("bedAvailable", e.target.checked)}
                  type="checkbox"
                />
                Bed Available
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={Boolean(operationalDraft.waterAvailable)}
                  onChange={(e) => onOperationalDraftChange("waterAvailable", e.target.checked)}
                  type="checkbox"
                />
                Water Available
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={Boolean(operationalDraft.toiletsAvailable)}
                  onChange={(e) => onOperationalDraftChange("toiletsAvailable", e.target.checked)}
                  type="checkbox"
                />
                Toilets Available
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  checked={Boolean(operationalDraft.ventilationGood)}
                  onChange={(e) => onOperationalDraftChange("ventilationGood", e.target.checked)}
                  type="checkbox"
                />
                Ventilation Good
              </label>
              <input
                className="w-full rounded border p-2 text-sm"
                onChange={(e) => onOperationalDraftChange("selfDeclaration", e.target.value)}
                placeholder="Self declaration text"
                value={operationalDraft.selfDeclaration || ""}
              />
            </div>
            <button
              className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              disabled={updatingChecklist}
              onClick={onSaveOperationalChecklist}
              type="button"
            >
              {updatingChecklist ? "Saving..." : "Save Operational Checklist"}
            </button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <InfoBadge label="All Logs" value={data.auditLayer.allAuditLogs.length} />
          <InfoBadge label="Corrective Plans" value={data.auditLayer.correctivePlans.length} />
          <InfoBadge label="Random Audits" value={data.auditLayer.randomAuditHistory.length} />
        </div>
        {data.auditLayer.allAuditLogs.map((log) => (
          <article key={log.id} className={`rounded-lg border p-3 ${log.resolved ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
            <p className="text-sm font-semibold text-slate-900">Audit #{log.id}</p>
            <p className="text-sm text-slate-700">Trigger: {log.triggerType || "manual"}</p>
            <p className="text-sm text-slate-700">Reason: {log.reason}</p>
            <p className="text-sm text-slate-700">Corrective: {log.correctiveAction || "N/A"}</p>
            <p className="text-xs text-slate-500">Created: {formatDate(log.createdAt)}</p>
          </article>
        ))}
      </Section>

      <Section title="Demand Context">
        <div className="grid gap-2 md:grid-cols-4">
          <InfoBadge label="Shortlist Count" value={data.demandContext.shortlistCount} />
          <InfoBadge label="Unique Shortlists" value={data.demandContext.uniqueShortlistedStudents} />
          <InfoBadge label="Conversion Rate %" value={data.demandContext.conversionRate} />
          <InfoBadge label="Occupancy Ratio" value={data.demandContext.occupancyRatio} />
        </div>
      </Section>
    </div>
  );
}

export default function UnitRolePage() {
  const params = useParams();
  const unitId = Number(params?.unitId);

  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adminData, setAdminData] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [landlordOverview, setLandlordOverview] = useState(null);
  const [landlordInterested, setLandlordInterested] = useState([]);
  const [landlordComplaints, setLandlordComplaints] = useState([]);
  const [landlordAuditLogs, setLandlordAuditLogs] = useState([]);
  const [updatingGovernance, setUpdatingGovernance] = useState(false);
  const [updatingChecklist, setUpdatingChecklist] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [previewItem, setPreviewItem] = useState(null);
  const [structuralDraft, setStructuralDraft] = useState({
    fireExit: false,
    wiringSafe: false,
    plumbingSafe: false,
    occupancyCompliant: false,
  });
  const [operationalDraft, setOperationalDraft] = useState({
    bedAvailable: false,
    waterAvailable: false,
    toiletsAvailable: false,
    ventilationGood: false,
    selfDeclaration: "",
  });

  useEffect(() => {
    const userRole = localStorage.getItem("role") || "";
    setRole(userRole);
  }, []);

  useEffect(() => {
    if (!role) return;
    if (!Number.isInteger(unitId) || unitId < 1) {
      setError("Invalid unit id");
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        if (role === "admin") {
          const result = await apiRequest(`/admin/unit/${unitId}/details`);
          setAdminData(result);
        } else if (role === "student") {
          const result = await apiRequest(`/student/unit/${unitId}/details`);
          setStudentData(result);
        } else if (role === "landlord") {
          const [overviewResult, interestedResult, complaintsResult, auditResult] = await Promise.all([
            apiRequest(`/landlord/unit/${unitId}/overview`),
            apiRequest(`/landlord/unit/${unitId}/interested-students`),
            apiRequest(`/landlord/unit/${unitId}/complaints`),
            apiRequest(`/landlord/unit/${unitId}/audit-logs`),
          ]);

          setLandlordOverview(overviewResult);
          setLandlordInterested(Array.isArray(interestedResult?.students) ? interestedResult.students : []);
          setLandlordComplaints(Array.isArray(complaintsResult?.complaints) ? complaintsResult.complaints : []);
          setLandlordAuditLogs(Array.isArray(auditResult?.logs) ? auditResult.logs : []);
        } else {
          setError("Unsupported role");
        }
      } catch (err) {
        setError(err.message || "Failed to load unit page");
      } finally {
        setLoading(false);
      }
    })();
  }, [role, unitId]);

  useEffect(() => {
    if (role !== "admin" || !adminData) return;
    setStructuralDraft({
      fireExit: Boolean(adminData.evidence?.structuralChecklist?.fireExit),
      wiringSafe: Boolean(adminData.evidence?.structuralChecklist?.wiringSafe),
      plumbingSafe: Boolean(adminData.evidence?.structuralChecklist?.plumbingSafe),
      occupancyCompliant: Boolean(adminData.evidence?.structuralChecklist?.occupancyCompliant),
    });
    setOperationalDraft({
      bedAvailable: Boolean(adminData.evidence?.operationalChecklist?.bedAvailable),
      waterAvailable: Boolean(adminData.evidence?.operationalChecklist?.waterAvailable),
      toiletsAvailable: Boolean(adminData.evidence?.operationalChecklist?.toiletsAvailable),
      ventilationGood: Boolean(adminData.evidence?.operationalChecklist?.ventilationGood),
      selfDeclaration: adminData.evidence?.selfDeclaration || "",
    });
  }, [adminData, role]);

  async function refreshAdminData() {
    const result = await apiRequest(`/admin/unit/${unitId}/details`);
    setAdminData(result);
  }

  async function updateAdminGovernance(payload) {
    setUpdatingGovernance(true);
    setError("");
    setActionMessage("");
    try {
      await apiRequest(`/admin/unit/${unitId}/review`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await refreshAdminData();
      setActionMessage("Governance action applied.");
    } catch (err) {
      setError(err.message || "Failed to update governance");
    } finally {
      setUpdatingGovernance(false);
    }
  }

  function updateStructuralDraft(field, value) {
    setStructuralDraft((prev) => ({ ...prev, [field]: value }));
  }

  function updateOperationalDraft(field, value) {
    setOperationalDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function saveStructuralChecklist() {
    setUpdatingChecklist(true);
    setError("");
    setActionMessage("");
    try {
      await apiRequest(`/admin/unit/${unitId}/structural-checklist`, {
        method: "PATCH",
        body: JSON.stringify(structuralDraft),
      });
      await refreshAdminData();
      setActionMessage("Structural checklist updated.");
    } catch (err) {
      setError(err.message || "Failed to update structural checklist");
    } finally {
      setUpdatingChecklist(false);
    }
  }

  async function saveOperationalChecklist() {
    setUpdatingChecklist(true);
    setError("");
    setActionMessage("");
    try {
      await apiRequest(`/admin/unit/${unitId}/operational-checklist`, {
        method: "PATCH",
        body: JSON.stringify(operationalDraft),
      });
      await refreshAdminData();
      setActionMessage("Operational checklist updated.");
    } catch (err) {
      setError(err.message || "Failed to update operational checklist");
    } finally {
      setUpdatingChecklist(false);
    }
  }

  const backHref = useMemo(() => {
    if (role === "admin") return "/admin";
    return "/dashboard";
  }, [role]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Unit #{Number.isNaN(unitId) ? "?" : unitId}</h1>
        <div className="flex gap-2">
          <Link className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" href={`/unit/${unitId}/complaints`}>
            Complaint Ledger
          </Link>
          <Link className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" href={backHref}>
            Back
          </Link>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-600">Loading unit page...</p>}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {!loading && !error && role === "admin" && adminData && (
        <AdminUnitView
          actionMessage={actionMessage}
          data={adminData}
          onPreview={(item) => setPreviewItem(item)}
          onOperationalDraftChange={updateOperationalDraft}
          onSetOperationalApproved={(value) => updateAdminGovernance({ operationalBaselineApproved: value })}
          onSetStructuralApproved={(value) => updateAdminGovernance({ structuralApproved: value })}
          onSetStatus={(status) => updateAdminGovernance({ status })}
          onStructuralDraftChange={updateStructuralDraft}
          onSaveOperationalChecklist={saveOperationalChecklist}
          onSaveStructuralChecklist={saveStructuralChecklist}
          operationalDraft={operationalDraft}
          structuralDraft={structuralDraft}
          updatingChecklist={updatingChecklist}
          updatingGovernance={updatingGovernance}
        />
      )}
      {!loading && !error && role === "student" && studentData && <StudentUnitView data={studentData} onPreview={(item) => setPreviewItem(item)} />}
      {!loading && !error && role === "landlord" && landlordOverview && (
        <LandlordUnitView
          auditLogs={landlordAuditLogs}
          complaints={landlordComplaints}
          interested={landlordInterested}
          onPreview={(item) => setPreviewItem(item)}
          overview={landlordOverview}
        />
      )}

      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewItem(null)}
          role="presentation"
        >
          <div
            className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="truncate text-sm font-semibold text-slate-800">{previewItem.label}</p>
              <button
                className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setPreviewItem(null)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="bg-slate-100 p-3">
              <img
                alt={previewItem.label}
                className="max-h-[75vh] w-full rounded object-contain"
                src={previewItem.src}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
