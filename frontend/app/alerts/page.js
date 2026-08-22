"use client";

import { useEffect, useState } from "react";
import { getAlerts, readAlert, acknowledgeAlert, resolveAlert, dismissAlert } from "@/lib/api";
import { getStoredRole } from "@/lib/session";
import { FadeIn, Reveal } from "@/components/ui/Motion";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");

  const fetchAlerts = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getAlerts(statusFilter, page);
      if (res) {
        setAlerts(res.alerts || []);
        setPagination(res.pagination || { total: 0, pages: 1 });
      }
    } catch (err) {
      setError(err.message || "Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setRole(getStoredRole());
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, page]);

  const handleAction = async (id, actionFn) => {
    try {
      await actionFn(id);
      fetchAlerts();
    } catch (err) {
      alert(err.message || "Action failed");
    }
  };

  const getSeverityBadge = (sev) => {
    const classes = {
      CRITICAL: "bg-red-500/20 text-red-400 border border-red-500/30",
      HIGH: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
      MEDIUM: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
      LOW: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
      INFO: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    };
    return classes[sev] || "bg-gray-500/20 text-gray-400 border border-gray-500/30";
  };

  return (
    <div className="flex flex-col gap-6">
      <Reveal duration={0.5}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-2xl font-semibold text-gradient" style={{ fontFamily: "var(--font-display)" }}>
              Alert & Governance Center
            </h1>
            <p className="text-sm text-soft mt-1">
              Real-time tenant governance alerts and compliance monitoring
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            {["", "OPEN", "READ", "ACKNOWLEDGED", "RESOLVED", "DISMISSED"].map((status) => (
              <button
                key={status}
                className={`btn-secondary text-xs px-3 py-1.5 transition ${
                  statusFilter === status ? "bg-[var(--bg-soft-strong)] border-[var(--border-strong)]" : ""
                }`}
                onClick={() => {
                  setStatusFilter(status);
                  setPage(1);
                }}
              >
                {status || "ALL"}
              </button>
            ))}
          </div>
        </div>
      </Reveal>

      {error && (
        <div className="glass-panel border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <FadeIn className="space-y-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="surface-panel h-24 animate-pulse rounded-2xl bg-stone-800" />
          ))}
        </FadeIn>
      ) : alerts.length === 0 ? (
        <FadeIn>
          <div className="glass-panel p-12 text-center rounded-[24px] bg-[var(--bg-surface)] border border-white/5">
            <span className="text-3xl">🔔</span>
            <h3 className="mt-3 text-lg font-medium text-main text-white">No Alerts Found</h3>
            <p className="text-sm text-soft mt-1 text-slate-400">
              You are completely up-to-date with all system requirements and compliance actions.
            </p>
          </div>
        </FadeIn>
      ) : (
        <div className="grid gap-4">
          {alerts.map((alert, idx) => (
            <Reveal key={alert.id} delay={idx * 0.05} duration={0.4}>
              <div className="glass-panel p-5 flex flex-col md:flex-row justify-between gap-4 items-start md:items-center rounded-2xl bg-[var(--bg-surface)] border border-white/5 hover:bg-white/10 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getSeverityBadge(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-500/10 text-soft text-slate-300">
                      {alert.type}
                    </span>
                    <span className="text-xs text-soft text-slate-400">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <h3 className="mt-2 text-base font-semibold text-main text-white">
                    {alert.title}
                  </h3>
                  <p className="text-sm text-muted mt-1 text-slate-300">
                    {alert.message}
                  </p>
                </div>

                <div className="flex gap-2 flex-wrap items-center">
                  {alert.status === "OPEN" && (
                    <button
                      className="btn-secondary text-xs px-2.5 py-1.5 transition-colors font-semibold"
                      onClick={() => handleAction(alert.id, readAlert)}
                    >
                      Mark Read
                    </button>
                  )}

                  {(alert.status === "OPEN" || alert.status === "READ") && (
                    <button
                      className="btn-secondary text-xs px-2.5 py-1.5 transition-colors font-semibold"
                      onClick={() => handleAction(alert.id, acknowledgeAlert)}
                    >
                      Acknowledge
                    </button>
                  )}

                  {alert.status === "ACKNOWLEDGED" && role === "admin" && (
                    <button
                      className="btn-primary text-xs px-2.5 py-1.5 transition-colors font-semibold"
                      onClick={() => handleAction(alert.id, resolveAlert)}
                    >
                      Resolve Alert
                    </button>
                  )}

                  {(alert.status === "OPEN" || alert.status === "READ" || alert.status === "ACKNOWLEDGED") && (
                    <button
                      className="btn-ghost text-xs px-2.5 py-1.5 transition-colors font-semibold text-slate-400 hover:text-white"
                      onClick={() => handleAction(alert.id, dismissAlert)}
                    >
                      Dismiss
                    </button>
                  )}

                  <span className="text-xs uppercase tracking-widest text-soft px-2 font-bold text-slate-500">
                    {alert.status}
                  </span>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button
            className="btn-secondary text-xs px-3 py-1.5"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="text-xs text-soft text-slate-400">
            Page {page} of {pagination.pages}
          </span>
          <button
            className="btn-secondary text-xs px-3 py-1.5"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
