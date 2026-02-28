export default function UnitCard({ unit, showDetails = false, showForStudent = false }) {
  const bandColor =
    unit.trustBand === "priority"
      ? "bg-green-50 border-green-500"
      : unit.trustBand === "standard"
        ? "bg-amber-50 border-amber-500"
        : "bg-red-50 border-red-500";

  const badgeColor =
    unit.trustBand === "priority"
      ? "bg-green-600 text-white"
      : unit.trustBand === "standard"
        ? "bg-amber-500 text-white"
        : "bg-red-600 text-white";

  const statusColors = {
    draft: "bg-slate-100 text-slate-700",
    submitted: "bg-blue-100 text-blue-700",
    admin_review: "bg-purple-100 text-purple-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    suspended: "bg-amber-100 text-amber-700",
    archived: "bg-gray-100 text-gray-700",
  };

  const trustScoreColor =
    unit.trustScore >= 80
      ? "text-green-600"
      : unit.trustScore >= 50
        ? "text-amber-600"
        : "text-red-600";

  return (
    <article className={`rounded-xl border-l-4 border border-slate-200 p-4 shadow-sm ${bandColor}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Unit #{unit.id}</h3>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${badgeColor}`}>
          {unit.trustBand || "unknown"}
        </span>
      </div>

      <p className="text-sm text-slate-700">
        Trust Score: <span className={`font-semibold ${trustScoreColor}`}>{unit.trustScore}</span>
      </p>

      {showForStudent && (
        <>
          {unit.rent !== undefined && (
            <p className="text-sm text-slate-700">Rent: <span className="font-semibold">${unit.rent}/month</span></p>
          )}
          {unit.distanceKm !== undefined && (
            <p className="text-sm text-slate-700">Distance: <span className="font-semibold">{unit.distanceKm} km</span></p>
          )}
          {unit.capacity !== undefined && (
            <p className="text-sm text-slate-700">Slots: <span className="font-semibold">{(unit.capacity - (unit.occupancyCount || 0))}/{unit.capacity}</span></p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {unit.ac && <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">AC</span>}
            {unit.bedAvailable && <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Bed</span>}
            {unit.waterAvailable && <span className="rounded bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-700">Water</span>}
            {unit.ventilationGood && <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">Vent</span>}
          </div>
        </>
      )}

      {unit.status && (
        <p className="text-sm text-slate-700">
          Status: <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[unit.status] || "bg-slate-100 text-slate-700"}`}>{unit.status.replace("_", " ")}</span>
        </p>
      )}

      {unit.auditRequired && (
        <p className="mt-1 text-sm">
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">⚠️ Audit Required</span>
        </p>
      )}

      {showDetails && unit.visibleToStudents !== undefined && (
        <p className="text-sm text-slate-700">
          Visible: <span className={`font-semibold ${unit.visibleToStudents ? "text-green-600" : "text-red-600"}`}>{unit.visibleToStudents ? "Yes" : "No"}</span>
        </p>
      )}

      {showDetails && unit.capacity !== undefined && (
        <p className="text-sm text-slate-700">
          Occupancy: <span className="font-semibold">{unit.occupancyCount || 0}/{unit.capacity}</span>
        </p>
      )}

      {showDetails && (
        <>
          <p className="text-sm text-slate-700">
            Structural: <span className={`font-semibold ${unit.structuralApproved ? "text-green-600" : "text-red-600"}`}>{unit.structuralApproved ? "Approved" : "Pending"}</span>
          </p>
          <p className="text-sm text-slate-700">
            Operational: <span className={`font-semibold ${unit.operationalBaselineApproved ? "text-green-600" : "text-red-600"}`}>{unit.operationalBaselineApproved ? "Approved" : "Pending"}</span>
          </p>
        </>
      )}

      {showDetails && unit.activeComplaints !== undefined && (
        <p className="text-sm text-slate-700">
          Complaints: <span className={`font-semibold ${unit.activeComplaints > 0 ? "text-red-600" : "text-green-600"}`}>{unit.activeComplaints}</span>
        </p>
      )}

      {showDetails && unit.openAuditLogCount > 0 && (
        <p className="text-sm">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">📋 {unit.openAuditLogCount} Audit{unit.openAuditLogCount > 1 ? "s" : ""}</span>
        </p>
      )}
    </article>
  );
}
