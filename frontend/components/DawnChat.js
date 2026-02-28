"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";

function formatValue(value) {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return "";
  return String(value);
}

function pickDisplayFields(item) {
  const preferred = [
    "id",
    "unitId",
    "unitLabel",
    "status",
    "trustScore",
    "trustBand",
    "rent",
    "distanceKm",
    "institutionProximityKm",
    "occupancyType",
    "availableSlots",
    "severity",
    "incidentType",
    "slaStatus",
    "trustImpactHint",
    "complaintsLast30Days",
    "complaintCount",
    "corridorId",
  ];

  const keys = preferred.filter((key) => Object.prototype.hasOwnProperty.call(item, key));
  if (keys.length > 0) return keys;

  return Object.keys(item).filter((key) => {
    const value = item[key];
    return value === null || ["string", "number", "boolean"].includes(typeof value);
  }).slice(0, 8);
}

function DataCard({ item }) {
  const fields = pickDisplayFields(item);
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-2 gap-2">
        {fields.map((key) => (
          <div key={key}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{key}</p>
            <p className="text-xs text-slate-800">{formatValue(item[key])}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function DataView({ data }) {
  if (data === null || data === undefined) {
    return <p className="text-xs text-slate-600">No data</p>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return <p className="text-xs text-slate-600">No records found.</p>;
    return (
      <div className="space-y-2">
        {data.slice(0, 10).map((item, idx) => (
          <DataCard item={typeof item === "object" && item !== null ? item : { value: item }} key={`row-${idx}`} />
        ))}
      </div>
    );
  }

  if (typeof data === "object") {
    if (Array.isArray(data.data)) return <DataView data={data.data} />;
    if (Array.isArray(data.sampledUnits)) return <DataView data={data.sampledUnits} />;
    if (Array.isArray(data.complaints)) return <DataView data={data.complaints} />;
    if (Array.isArray(data.hiddenUnits)) return <DataView data={data.hiddenUnits} />;
    return <DataCard item={data} />;
  }

  return <p className="text-xs text-slate-700">{String(data)}</p>;
}

export default function DawnChat() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    const currentRole = localStorage.getItem("role") || "";
    setRole(currentRole);
  }, []);

  const greeting = useMemo(() => {
    if (role === "student") return "Dawn: Ask about rooms, hidden reasons, or submit a complaint.";
    if (role === "landlord") return "Dawn: Ask about audit risk, SLA breach, or trust drop.";
    if (role === "admin") return "Dawn: Ask about density, suspension risk, or unit suspension reasons.";
    return "Dawn: Login to use corridor intelligence.";
  }, [role]);

  async function sendQuery(confirm = false) {
    if (!query.trim() && !confirm) return;
    setLoading(true);
    try {
      const payload = await apiRequest("/dawn/query", {
        method: "POST",
        body: JSON.stringify({
          message: query,
          confirm,
          action: confirm ? pendingAction : undefined,
        }),
      });

      const next = [];
      if (!confirm) {
        next.push({ type: "user", text: query });
      }
      next.push({ type: "assistant", text: payload.assistant || "Done." });
      if (payload.data) {
        next.push({ type: "data", data: payload.data });
      }
      setMessages((prev) => [...prev, ...next]);
      setPendingAction(payload.requiresConfirmation ? payload.action : null);
      if (!payload.requiresConfirmation) {
        setQuery("");
      }
    } catch (error) {
      setMessages((prev) => [...prev, { type: "assistant", text: error.message || "Request failed." }]);
    } finally {
      setLoading(false);
    }
  }

  if (!role) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!open && (
        <button
          className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg"
          onClick={() => setOpen(true)}
          type="button"
        >
          Dawn
        </button>
      )}

      {open && (
        <div className="h-[78vh] w-[680px] max-w-[92vw] rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="text-base font-semibold text-slate-900">Dawn - Corridor Intelligence</p>
            <button className="text-sm text-slate-600" onClick={() => setOpen(false)} type="button">
              Close
            </button>
          </div>
          <div className="h-[62%] space-y-3 overflow-y-auto p-4">
            <p className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700">{greeting}</p>
            {messages.map((item, idx) => (
              <div
                className={`rounded p-2 text-xs ${
                  item.type === "user"
                    ? "bg-blue-50 text-blue-900 border border-blue-100"
                    : item.type === "data"
                      ? "bg-slate-50 text-slate-800 border border-slate-200"
                      : "bg-emerald-50 text-emerald-900 border border-emerald-100"
                }`}
                key={`${item.type}-${idx}`}
              >
                {item.type === "data" ? <DataView data={item.data} /> : item.text}
              </div>
            ))}
          </div>
          <div className="h-[38%] space-y-2 border-t border-slate-200 bg-white p-4">
            <textarea
              className="h-[110px] w-full rounded-lg border p-3 text-sm"
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask Dawn..."
              rows={4}
              value={query}
            />
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={loading}
                onClick={() => sendQuery(false)}
                type="button"
              >
                {loading ? "Thinking..." : "Send"}
              </button>
              {pendingAction && (
                <button
                  className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={loading}
                  onClick={() => sendQuery(true)}
                  type="button"
                >
                  Confirm
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
