"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ComplaintForm from "@/components/ComplaintForm";
import UnitCard from "@/components/UnitCard";
import {
  getAdminAuditQueue,
  getAdminUnits,
  getCorridorDemand,
  getCorridors,
  getDawnInsights,
  getDemandSummary,
  getHiddenReasons,
  getLandlordUnits,
  getProfile,
  getUnits,
} from "@/lib/api";
import styles from "./page.module.css";

function InsightStrip({ insights }) {
  if (!insights.length) return null;

  return (
    <section className={`${styles.insightStrip} fade-up-d1`}>
      {insights.map((insight, index) => {
        const severityClass =
          insight.riskLevel === "HIGH" ? "ch-err" : insight.riskLevel === "MEDIUM" ? "ch-warn" : "ch-blue";
        return (
          <article key={`${insight.type}-${index}`} className={`${styles.insightCard} glass`}>
            <span className={`chip ${severityClass}`}>{String(insight.type || "insight").replaceAll("_", " ")}</span>
            <strong>{insight.title || "Operational insight"}</strong>
            <p>{insight.message || insight.body || insight.summary || "No summary available."}</p>
            {insight.recommendation ? <span className={styles.insightMeta}>{insight.recommendation}</span> : null}
          </article>
        );
      })}
    </section>
  );
}

