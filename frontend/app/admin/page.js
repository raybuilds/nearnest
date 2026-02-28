"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import UnitCard from "@/components/UnitCard";

export default function AdminPage() {
  const [role, setRole] = useState("");
  const [corridorName, setCorridorName] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [corridorIdForInstitution, setCorridorIdForInstitution] = useState("");
  const [corridorIdForView, setCorridorIdForView] = useState("");
  const [corridors, setCorridors] = useState([]);
  const [loadingCorridors, setLoadingCorridors] = useState(true);
  const [units, setUnits] = useState([]);
  const [auditUnits, setAuditUnits] = useState([]);
  const [creatingCorridor, setCreatingCorridor] = useState(false);
  const [creatingInstitution, setCreatingInstitution] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [updatingUnitId, setUpdatingUnitId] = useState(null);
  const [hasLoadedUnits, setHasLoadedUnits] = useState(false);
  const [hasLoadedAudit, setHasLoadedAudit] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // Audit management state
  const [selectedUnitForAudit, setSelectedUnitForAudit] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [correctiveDeadline, setCorrectiveDeadline] = useState("");
  const [resolvingAuditId, setResolvingAuditId] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [showRandomAudit, setShowRandomAudit] = useState(false);
  const [randomSample, setRandomSample] = useState([]);
  const [loadingRandomSample, setLoadingRandomSample] = useState(false);
  const [randomSampleCount, setRandomSampleCount] = useState(3);

  // State sync state
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    setRole(localStorage.getItem("role") || "");
    (async () => {
      try {
        const data = await apiRequest("/corridors");
        setCorridors(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingCorridors(false);
      }
    })();
  }, []);

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefreshEnabled || !corridorIdForView || (!hasLoadedUnits && !hasLoadedAudit)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const [unitsResult, auditResult] = await Promise.all([
          apiRequest(`/admin/units/${Number(corridorIdForView)}`),
          apiRequest(`/admin/audit/${Number(corridorIdForView)}`),
        ]);
        if (hasLoadedUnits) {
          setUnits(Array.isArray(unitsResult) ? unitsResult : []);
        }
        if (hasLoadedAudit) {
          setAuditUnits(Array.isArray(auditResult) ? auditResult : []);
        }
        setLastUpdated(new Date());
      } catch (err) {
        // Silent fail for auto-refresh
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefreshEnabled, corridorIdForView, hasLoadedUnits, hasLoadedAudit]);

  async function createCorridor(e) {
    e.preventDefault();
    setStatus("");
    setError("");
    setCreatingCorridor(true);
    try {
      const result = await apiRequest("/corridor", {
        method: "POST",
        body: JSON.stringify({ name: corridorName }),
      });
      setStatus(`Created corridor #${result.id}`);
      setCorridorName("");
      const data = await apiRequest("/corridors");
      setCorridors(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingCorridor(false);
    }
  }

  async function createInstitution(e) {
    e.preventDefault();
    setStatus("");
    setError("");
    setCreatingInstitution(true);
    try {
      const result = await apiRequest("/institutions", {
        method: "POST",
        body: JSON.stringify({
          name: institutionName,
          corridorId: Number(corridorIdForInstitution),
        }),
      });
      setStatus(`Created institution #${result.id}`);
      setInstitutionName("");
      setCorridorIdForInstitution("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingInstitution(false);
    }
  }

  async function loadUnits() {
    setHasLoadedUnits(true);
    setStatus("");
    setError("");
    setLoadingUnits(true);
    try {
      const result = await apiRequest(`/admin/units/${Number(corridorIdForView)}`);
      setUnits(Array.isArray(result) ? result : []);
      setLastUpdated(new Date());
    } catch (err) {
      setUnits([]);
      setError(err.message);
    } finally {
      setLoadingUnits(false);
    }
  }

  async function loadAuditUnits() {
    setHasLoadedAudit(true);
    setStatus("");
    setError("");
    setLoadingAudit(true);
    try {
      const result = await apiRequest(`/admin/audit/${Number(corridorIdForView)}`);
      setAuditUnits(Array.isArray(result) ? result : []);
      setLastUpdated(new Date());
    } catch (err) {
      setAuditUnits([]);
      setError(err.message);
    } finally {
      setLoadingAudit(false);
    }
  }

  async function loadRandomSample() {
    setShowRandomAudit(true);
    setLoadingRandomSample(true);
    setError("");
    try {
      const result = await apiRequest(`/admin/audit/sample/${Number(corridorIdForView)}?count=${randomSampleCount}`);
      setRandomSample(result.sampledUnits || []);
    } catch (err) {
      setError(err.message);
      setRandomSample([]);
    } finally {
      setLoadingRandomSample(false);
    }
  }

  async function viewAuditLogs(unitId) {
    setSelectedUnitForAudit(unitId);
    setLoadingAuditLogs(true);
    setShowAuditModal(true);
    setError("");
    try {
      const result = await apiRequest(`/admin/unit/${unitId}/audit-logs`);
      setAuditLogs(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message);
      setAuditLogs([]);
    } finally {
      setLoadingAuditLogs(false);
    }
  }

  async function createCorrectivePlan(auditLogId) {
    if (!correctiveAction.trim()) {
      setError("Corrective action is required");
      return;
    }
    setError("");
    setStatus("");
    try {
      await apiRequest(`/admin/audit-log/${auditLogId}/corrective-plan`, {
        method: "PATCH",
        body: JSON.stringify({
          correctiveAction: correctiveAction.trim(),
          correctiveDeadline: correctiveDeadline || null,
        }),
      });
      setStatus("Corrective plan created");
      setCorrectiveAction("");
      setCorrectiveDeadline("");
      // Refresh audit logs
      const result = await apiRequest(`/admin/unit/${selectedUnitForAudit}/audit-logs`);
      setAuditLogs(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function resolveAudit(auditLogId) {
    setResolvingAuditId(auditLogId);
    setError("");
    setStatus("");
    try {
      await apiRequest(`/admin/audit-log/${auditLogId}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({
          verificationNotes: verificationNotes.trim() || null,
          reopenUnit: true,
        }),
      });
      setStatus("Audit resolved");
      setVerificationNotes("");
      // Refresh audit logs
      const result = await apiRequest(`/admin/unit/${selectedUnitForAudit}/audit-logs`);
      setAuditLogs(Array.isArray(result) ? result : []);
      // Refresh audit units
      if (corridorIdForView) {
        loadAuditUnits();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setResolvingAuditId(null);
    }
  }

  async function updateUnitStatus(unitId, payload, successMessage) {
    setError("");
    setStatus("");
    setUpdatingUnitId(unitId);
    try {
      await apiRequest(`/admin/unit/${Number(unitId)}/review`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setStatus(successMessage);
      if (corridorIdForView) {
        await loadUnits();
        await loadAuditUnits();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingUnitId(null);
    }
  }

  function formatDate(dateString) {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatLastUpdated() {
    if (!lastUpdated) return "";
    return lastUpdated.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  if (role !== "admin") {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Admin role required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin</h1>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-sm text-slate-500">Last updated: {formatLastUpdated()}</span>
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefreshEnabled}
              onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
              className="rounded border-slate-300"
            />
            Auto-refresh (30s)
          </label>
        </div>
      </div>

      {/* Corridor & Institution Creation */}
      <form onSubmit={createCorridor} className="grid max-w-2xl gap-2 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-3">
        <input className="rounded border p-2 md:col-span-2" placeholder="Corridor name" value={corridorName} onChange={(e) => setCorridorName(e.target.value)} required />
        <button className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60" type="submit" disabled={creatingCorridor}>
          {creatingCorridor ? "Creating..." : "Create Corridor"}
        </button>
      </form>

      <form onSubmit={createInstitution} className="grid max-w-2xl gap-2 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-3">
        <input
          className="rounded border p-2"
          placeholder="Institution name"
          value={institutionName}
          onChange={(e) => setInstitutionName(e.target.value)}
          required
        />
        <select
          className="rounded border p-2"
          value={corridorIdForInstitution}
          onChange={(e) => setCorridorIdForInstitution(e.target.value)}
          required
        >
          <option value="">{loadingCorridors ? "Loading corridors..." : "Select corridor"}</option>
          {corridors.map((corridor) => (
            <option key={corridor.id} value={corridor.id}>
              #{corridor.id} - {corridor.name}
            </option>
          ))}
        </select>
        <button className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60" type="submit" disabled={creatingInstitution}>
          {creatingInstitution ? "Creating..." : "Create Institution"}
        </button>
      </form>

      {/* Corridor Selection */}
      <form className="grid max-w-2xl gap-2 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-3">
        <select className="rounded border p-2 md:col-span-3" value={corridorIdForView} onChange={(e) => setCorridorIdForView(e.target.value)} required>
          <option value="">{loadingCorridors ? "Loading corridors..." : "Select corridor"}</option>
          {corridors.map((corridor) => (
            <option key={corridor.id} value={corridor.id}>
              #{corridor.id} - {corridor.name}
            </option>
          ))}
        </select>
        <button className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60" type="button" disabled={loadingUnits || !corridorIdForView} onClick={loadUnits}>
          {loadingUnits ? "Loading..." : "View All Units"}
        </button>
        <button className="rounded bg-amber-600 px-4 py-2 text-white disabled:opacity-60" type="button" disabled={loadingAudit || !corridorIdForView} onClick={loadAuditUnits}>
          {loadingAudit ? "Loading..." : "View Audit Units"}
        </button>
        <button className="rounded bg-purple-600 px-4 py-2 text-white disabled:opacity-60" type="button" disabled={loadingRandomSample || !corridorIdForView} onClick={loadRandomSample}>
          {loadingRandomSample ? "Loading..." : "Random Sample"}
        </button>
      </form>

      {/* Manual Refresh Buttons */}
      {(hasLoadedUnits || hasLoadedAudit) && (
        <div className="flex gap-2">
          {hasLoadedUnits && (
            <button
              className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              onClick={loadUnits}
              disabled={loadingUnits}
              type="button"
            >
              {loadingUnits ? "Refreshing..." : "Refresh Units"}
            </button>
          )}
          {hasLoadedAudit && (
            <button
              className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
              onClick={loadAuditUnits}
              disabled={loadingAudit}
              type="button"
            >
              {loadingAudit ? "Refreshing..." : "Refresh Audit Units"}
            </button>
          )}
        </div>
      )}

      {/* Random Sample Section */}
      {showRandomAudit && (
        <section className="rounded-xl border border-purple-200 bg-purple-50 p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold">Random Audit Sample (High Trust Units)</h3>
          {loadingRandomSample ? (
            <p className="text-sm text-slate-600">Loading sample...</p>
          ) : randomSample.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {randomSample.map((unit) => (
                <div key={unit.id} className="rounded-lg border border-purple-200 bg-white p-3">
                  <p className="font-semibold">Unit #{unit.id}</p>
                  <p className="text-sm text-slate-600">Trust Score: {unit.trustScore}</p>
                  <p className="text-sm text-slate-600">Band: {unit.trustBand}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No units available for sampling (requires trustScore ≥80 and status approved)</p>
          )}
        </section>
      )}

      {status && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{status}</p>}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* All Units Section */}
      {hasLoadedUnits && !loadingUnits && !error && units.length === 0 && (
        <p className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">No units found for this corridor.</p>
      )}
      <section className="grid gap-3 md:grid-cols-2">
        {units.map((unit) => (
          <article key={unit.id} className="space-y-2 rounded-xl border bg-white p-4 shadow-sm">
            <Link className="block" href={`/unit/${unit.id}`}>
              <UnitCard unit={unit} showDetails={true} />
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" href={`/unit/${unit.id}`}>
                Open Unit Page
              </Link>
              <button
                className="rounded bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                type="button"
                disabled={updatingUnitId === unit.id || unit.status === "approved"}
                onClick={() =>
                  updateUnitStatus(
                    unit.id,
                    { structuralApproved: true, operationalBaselineApproved: true, status: "approved" },
                    `Unit #${unit.id} approved`
                  )
                }
              >
                Approve
              </button>
              <button
                className="rounded bg-rose-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                type="button"
                disabled={updatingUnitId === unit.id || unit.status === "rejected"}
                onClick={() =>
                  updateUnitStatus(
                    unit.id,
                    { status: "rejected", structuralApproved: false, operationalBaselineApproved: false },
                    `Unit #${unit.id} rejected`
                  )
                }
              >
                Reject
              </button>
              <button
                className="rounded bg-amber-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                type="button"
                disabled={updatingUnitId === unit.id || unit.status === "suspended"}
                onClick={() => updateUnitStatus(unit.id, { status: "suspended" }, `Unit #${unit.id} suspended`)}
              >
                Suspend
              </button>
              {unit.auditRequired && (
                <button
                  className="rounded bg-purple-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                  type="button"
                  onClick={() => viewAuditLogs(unit.id)}
                >
                  View Audit Logs
                </button>
              )}
            </div>
          </article>
        ))}
      </section>

      {/* Audit Units Section */}
      {hasLoadedAudit && !loadingAudit && auditUnits.length === 0 && (
        <p className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">No audit-required units currently.</p>
      )}
      <section className="grid gap-3 md:grid-cols-2">
        {auditUnits.map((unit) => (
          <article key={`audit-${unit.id}`} className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <Link className="block" href={`/unit/${unit.id}`}>
              <UnitCard unit={unit} showDetails={true} />
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" href={`/unit/${unit.id}`}>
                Open Unit Page
              </Link>
              <button
                className="rounded bg-purple-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                type="button"
                onClick={() => viewAuditLogs(unit.id)}
              >
                Manage Audit
              </button>
            </div>
          </article>
        ))}
      </section>

      {/* Audit Logs Modal */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Audit Logs - Unit #{selectedUnitForAudit}</h2>
              <button
                className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setShowAuditModal(false);
                  setSelectedUnitForAudit(null);
                  setAuditLogs([]);
                  setCorrectiveAction("");
                  setCorrectiveDeadline("");
                  setVerificationNotes("");
                }}
              >
                Close
              </button>
            </div>

            {loadingAuditLogs ? (
              <p className="text-sm text-slate-600">Loading audit logs...</p>
            ) : auditLogs.length === 0 ? (
              <p className="text-sm text-slate-600">No audit logs found for this unit.</p>
            ) : (
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className={`rounded-lg border p-4 ${log.resolved ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${log.resolved ? "bg-green-600 text-white" : "bg-amber-600 text-white"}`}>
                        {log.resolved ? "Resolved" : "Open"}
                      </span>
                      <span className="text-xs text-slate-500">{formatDate(log.createdAt)}</span>
                    </div>
                    
                    <p className="mb-1 text-sm">
                      <span className="font-semibold">Trigger:</span> {log.triggerType || "manual"}
                    </p>
                    <p className="mb-2 text-sm text-slate-700">{log.reason}</p>

                    {log.correctiveAction && (
                      <div className="mb-2 rounded border border-blue-200 bg-blue-50 p-2">
                        <p className="text-sm font-semibold text-blue-800">Corrective Action:</p>
                        <p className="text-sm text-blue-700">{log.correctiveAction}</p>
                        {log.correctiveDeadline && (
                          <p className="text-xs text-blue-600">Deadline: {formatDate(log.correctiveDeadline)}</p>
                        )}
                      </div>
                    )}

                    {log.verificationNotes && (
                      <div className="mb-2 rounded border border-green-200 bg-green-100 p-2">
                        <p className="text-sm font-semibold text-green-800">Verification Notes:</p>
                        <p className="text-sm text-green-700">{log.verificationNotes}</p>
                      </div>
                    )}

                    {!log.resolved && (
                      <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                        {/* Create Corrective Plan */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">Add Corrective Plan</p>
                          <textarea
                            className="w-full rounded border p-2 text-sm"
                            placeholder="Describe corrective action..."
                            value={correctiveAction}
                            onChange={(e) => setCorrectiveAction(e.target.value)}
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <input
                              type="date"
                              className="rounded border p-2 text-sm"
                              value={correctiveDeadline}
                              onChange={(e) => setCorrectiveDeadline(e.target.value)}
                            />
                            <button
                              className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                              onClick={() => createCorrectivePlan(log.id)}
                            >
                              Save Plan
                            </button>
                          </div>
                        </div>

                        {/* Resolve Audit */}
                        <div className="space-y-2 border-t border-slate-200 pt-3">
                          <p className="text-sm font-semibold">Resolve Audit</p>
                          <textarea
                            className="w-full rounded border p-2 text-sm"
                            placeholder="Verification notes..."
                            value={verificationNotes}
                            onChange={(e) => setVerificationNotes(e.target.value)}
                            rows={2}
                          />
                          <button
                            className="rounded bg-green-600 px-3 py-2 text-sm text-white disabled:opacity-60"
                            disabled={resolvingAuditId === log.id}
                            onClick={() => resolveAudit(log.id)}
                          >
                            {resolvingAuditId === log.id ? "Resolving..." : "Resolve & Reopen Unit"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
