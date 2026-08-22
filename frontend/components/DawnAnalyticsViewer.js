import React from "react";

export default function DawnAnalyticsViewer({ analytics }) {
  if (!analytics) return null;

  const { facts = [], signals = [], risks = [], recommendations = [] } = analytics;

  return (
    <div className="space-y-6">
      {/* Risks & Alerts */}
      {risks.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-rose-400">Risk Indicators</p>
          <div className="grid gap-3">
            {risks.map((risk, index) => (
              <div
                key={index}
                className={`p-4 rounded-xl border bg-opacity-10 text-sm ${
                  risk.severity === "HIGH"
                    ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
                    : risk.severity === "MEDIUM"
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                    : "border-sky-500/20 bg-sky-500/10 text-sky-200"
                }`}
              >
                <div className="flex items-center justify-between font-bold text-xs uppercase mb-1">
                  <span>{risk.type}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] ${
                    risk.severity === "HIGH" ? "bg-rose-500/20" : risk.severity === "MEDIUM" ? "bg-amber-500/20" : "bg-sky-500/20"
                  }`}>
                    {risk.severity} Severity
                  </span>
                </div>
                <p className="text-xs leading-relaxed opacity-90">{risk.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-emerald-400">Actionable Suggestions</p>
          <div className="grid gap-3">
            {recommendations.map((rec, index) => (
              <div key={index} className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-sm text-emerald-200">
                <p className="text-xs font-bold uppercase mb-1">Recommendation</p>
                <p className="text-xs leading-relaxed opacity-90">{rec.message}</p>
                <p className="text-[10px] text-slate-500 mt-2">Triggered by: {rec.triggerSignal}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Facts & Signals Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Facts */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-400">Verified System Facts</p>
          {facts.length === 0 ? (
            <p className="text-xs text-slate-500">No operational facts registered yet.</p>
          ) : (
            <div className="p-4 border border-white/5 rounded-2xl bg-white/5 space-y-3">
              {facts.map((fact, index) => {
                const formatValue = (val) => {
                  if (val === null || val === undefined) return "—";
                  if (typeof val === "object") {
                    return Object.entries(val)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ");
                  }
                  return String(val);
                };
                return (
                  <div key={index} className="flex justify-between items-center text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0 gap-3">
                    <span className="text-slate-400 font-medium shrink-0">{fact.type}</span>
                    <span className="text-white font-semibold font-mono text-right whitespace-normal break-words max-w-[70%]">
                      {formatValue(fact.value)} {fact.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Signals */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-400">Derived Diagnostic Signals</p>
          {signals.length === 0 ? (
            <p className="text-xs text-slate-500">No derived signals generated yet.</p>
          ) : (
            <div className="p-4 border border-white/5 rounded-2xl bg-white/5 space-y-3">
              {signals.map((sig, index) => {
                const formatValue = (val) => {
                  if (val === null || val === undefined) return "—";
                  if (typeof val === "object") {
                    return Object.entries(val)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ");
                  }
                  if (typeof val === "number" && val % 1 !== 0) {
                    return val.toFixed(2);
                  }
                  return String(val);
                };
                return (
                  <div key={index} className="flex justify-between items-center text-xs border-b border-white/5 pb-2 last:border-0 last:pb-0 gap-3">
                    <span className="text-slate-400 font-medium shrink-0">{sig.type}</span>
                    <span className="text-white font-semibold font-mono text-right whitespace-normal break-words max-w-[70%]">
                      {formatValue(sig.value)} {sig.unit}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