function StudentDashboard({
  corridors,
  corridorId,
  setCorridorId,
  filters,
  setFilters,
  units,
  hiddenReasons,
  demand,
  insights,
  reloadStudentData,
  loading,
  error,
}) {
  const [showHidden, setShowHidden] = useState(false);

  const demandLevel = useMemo(() => {
    const totalVdpStudents = Number(demand?.totalVdpStudents || 0);
    if (totalVdpStudents >= 30) return "High";
    if (totalVdpStudents >= 10) return "Medium";
    return "Low";
  }, [demand]);

  const visibleUnits = Array.isArray(units) ? units.filter((unit) => unit.visibleToStudents !== false) : [];

  return (
    <div className={`pageShell ${styles.page}`}>
      <section className={`fade-up ${styles.hero}`}>
        <div>
          <span className="role-pill rp-student">student</span>
          <h1 className="hero-heading">Discover housing</h1>
          <p className="pageSubtitle">Browse verified corridor inventory with trust visibility, live governance signals, and complaint context.</p>
        </div>
      </section>

      <section className={`panel-light ${styles.filterBar} fade-up-d1`}>
        <label className={styles.filterField}>
          <span>Corridor</span>
          <select className="app-input" value={corridorId} onChange={(event) => setCorridorId(event.target.value)}>
            <option value="">Select corridor</option>
            {corridors.map((corridor) => (
              <option key={corridor.id} value={corridor.id}>
                {corridor.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.filterField}>
          <span>Max rent</span>
          <input className="app-input" type="number" value={filters.maxRent} onChange={(event) => setFilters((prev) => ({ ...prev, maxRent: event.target.value }))} />
        </label>

        <label className={styles.filterField}>
          <span>AC</span>
          <select className="app-input" value={filters.ac} onChange={(event) => setFilters((prev) => ({ ...prev, ac: event.target.value }))}>
            <option value="">Any</option>
            <option value="true">AC only</option>
          </select>
        </label>

        <label className={styles.filterField}>
          <span>Max distance</span>
          <input
            className="app-input"
            type="number"
            value={filters.maxDistance}
            onChange={(event) => setFilters((prev) => ({ ...prev, maxDistance: event.target.value }))}
          />
        </label>

        <button className="btn-primary" onClick={reloadStudentData} type="button">
          Search
        </button>
      </section>

      <InsightStrip insights={insights} />

      <section className={`${styles.metricGrid} fade-up-d2`}>
        <article className="metric-card">
          <p className="label-caps">Visible units</p>
          <strong>{visibleUnits.length}</strong>
          <span>Currently discoverable</span>
        </article>
        <article className="metric-card">
          <p className="label-caps">Demand level</p>
          <strong>{demandLevel}</strong>
          <span>{`${Number(demand?.totalVdpStudents || 0)} verified students in this corridor`}</span>
        </article>
        <article className="metric-card">
          <p className="label-caps">Capacity</p>
          <strong>{Number(demand?.occupancy?.totalCapacity || 0)}</strong>
          <span>{`${Number(demand?.occupancy?.totalActiveOccupancies || 0)} active occupancies`}</span>
        </article>
        <article className="metric-card">
          <p className="label-caps">Hidden units</p>
          <strong>{Number(hiddenReasons?.hiddenCount || 0)}</strong>
          <span>Blocked by visibility rules</span>
        </article>
      </section>

      {error ? <div className="status-banner error fade-up-d2">{error}</div> : null}

      <section className={`fade-up-d2 ${styles.unitGrid}`}>
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <div key={index} className="skeleton" />)
        ) : visibleUnits.length > 0 ? (
          visibleUnits.map((unit) => <UnitCard key={unit.id} onShortlist={reloadStudentData} showForStudent unit={unit} />)
        ) : (
          <div className="empty-state panel-light">No units found for this corridor and filters.</div>
        )}
      </section>

      <section className={`panel-light fade-up-d3 ${styles.hiddenSection}`}>
        <div className={styles.hiddenHeader}>
          <div>
            <h2 className="section-heading">{`${Number(hiddenReasons?.hiddenCount || 0)} units are hidden from your view`}</h2>
            <p className="mutedText">Visibility is controlled by approval state, audit state, and trust thresholds.</p>
          </div>
          <button className="btn-secondary" onClick={() => setShowHidden((value) => !value)} type="button">
            {showHidden ? "Hide" : "Show"}
          </button>
        </div>

        {showHidden ? (
          <div className={styles.hiddenList}>
            {(hiddenReasons?.hiddenUnits || []).map((item) => (
              <article key={item.unitId} className="panel">
                <strong>{`Unit ${item.unitId}`}</strong>
                <div className={styles.reasonList}>
                  {(item.reasons || []).map((reason) => (
                    <span key={reason} className="status-banner warn">
                      {reason}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="fade-up-d3">
        <div className={styles.sectionLead}>
          <h2 className="section-heading">File a complaint</h2>
          <p className="mutedText">Complaint submission updates trust and SLA governance in real time.</p>
        </div>
        <ComplaintForm />
      </section>
    </div>
  );
}

function LandlordDashboard({ units, demandSummary, insights, loading, error, pollingBanner, createForm, setCreateForm }) {
  const totalUnits = units.length;
  const occupied = units.reduce((sum, unit) => sum + Number(unit.occupancyCount || 0), 0);
  const pendingReview = units.filter((unit) => unit.status === "submitted").length;
  const auditsRequired = units.filter((unit) => unit.auditRequired).length;

  return (
    <div className={`pageShell ${styles.page}`}>
      <section className={`fade-up ${styles.hero}`}>
        <div>
          <span className="role-pill rp-landlord">landlord</span>
          <h1 className="hero-heading">Portfolio command</h1>
          <p className="pageSubtitle">Monitor trust signals, audit exposure, corridor demand, and active complaint pressure across your units.</p>
        </div>
      </section>

      <InsightStrip insights={insights} />

      {pollingBanner ? <div className="status-banner warn fade-up-d1">{pollingBanner}</div> : null}
      {error ? <div className="status-banner error fade-up-d1">{error}</div> : null}

      <section className={`${styles.metricGrid} fade-up-d1`}>
        <article className="metric-card">
          <p className="label-caps">Total units</p>
          <strong>{totalUnits}</strong>
          <span>Portfolio inventory</span>
        </article>
        <article className="metric-card">
          <p className="label-caps">Occupied</p>
          <strong>{occupied}</strong>
          <span>Current active occupancies</span>
        </article>
        <article className="metric-card">
          <p className="label-caps">Pending review</p>
          <strong>{pendingReview}</strong>
          <span>Submitted to governance</span>
        </article>
        <article className="metric-card">
          <p className="label-caps">Audit required</p>
          <strong>{auditsRequired}</strong>
          <span>Units needing corrective action</span>
        </article>
      </section>

      <section className={`${styles.twoColumn} fade-up-d2`}>
        <article className="panel">
          <div className={styles.sectionLead}>
            <h2 className="section-heading">Corridor demand</h2>
            <p className="mutedText">Verified demand, shortlists, occupancy, and conversion for your active corridor.</p>
          </div>

          <div className={styles.metricGrid}>
            <div className="metric-card">
              <p className="label-caps">VDP students</p>
              <strong>{Number(demandSummary?.totalVdpStudents || 0)}</strong>
              <span>Verified demand pool</span>
            </div>
            <div className="metric-card">
              <p className="label-caps">Shortlists</p>
              <strong>{Number(demandSummary?.shortlistCount || 0)}</strong>
              <span>Unique interested students</span>
            </div>
            <div className="metric-card">
              <p className="label-caps">Occupancy</p>
              <strong>{Number(demandSummary?.currentOccupancy || 0)}</strong>
              <span>{`${Number(demandSummary?.totalCapacity || 0)} total capacity`}</span>
            </div>
            <div className="metric-card">
              <p className="label-caps">Conversion</p>
              <strong>{`${Number(demandSummary?.conversionRatio || 0)}%`}</strong>
              <span>Occupancy from shortlist demand</span>
            </div>
          </div>

          <div className={styles.barList}>
            {(demandSummary?.distributionByInstitution || []).map((item) => (
              <div key={`${item.institutionId}-${item.name}`} className={styles.barRow}>
                <div className={styles.barLabelRow}>
                  <span>{item.name}</span>
                  <strong>{item.shortlistCount}</strong>
                </div>
                <div className="trust-bar-track">
                  <div
                    className="trust-bar-fill priority"
                    style={{
                      width: `${Math.min(
                        100,
                        Number(demandSummary?.shortlistCount || 1) > 0
                          ? (Number(item.shortlistCount || 0) / Number(demandSummary.shortlistCount || 1)) * 100
                          : 0
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className={styles.sectionLead}>
            <h2 className="section-heading">Create unit</h2>
            <p className="mutedText">Form preview only in this phase. Creation wiring stays for the next page migration.</p>
          </div>

          <div className={styles.createGrid}>
            <label className={styles.filterField}>
              <span>Corridor ID</span>
              <input className="app-input" value={createForm.corridorId} onChange={(event) => setCreateForm((prev) => ({ ...prev, corridorId: event.target.value }))} />
            </label>
            <label className={styles.filterField}>
              <span>Rent</span>
              <input className="app-input" value={createForm.rent} onChange={(event) => setCreateForm((prev) => ({ ...prev, rent: event.target.value }))} />
            </label>
            <label className={styles.filterField}>
              <span>Distance Km</span>
              <input className="app-input" value={createForm.distanceKm} onChange={(event) => setCreateForm((prev) => ({ ...prev, distanceKm: event.target.value }))} />
            </label>
            <label className={styles.filterField}>
              <span>Capacity</span>
              <input className="app-input" value={createForm.capacity} onChange={(event) => setCreateForm((prev) => ({ ...prev, capacity: event.target.value }))} />
            </label>
          </div>
          <button className="btn-primary" disabled type="button">
            Create unit
          </button>
        </article>
      </section>

      <section className={`fade-up-d3 ${styles.landlordList}`}>
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton" />)
        ) : units.length > 0 ? (
          units.map((unit) => (
            <div key={unit.id} className="panel-light">
              <UnitCard showDetails unit={unit} />
            </div>
          ))
        ) : (
          <div className="empty-state panel-light">No landlord units found.</div>
        )}
      </section>
    </div>
  );
}

function AdminDashboard({ corridors, selectedCorridor, setSelectedCorridor, units, auditQueue, loading, error }) {
  const pendingUnits = units.filter((unit) => unit.status === "submitted" || unit.status === "admin_review").length;
  const suspendedUnits = units.filter((unit) => unit.status === "suspended").length;

  return (
    <div className={`pageShell ${styles.page}`}>
      <section className={`fade-up ${styles.hero}`}>
        <div>
          <span className="role-pill rp-admin">admin</span>
          <h1 className="hero-heading">Governance operations</h1>
          <p className="pageSubtitle">Review incoming units, monitor audit queues, and track corridor-level governance signals.</p>
        </div>
      </section>

      <section className={`panel-light ${styles.filterBar} fade-up-d1`}>
        <label className={styles.filterField}>
          <span>Corridor</span>
          <select className="app-input" value={selectedCorridor} onChange={(event) => setSelectedCorridor(event.target.value)}>
            <option value="">Select corridor</option>
            {corridors.map((corridor) => (
              <option key={corridor.id} value={corridor.id}>
                {corridor.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error ? <div className="status-banner error fade-up-d1">{error}</div> : null}

      <section className={`${styles.metricGrid} fade-up-d1`}>
        <article className="metric-card">
          <p className="label-caps">Corridors</p>
          <strong>{corridors.length}</strong>
          <span>Governance scope</span>
        </article>
        <article className="metric-card">
          <p className="label-caps">Units pending</p>
          <strong>{pendingUnits}</strong>
          <span>Require review</span>
        </article>
        <article className="metric-card">
          <p className="label-caps">Suspended</p>
          <strong>{suspendedUnits}</strong>
          <span>Currently blocked</span>
        </article>
        <article className="metric-card">
          <p className="label-caps">Audits open</p>
          <strong>{auditQueue.length}</strong>
          <span>Unresolved audit queue</span>
        </article>
      </section>

      <section className={`${styles.adminShortcutGrid} fade-up-d2`}>
        {[
          "Unit Review",
          "Audit Queue",
          "Corridor Analytics",
          "Create Resources",
        ].map((item) => (
          <article key={item} className="glass panel">
            <p className="label-caps">Admin action</p>
            <strong>{item}</strong>
            <span className="mutedText">Available in the admin workflow surface.</span>
          </article>
        ))}
      </section>

      <section className={`fade-up-d2 ${styles.twoColumn}`}>
        <article className="panel">
          <div className={styles.sectionLead}>
            <h2 className="section-heading">Unit review queue</h2>
            <p className="mutedText">Units awaiting governance approval in the selected corridor.</p>
          </div>

          <div className={styles.adminList}>
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton" />)
            ) : units.length > 0 ? (
              units
                .filter((unit) => unit.status === "submitted" || unit.status === "admin_review" || unit.auditRequired)
                .map((unit) => (
                  <article key={unit.id} className="panel-light">
                    <div className={styles.rowBetween}>
                      <strong>{`Unit ${unit.id}`}</strong>
                      <span className={`trust-band-badge ${unit.trustBand === "priority" ? "band-priority" : unit.trustBand === "standard" ? "band-standard" : "band-hidden"}`}>
                        {unit.trustBand}
                      </span>
                    </div>
                    <div className={styles.signalRow}>
                      <span className={`chip ${unit.structuralApproved ? "ch-ok" : "ch-warn"}`}>Structural</span>
                      <span className={`chip ${unit.operationalBaselineApproved ? "ch-ok" : "ch-warn"}`}>Operational</span>
                      {unit.auditRequired ? <span className="chip ch-err">Audit required</span> : null}
                    </div>
                  </article>
                ))
            ) : (
              <div className="empty-state panel-light">No units pending review.</div>
            )}
          </div>
        </article>

        <article className="panel">
          <div className={styles.sectionLead}>
            <h2 className="section-heading">Audit queue</h2>
            <p className="mutedText">Audit-triggered units in the selected corridor.</p>
          </div>

          <div className={styles.adminList}>
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton" />)
            ) : auditQueue.length > 0 ? (
              auditQueue.map((unit) => (
                <article key={unit.id} className="glass panel">
                  <div className={styles.rowBetween}>
                    <strong>{`Unit ${unit.id}`}</strong>
                    <span className="chip ch-err">Audit queue</span>
                  </div>
                  <div className="trust-bar-track">
                    <div className={`trust-bar-fill ${unit.trustBand === "priority" ? "priority" : unit.trustBand === "standard" ? "standard" : "hidden"}`} style={{ width: `${Number(unit.trustScore || 0)}%` }} />
                  </div>
                  <p className="mutedText">{`Trust ${Number(unit.trustScore || 0)} | status ${unit.status}`}</p>
                </article>
              ))
            ) : (
              <div className="empty-state panel-light">No units currently in the audit queue.</div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [corridors, setCorridors] = useState([]);
  const [corridorId, setCorridorId] = useState("");
  const [selectedCorridor, setSelectedCorridor] = useState("");
  const [filters, setFilters] = useState({ maxRent: "", ac: "", maxDistance: "" });

  const [units, setUnits] = useState([]);
  const [hiddenReasons, setHiddenReasons] = useState({ hiddenCount: 0, hiddenUnits: [] });
  const [demand, setDemand] = useState(null);
  const [demandSummary, setDemandSummary] = useState(null);
  const [insights, setInsights] = useState([]);
  const [auditQueue, setAuditQueue] = useState([]);
  const [pollingBanner, setPollingBanner] = useState("");
  const [createForm, setCreateForm] = useState({
    corridorId: "",
    rent: "",
    distanceKm: "",
    capacity: "",
  });
  const latestLandlordUnitsRef = useRef([]);

  const studentQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.maxRent) params.set("maxRent", filters.maxRent);
    if (filters.ac) params.set("ac", filters.ac);
    if (filters.maxDistance) params.set("maxDistance", filters.maxDistance);
    return params.toString();
  }, [filters]);

  useEffect(() => {
    setRole(localStorage.getItem("role") || "");
  }, []);

  useEffect(() => {
    let active = true;

    async function loadSharedContext() {
      try {
        const [corridorPayload, dawnPayload] = await Promise.all([
          getCorridors().catch(() => []),
          getDawnInsights().catch(() => ({ insights: [] })),
        ]);

        if (!active) return;

        const nextCorridors = Array.isArray(corridorPayload) ? corridorPayload : [];
        setCorridors(nextCorridors);
        setInsights(Array.isArray(dawnPayload?.insights) ? dawnPayload.insights : []);

        if (!selectedCorridor && nextCorridors[0] && role === "admin") {
          setSelectedCorridor(String(nextCorridors[0].id));
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message || "Failed to load dashboard context.");
        }
      }
    }

    if (role) {
      loadSharedContext();
    }

    return () => {
      active = false;
    };
  }, [role]);

  async function reloadStudentData() {
    if (!corridorId) return;

    setLoading(true);
    setError("");
    try {
      const [unitPayload, hiddenPayload, demandPayload] = await Promise.all([
        getUnits(corridorId, studentQuery),
        getHiddenReasons(corridorId),
        getCorridorDemand(corridorId),
      ]);

      setUnits(Array.isArray(unitPayload) ? unitPayload : []);
      setHiddenReasons(hiddenPayload || { hiddenCount: 0, hiddenUnits: [] });
      setDemand(demandPayload || null);
    } catch (loadError) {
      setError(loadError.message || "Failed to load student dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function bootstrapStudent() {
      if (role !== "student") return;

      setLoading(true);
      setError("");
      try {
        const profile = await getProfile();
        const studentCorridorId = String(profile?.identity?.corridor?.id || "");
        const nextCorridorId = corridorId || studentCorridorId;

        if (!active) return;

        setCorridorId(nextCorridorId);

        if (!nextCorridorId) {
          setUnits([]);
          setHiddenReasons({ hiddenCount: 0, hiddenUnits: [] });
          setDemand(null);
          setLoading(false);
          return;
        }

        const [unitPayload, hiddenPayload, demandPayload] = await Promise.all([
          getUnits(nextCorridorId, studentQuery),
          getHiddenReasons(nextCorridorId),
          getCorridorDemand(nextCorridorId),
        ]);

        if (!active) return;
        setUnits(Array.isArray(unitPayload) ? unitPayload : []);
        setHiddenReasons(hiddenPayload || { hiddenCount: 0, hiddenUnits: [] });
        setDemand(demandPayload || null);
      } catch (loadError) {
        if (active) {
          setError(loadError.message || "Failed to load student dashboard.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    bootstrapStudent();
    return () => {
      active = false;
    };
  }, [role, studentQuery]);

  useEffect(() => {
    let active = true;
    let intervalId = null;

    async function loadLandlordData(showDiff = false) {
      if (role !== "landlord") return;

      if (!showDiff) {
        setLoading(true);
      }

      setError("");
      try {
        const unitPayload = await getLandlordUnits();
        const nextUnits = Array.isArray(unitPayload) ? unitPayload : [];

        let nextDemandSummary = null;
        const defaultCorridorId = String(nextUnits[0]?.corridorId || "");
        if (defaultCorridorId) {
          nextDemandSummary = await getDemandSummary(defaultCorridorId).catch(() => null);
        }

        if (!active) return;

        if (showDiff) {
          const changedUnit = nextUnits.find((unit) => {
            const previous = latestLandlordUnitsRef.current.find((item) => item.id === unit.id);
            return previous && previous.status !== unit.status;
          });
          setPollingBanner(changedUnit ? `Unit ${changedUnit.id} changed status to ${changedUnit.status}.` : "");
        }

        setCreateForm((current) => ({
          ...current,
          corridorId: current.corridorId || defaultCorridorId,
        }));
        latestLandlordUnitsRef.current = nextUnits;
        setUnits(nextUnits);
        setDemandSummary(nextDemandSummary);
      } catch (loadError) {
        if (active) {
          setError(loadError.message || "Failed to load landlord dashboard.");
        }
      } finally {
        if (active && !showDiff) {
          setLoading(false);
        }
      }
    }

    if (role === "landlord") {
      loadLandlordData(false);
      intervalId = window.setInterval(() => {
        loadLandlordData(true);
      }, 30000);
    }

    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [role]);

  useEffect(() => {
    let active = true;

    async function loadAdminData() {
      if (role !== "admin" || !selectedCorridor) return;

      setLoading(true);
      setError("");
      try {
        const [unitPayload, auditPayload] = await Promise.all([
          getAdminUnits(selectedCorridor),
          getAdminAuditQueue(selectedCorridor),
        ]);

        if (!active) return;

        setUnits(Array.isArray(unitPayload) ? unitPayload : []);
        setAuditQueue(Array.isArray(auditPayload) ? auditPayload : []);
      } catch (loadError) {
        if (active) {
          setError(loadError.message || "Failed to load admin dashboard.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAdminData();
    return () => {
      active = false;
    };
  }, [role, selectedCorridor]);

  if (role === "student") {
    return (
      <StudentDashboard
        corridorId={corridorId}
        corridors={corridors}
        demand={demand}
        error={error}
        filters={filters}
        hiddenReasons={hiddenReasons}
        insights={insights}
        loading={loading}
        reloadStudentData={reloadStudentData}
        setCorridorId={setCorridorId}
        setFilters={setFilters}
        units={units}
      />
    );
  }

  if (role === "landlord") {
    return (
      <LandlordDashboard
        createForm={createForm}
        demandSummary={demandSummary}
        error={error}
        insights={insights}
        loading={loading}
        pollingBanner={pollingBanner}
        setCreateForm={setCreateForm}
        units={units}
      />
    );
  }

  return (
    <AdminDashboard
      auditQueue={auditQueue}
      corridors={corridors}
      error={error}
      loading={loading}
      selectedCorridor={selectedCorridor}
      setSelectedCorridor={setSelectedCorridor}
      units={units}
    />
  );
}
