"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import UnitCard from "@/components/UnitCard";
import ComplaintForm from "@/components/ComplaintForm";

function StudentDashboard() {
  const [corridorId, setCorridorId] = useState("");
  const [corridors, setCorridors] = useState([]);
  const [loadingCorridors, setLoadingCorridors] = useState(true);
  const [units, setUnits] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasLoadedUnits, setHasLoadedUnits] = useState(false);
  const [maxRent, setMaxRent] = useState("");
  const [maxDistance, setMaxDistance] = useState("");
  const [acFilter, setAcFilter] = useState("");
  const [demandMetrics, setDemandMetrics] = useState(null);
  const [loadingDemand, setLoadingDemand] = useState(false);
  const [shortlistingUnitId, setShortlistingUnitId] = useState(null);
  const [hiddenReasons, setHiddenReasons] = useState([]);
  const [loadingHiddenReasons, setLoadingHiddenReasons] = useState(false);

  useEffect(() => {
    setCorridorId(localStorage.getItem("corridorId") || "");
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

  useEffect(() => {
    if (!corridorId) {
      setDemandMetrics(null);
      return;
    }

    (async () => {
      setLoadingDemand(true);
      try {
        const data = await apiRequest(`/corridor/${Number(corridorId)}/demand`);
        setDemandMetrics(data);
      } catch {
        setDemandMetrics(null);
      } finally {
        setLoadingDemand(false);
      }
    })();
  }, [corridorId]);

  async function shortlistUnit(unitId) {
    setShortlistingUnitId(unitId);
    setError("");
    try {
      await apiRequest("/shortlist", {
        method: "POST",
        body: JSON.stringify({ unitId }),
      });
      const metrics = await apiRequest(`/corridor/${Number(corridorId)}/demand`);
      setDemandMetrics(metrics);
    } catch (err) {
      setError(err.message);
    } finally {
      setShortlistingUnitId(null);
    }
  }

  async function loadUnits(e) {
    e.preventDefault();
    setHasLoadedUnits(true);
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (maxRent) params.set("maxRent", maxRent);
      if (maxDistance) params.set("maxDistance", maxDistance);
      if (acFilter) params.set("ac", acFilter);
      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await apiRequest(`/units/${Number(corridorId)}${query}`);
      setUnits(Array.isArray(data) ? data : []);
      setLoadingHiddenReasons(true);
      try {
        const hiddenData = await apiRequest(`/units/${Number(corridorId)}/hidden-reasons`);
        setHiddenReasons(Array.isArray(hiddenData?.hiddenUnits) ? hiddenData.hiddenUnits : []);
      } catch {
        setHiddenReasons([]);
      } finally {
        setLoadingHiddenReasons(false);
      }
    } catch (err) {
      setUnits([]);
      setHiddenReasons([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Student Dashboard</h2>
      <form onSubmit={loadUnits} className="grid max-w-4xl gap-2 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-5">
        <select className="rounded border p-2 md:col-span-2" value={corridorId} onChange={(e) => setCorridorId(e.target.value)} required>
          <option value="">{loadingCorridors ? "Loading corridors..." : "Select corridor"}</option>
          {corridors.map((corridor) => (
            <option key={corridor.id} value={corridor.id}>
              #{corridor.id} - {corridor.name}
            </option>
          ))}
        </select>
        <input className="rounded border p-2" placeholder="maxRent" value={maxRent} onChange={(e) => setMaxRent(e.target.value)} />
        <input className="rounded border p-2" placeholder="maxDistance" value={maxDistance} onChange={(e) => setMaxDistance(e.target.value)} />
        <select className="rounded border p-2" value={acFilter} onChange={(e) => setAcFilter(e.target.value)}>
          <option value="">AC any</option>
          <option value="true">AC only</option>
          <option value="false">Non-AC only</option>
        </select>
        <button className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60 md:col-span-5" type="submit" disabled={loading}>
          {loading ? "Loading..." : "Load Units"}
        </button>
      </form>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loadingDemand && <p className="text-sm text-slate-600">Loading demand metrics...</p>}
      {demandMetrics && (
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-lg font-semibold">Verified Demand Pool</h3>
          <p className="text-sm text-slate-700">Total verified students: {demandMetrics.totalVdpStudents}</p>
          <p className="text-sm text-slate-700">Shortlists: {demandMetrics.shortlistCount}</p>
          <p className="text-sm text-slate-700">
            Occupancy: {demandMetrics.occupancy.totalActiveOccupancies}/{demandMetrics.occupancy.totalCapacity}
          </p>
        </section>
      )}
      {hasLoadedUnits && !loading && !error && units.length === 0 && (
        <p className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No visible units in this corridor. Units may be blocked by baseline/trust gates.
        </p>
      )}
      {hasLoadedUnits && !loading && !error && (
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-lg font-semibold">Why Some Units Are Hidden</h3>
          {loadingHiddenReasons && <p className="text-sm text-slate-600">Loading hidden-unit reasons...</p>}
          {!loadingHiddenReasons && hiddenReasons.length === 0 && (
            <p className="text-sm text-slate-700">No currently hidden units in this corridor.</p>
          )}
          {!loadingHiddenReasons && hiddenReasons.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {hiddenReasons.slice(0, 6).map((entry) => (
                <li key={entry.unitId}>
                  Unit #{entry.unitId}: {Array.isArray(entry.reasons) ? entry.reasons.join(", ") : "visibility-gated"}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-2">
        {units.map((unit) => (
          <div key={unit.id} className="space-y-2">
            <Link className="block" href={`/unit/${unit.id}`}>
              <UnitCard unit={unit} />
            </Link>
            <Link
              className="block w-full rounded border border-slate-300 bg-white px-3 py-2 text-center text-sm text-slate-700 hover:bg-slate-50"
              href={`/unit/${unit.id}`}
            >
              View Unit #{unit.id}
            </Link>
            <button
              className="w-full rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
              onClick={() => shortlistUnit(unit.id)}
              disabled={shortlistingUnitId === unit.id}
              type="button"
            >
              {shortlistingUnitId === unit.id ? "Shortlisting..." : "Shortlist"}
            </button>
          </div>
        ))}
      </section>

      <ComplaintForm />
    </div>
  );
}

function LandlordDashboard() {
  const [corridors, setCorridors] = useState([]);
  const [corridorId, setCorridorId] = useState("");
  const [rent, setRent] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [ac, setAc] = useState(false);
  const [occupancyType, setOccupancyType] = useState("single");
  const [capacity, setCapacity] = useState("1");
  const [fireExit, setFireExit] = useState(true);
  const [wiringSafe, setWiringSafe] = useState(true);
  const [plumbingSafe, setPlumbingSafe] = useState(true);
  const [occupancyCompliant, setOccupancyCompliant] = useState(true);
  const [bedAvailable, setBedAvailable] = useState(true);
  const [waterAvailable, setWaterAvailable] = useState(true);
  const [toiletsAvailable, setToiletsAvailable] = useState(true);
  const [ventilationGood, setVentilationGood] = useState(true);
  const [selfDeclaration, setSelfDeclaration] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [documentFile, setDocumentFile] = useState(null);
  const [walkthroughFile, setWalkthroughFile] = useState(null);
  const [checkInUnitId, setCheckInUnitId] = useState("");
  const [checkInStudentId, setCheckInStudentId] = useState("");
  const [checkOutOccupancyId, setCheckOutOccupancyId] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [myUnits, setMyUnits] = useState([]);
  const [loadingMyUnits, setLoadingMyUnits] = useState(false);
  const [myUnitsError, setMyUnitsError] = useState("");
  const [demandMetrics, setDemandMetrics] = useState(null);
  const [loadingDemand, setLoadingDemand] = useState(false);

  // Audit-related state
  const [selectedUnitForAudit, setSelectedUnitForAudit] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [previousUnitStatuses, setPreviousUnitStatuses] = useState({});
  const [statusNotifications, setStatusNotifications] = useState([]);
  
  // Controlled visibility state
  const [selectedUnitForInterest, setSelectedUnitForInterest] = useState(null);
  const [interestedStudents, setInterestedStudents] = useState([]);
  const [loadingInterested, setLoadingInterested] = useState(false);
  const [showInterestModal, setShowInterestModal] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest("/corridors");
        setCorridors(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      }
    })();

    loadMyUnits();
  }, []);

  // Poll for status changes every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      checkForStatusChanges();
    }, 30000);
    return () => clearInterval(interval);
  }, [myUnits]);

  async function checkForStatusChanges() {
    try {
      const data = await apiRequest("/landlord/units");
      if (!Array.isArray(data)) return;
      
      const newNotifications = [];
      data.forEach((unit) => {
        const prevStatus = previousUnitStatuses[unit.id];
        if (prevStatus && prevStatus !== unit.status) {
          newNotifications.push({
            unitId: unit.id,
            oldStatus: prevStatus,
            newStatus: unit.status,
            timestamp: new Date(),
          });
        }
      });

      if (newNotifications.length > 0) {
        setStatusNotifications((prev) => [...newNotifications, ...prev].slice(0, 5));
      }

      // Update previous statuses
      const statusMap = {};
      data.forEach((unit) => {
        statusMap[unit.id] = unit.status;
      });
      setPreviousUnitStatuses(statusMap);
    } catch (err) {
      // Silent fail for polling
    }
  }

  useEffect(() => {
    if (corridorId) {
      loadDemandMetrics(corridorId);
    } else {
      setDemandMetrics(null);
    }
  }, [corridorId]);

  async function loadMyUnits() {
    setLoadingMyUnits(true);
    setMyUnitsError("");
    try {
      const data = await apiRequest("/landlord/units");
      setMyUnits(Array.isArray(data) ? data : []);
      
      // Store current statuses for change detection
      const statusMap = {};
      data.forEach((unit) => {
        statusMap[unit.id] = unit.status;
      });
      setPreviousUnitStatuses(statusMap);
    } catch (err) {
      setMyUnits([]);
      setMyUnitsError(err.message);
    } finally {
      setLoadingMyUnits(false);
    }
  }

  async function loadDemandMetrics(selectedCorridorId) {
    if (!selectedCorridorId) return;
    setLoadingDemand(true);
    try {
      // Use new controlled visibility endpoint for landlords
      const data = await apiRequest(`/landlord/corridor/${Number(selectedCorridorId)}/demand-summary`);
      setDemandMetrics(data);
    } catch {
      setDemandMetrics(null);
    } finally {
      setLoadingDemand(false);
    }
  }

  async function loadInterestedStudents(unitId) {
    setSelectedUnitForInterest(unitId);
    setLoadingInterested(true);
    setShowInterestModal(true);
    try {
      const data = await apiRequest(`/landlord/unit/${unitId}/interested-students`);
      setInterestedStudents(data.students || []);
    } catch {
      setInterestedStudents([]);
    } finally {
      setLoadingInterested(false);
    }
  }

  async function createUnit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");
    try {
      if (!photoFile || !documentFile || !walkthroughFile) {
        throw new Error("photo, document, and 360 walkthrough files are required");
      }
      if (!selfDeclaration.trim()) {
        throw new Error("selfDeclaration is required");
      }

      const result = await apiRequest("/unit", {
        method: "POST",
        body: JSON.stringify({
          corridorId: Number(corridorId),
          rent: rent ? Number(rent) : 0,
          distanceKm: distanceKm ? Number(distanceKm) : 0,
          ac,
          occupancyType,
          capacity: capacity ? Number(capacity) : 1,
        }),
      });

      await apiRequest(`/unit/${result.id}/structural-checklist`, {
        method: "PUT",
        body: JSON.stringify({
          fireExit,
          wiringSafe,
          plumbingSafe,
          occupancyCompliant,
        }),
      });

      await apiRequest(`/unit/${result.id}/operational-checklist`, {
        method: "PUT",
        body: JSON.stringify({
          bedAvailable,
          waterAvailable,
          toiletsAvailable,
          ventilationGood,
          selfDeclaration: selfDeclaration.trim(),
        }),
      });

      const photoForm = new FormData();
      photoForm.append("type", "photo");
      photoForm.append("file", photoFile);
      await apiRequest(`/unit/${result.id}/media`, {
        method: "POST",
        body: photoForm,
      });

      const documentForm = new FormData();
      documentForm.append("type", "document");
      documentForm.append("file", documentFile);
      await apiRequest(`/unit/${result.id}/media`, {
        method: "POST",
        body: documentForm,
      });

      const walkthroughForm = new FormData();
      walkthroughForm.append("type", "walkthrough360");
      walkthroughForm.append("file", walkthroughFile);
      await apiRequest(`/unit/${result.id}/media`, {
        method: "POST",
        body: walkthroughForm,
      });

      await apiRequest(`/unit/${result.id}/submit`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      setStatus(`Created unit #${result.id} and submitted for admin review`);
      setSelfDeclaration("");
      setPhotoFile(null);
      setDocumentFile(null);
      setWalkthroughFile(null);
      loadDemandMetrics(Number(corridorId));
      loadMyUnits();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function checkInOccupant(e) {
    e.preventDefault();
    setCheckingIn(true);
    setError("");
    setStatus("");
    try {
      const result = await apiRequest("/occupancy/check-in", {
        method: "POST",
        body: JSON.stringify({
          unitId: Number(checkInUnitId),
          studentId: Number(checkInStudentId),
        }),
      });
      setStatus(`Checked in occupancy #${result.id}`);
      setCheckInUnitId("");
      setCheckInStudentId("");
      loadMyUnits();
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckingIn(false);
    }
  }

  async function checkOutOccupant(e) {
    e.preventDefault();
    setCheckingOut(true);
    setError("");
    setStatus("");
    try {
      const result = await apiRequest(`/occupancy/${Number(checkOutOccupancyId)}/check-out`, {
        method: "PATCH",
      });
      setStatus(`Checked out occupancy #${result.id}`);
      setCheckOutOccupancyId("");
      loadMyUnits();
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckingOut(false);
    }
  }

  async function viewAuditLogs(unitId) {
    setSelectedUnitForAudit(unitId);
    setLoadingAuditLogs(true);
    setShowAuditModal(true);
    setError("");
    try {
      const result = await apiRequest(`/landlord/unit/${unitId}/audit-logs`);
      setAuditLogs(Array.isArray(result?.logs) ? result.logs : []);
    } catch (err) {
      setError(err.message);
      setAuditLogs([]);
    } finally {
      setLoadingAuditLogs(false);
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

  function dismissNotification(index) {
    setStatusNotifications((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Landlord Dashboard</h2>

      {/* Status Notifications */}
      {statusNotifications.length > 0 && (
        <div className="space-y-2">
          {statusNotifications.map((notif, index) => (
            <div key={index} className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
              <div className="text-sm">
                <span className="font-semibold">Unit #{notif.unitId}</span> status changed from{" "}
                <span className="font-semibold">{notif.oldStatus}</span> to{" "}
                <span className="font-semibold">{notif.newStatus}</span>
              </div>
              <button
                className="text-blue-600 hover:text-blue-800"
                onClick={() => dismissNotification(index)}
                type="button"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={createUnit} className="grid max-w-3xl gap-2 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-2">
        <select className="rounded border p-2" value={corridorId} onChange={(e) => setCorridorId(e.target.value)} required>
          <option value="">Select corridor</option>
          {corridors.map((corridor) => (
            <option key={corridor.id} value={corridor.id}>
              #{corridor.id} - {corridor.name}
            </option>
          ))}
        </select>
        <input className="rounded border p-2" placeholder="rent" value={rent} onChange={(e) => setRent(e.target.value)} />
        <input className="rounded border p-2" placeholder="distanceKm" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
        <input className="rounded border p-2" placeholder="occupancyType" value={occupancyType} onChange={(e) => setOccupancyType(e.target.value)} />
        <input className="rounded border p-2" placeholder="capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        <label className="flex items-center gap-2 rounded border p-2">
          <input checked={ac} onChange={(e) => setAc(e.target.checked)} type="checkbox" />
          AC available
        </label>
        <label className="flex items-center gap-2 rounded border p-2">
          <input checked={fireExit} onChange={(e) => setFireExit(e.target.checked)} type="checkbox" />
          Fire Exit Ready
        </label>
        <label className="flex items-center gap-2 rounded border p-2">
          <input checked={wiringSafe} onChange={(e) => setWiringSafe(e.target.checked)} type="checkbox" />
          Wiring Safe
        </label>
        <label className="flex items-center gap-2 rounded border p-2">
          <input checked={plumbingSafe} onChange={(e) => setPlumbingSafe(e.target.checked)} type="checkbox" />
          Plumbing Safe
        </label>
        <label className="flex items-center gap-2 rounded border p-2">
          <input checked={occupancyCompliant} onChange={(e) => setOccupancyCompliant(e.target.checked)} type="checkbox" />
          Occupancy Compliant
        </label>
        <label className="flex items-center gap-2 rounded border p-2">
          <input checked={bedAvailable} onChange={(e) => setBedAvailable(e.target.checked)} type="checkbox" />
          Bed Available
        </label>
        <label className="flex items-center gap-2 rounded border p-2">
          <input checked={waterAvailable} onChange={(e) => setWaterAvailable(e.target.checked)} type="checkbox" />
          Water Available
        </label>
        <label className="flex items-center gap-2 rounded border p-2">
          <input checked={toiletsAvailable} onChange={(e) => setToiletsAvailable(e.target.checked)} type="checkbox" />
          Toilet Access
        </label>
        <label className="flex items-center gap-2 rounded border p-2">
          <input checked={ventilationGood} onChange={(e) => setVentilationGood(e.target.checked)} type="checkbox" />
          Ventilation Good
        </label>
        <input className="rounded border p-2 md:col-span-2" placeholder="Self-declaration text" value={selfDeclaration} onChange={(e) => setSelfDeclaration(e.target.value)} required />
        <label className="rounded border p-2 md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Photo File</span>
          <input
            accept="image/*"
            className="w-full text-sm"
            onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
            type="file"
            required
          />
        </label>
        <label className="rounded border p-2 md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">Document File</span>
          <input
            accept=".pdf,.doc,.docx,.txt,image/*"
            className="w-full text-sm"
            onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
            type="file"
            required
          />
        </label>
        <label className="rounded border p-2 md:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">360 Walkthrough File</span>
          <input
            accept=".html,.zip,.json,video/*,image/*"
            className="w-full text-sm"
            onChange={(e) => setWalkthroughFile(e.target.files?.[0] || null)}
            type="file"
            required
          />
        </label>
        <button className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60 md:col-span-2" disabled={loading} type="submit">
          {loading ? "Creating & Submitting..." : "Create + Submit Unit"}
        </button>
      </form>

      <form onSubmit={checkInOccupant} className="grid max-w-3xl gap-2 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-3">
        <input className="rounded border p-2" placeholder="Unit ID" value={checkInUnitId} onChange={(e) => setCheckInUnitId(e.target.value)} required />
        <input className="rounded border p-2" placeholder="Student ID" value={checkInStudentId} onChange={(e) => setCheckInStudentId(e.target.value)} required />
        <button className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60" disabled={checkingIn} type="submit">
          {checkingIn ? "Checking In..." : "Check In Occupant"}
        </button>
      </form>

      <form onSubmit={checkOutOccupant} className="grid max-w-3xl gap-2 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-3">
        <input
          className="rounded border p-2 md:col-span-2"
          placeholder="Occupancy ID"
          value={checkOutOccupancyId}
          onChange={(e) => setCheckOutOccupancyId(e.target.value)}
          required
        />
        <button className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60" disabled={checkingOut} type="submit">
          {checkingOut ? "Checking Out..." : "Check Out Occupant"}
        </button>
      </form>
      {status && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{status}</p>}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loadingDemand && <p className="text-sm text-slate-600">Loading demand metrics...</p>}
      {demandMetrics && demandMetrics.totalVdpStudents !== undefined && (
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-lg font-semibold">Demand Pool (Controlled Visibility)</h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-2xl font-bold text-slate-900">{demandMetrics.totalVdpStudents}</p>
              <p className="text-sm text-slate-600">Verified Students</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{demandMetrics.shortlistCount}</p>
              <p className="text-sm text-slate-600">Shortlisted You</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{demandMetrics.currentOccupancy}/{demandMetrics.totalCapacity}</p>
              <p className="text-sm text-slate-600">Current Occupancy</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{demandMetrics.occupancyGap}</p>
              <p className="text-sm text-slate-600">Available Slots</p>
            </div>
          </div>
          
          {demandMetrics.distributionByInstitution && demandMetrics.distributionByInstitution.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <p className="text-sm font-semibold text-slate-700">By Institution:</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {demandMetrics.distributionByInstitution.map((inst) => (
                  <span key={inst.institutionId} className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">
                    {inst.name}: {inst.shortlistCount}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {demandMetrics.distributionByIntake && demandMetrics.distributionByIntake.length > 0 && (
            <div className="mt-2 border-t pt-4">
              <p className="text-sm font-semibold text-slate-700">By Intake:</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {demandMetrics.distributionByIntake.map((intake) => (
                  <span key={intake.intake} className="rounded-full bg-purple-50 px-2 py-1 text-xs text-purple-700">
                    {intake.intake}: {intake.shortlistCount}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          <p className="mt-4 text-xs text-slate-500">
            * Individual student details visible only when they shortlist your unit or become occupants
          </p>
        </section>
      )}
      {demandMetrics && demandMetrics.totalVdpStudents === undefined && (
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-lg font-semibold">Demand in this Corridor</h3>
          <p className="text-sm text-slate-700">Verified students: {demandMetrics.totalVdpStudents}</p>
          <p className="text-sm text-slate-700">Shortlists: {demandMetrics.shortlistCount}</p>
          <p className="text-sm text-slate-700">
            Occupancy: {demandMetrics.occupancy?.totalActiveOccupancies}/{demandMetrics.occupancy?.totalCapacity}
          </p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">My Units</h3>
          <button
            className="rounded border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
            onClick={loadMyUnits}
            type="button"
          >
            Refresh
          </button>
        </div>
        {loadingMyUnits && <p className="text-sm text-slate-600">Loading units...</p>}
        {myUnitsError && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{myUnitsError}</p>}
        {!loadingMyUnits && !myUnitsError && myUnits.length === 0 && (
          <p className="rounded border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">No units created yet.</p>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          {myUnits.map((unit) => {
            // Determine card style based on status
            const cardStyle = unit.status === "suspended" 
              ? "border-red-300 bg-red-50" 
              : unit.status === "approved"
                ? "border-green-300 bg-green-50"
                : "border-slate-200 bg-white";

            return (
              <article key={unit.id} className={`space-y-2 rounded-xl border p-4 shadow-sm ${cardStyle}`}>
                <Link className="block" href={`/unit/${unit.id}`}>
                  <UnitCard unit={unit} showDetails={true} />
                </Link>
                <Link
                  className="block w-full rounded border border-slate-300 bg-white px-3 py-2 text-center text-sm text-slate-700 hover:bg-slate-50"
                  href={`/unit/${unit.id}`}
                >
                  Open Unit #{unit.id}
                </Link>
                
                {/* Show audit button if audit required or has open audits */}
                {unit.auditRequired && (
                  <button
                    className="w-full rounded bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700"
                    onClick={() => viewAuditLogs(unit.id)}
                    type="button"
                  >
                    {unit.openAuditLogCount > 0 ? `View Audit Logs (${unit.openAuditLogCount})` : "View Audit Logs"}
                  </button>
                )}

                {/* Show interested students button - now shows count */}
                <button
                  className="w-full rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
                  onClick={() => loadInterestedStudents(unit.id)}
                  type="button"
                >
                  {(unit.shortlistedCount > 0 || unit.activeOccupants?.length > 0) 
                    ? `View Interested (${(unit.shortlistedCount || 0) + (unit.activeOccupants?.length || 0)})`
                    : "View Interested Students"
                  }
                </button>

                {/* Show warning for suspended units */}
                {unit.status === "suspended" && (
                  <div className="rounded border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-semibold text-red-800">⚠️ Unit Suspended</p>
                    <p className="text-xs text-red-600">Please review audit logs and contact admin for corrective actions.</p>
                  </div>
                )}

                {/* Show success for approved units */}
                {unit.status === "approved" && unit.visibleToStudents && (
                  <div className="rounded border border-green-200 bg-green-50 p-3">
                    <p className="text-sm font-semibold text-green-800">✓ Unit Live</p>
                    <p className="text-xs text-green-600">Your unit is visible to students in the VDP.</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
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
                        <p className="text-sm font-semibold text-green-800">Resolution Notes:</p>
                        <p className="text-sm text-green-700">{log.verificationNotes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Need Help?</p>
              <p className="text-xs text-slate-600">Contact the admin to resolve open audits and restore your unit visibility.</p>
            </div>
          </div>
        </div>
      )}

      {/* Interested Students Modal - Controlled Visibility */}
      {showInterestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Interested Students - Unit #{selectedUnitForInterest}</h2>
              <button
                className="rounded border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setShowInterestModal(false);
                  setSelectedUnitForInterest(null);
                  setInterestedStudents([]);
                }}
              >
                Close
              </button>
            </div>

            {loadingInterested ? (
              <p className="text-sm text-slate-600">Loading...</p>
            ) : interestedStudents.length === 0 ? (
              <p className="text-sm text-slate-600">No students have shortlisted this unit yet.</p>
            ) : (
              <div className="space-y-3">
                {interestedStudents.map((student) => (
                  <div key={student.studentId} className={`rounded-lg border p-4 ${student.status === "occupant" ? "border-green-200 bg-green-50" : "border-blue-200 bg-blue-50"}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{student.name}</p>
                        <p className="text-sm text-slate-700">
                          <span className="font-medium">Student ID:</span> {student.studentId}
                        </p>
                        <p className="text-sm text-slate-600">
                          {student.institutionName} • Intake: {student.intake}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${student.status === "occupant" ? "bg-green-600 text-white" : "bg-blue-600 text-white"}`}>
                        {student.status === "occupant" ? "Occupant" : "Shortlisted"}
                      </span>
                    </div>
                    {student.email && (
                      <p className="mt-2 text-sm text-slate-700">
                        <span className="font-medium">Email:</span> {student.email}
                      </p>
                    )}
                    {student.since && (
                      <p className="text-xs text-slate-500">
                        {student.status === "occupant" ? "Checked in" : "Shortlisted"}: {formatDate(student.since)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">Controlled Visibility</p>
              <p className="text-xs text-slate-600">Student details are only visible to landlords when they shortlist your unit or become occupants. This protects student privacy.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminDashboard() {
  return (
    <div className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-bold">Admin Dashboard</h2>
      <p className="text-sm text-slate-700">Use the dedicated admin screen for corridor, unit, and audit controls.</p>
      <a className="inline-block rounded bg-slate-900 px-4 py-2 text-white" href="/admin">
        Open Admin Panel
      </a>
    </div>
  );
}

export default function DashboardPage() {
  const [role, setRole] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem("role") || "");
  }, []);

  if (!role) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Please login first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      {role === "student" && <StudentDashboard />}
      {role === "landlord" && <LandlordDashboard />}
      {role === "admin" && <AdminDashboard />}
    </div>
  );
}
