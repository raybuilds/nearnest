"use client";

import { useEffect, useState } from "react";
import { getStudentAgreements, signTenantAgreement } from "@/lib/api";
import { requireSessionOrRedirect } from "@/lib/session";
import { FadeIn, Reveal, Expand } from "@/components/ui/Motion";

export default function StudentAgreementsPage() {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedAgreementId, setSelectedAgreementId] = useState(null);

  async function loadAgreements() {
    setLoading(true);
    setError("");
    try {
      const payload = await getStudentAgreements();
      setAgreements(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || "Failed to load rental agreements.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (requireSessionOrRedirect()) {
      loadAgreements();
    }
  }, []);

  async function handleSign(id) {
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await signTenantAgreement(id);
      setSuccess("Agreement signed successfully.");
      await loadAgreements();
    } catch (requestError) {
      setError(requestError.message || "Failed to sign agreement.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <FadeIn className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="surface-panel h-48 animate-pulse rounded-2xl bg-stone-800" />
        <div className="surface-panel h-96 animate-pulse rounded-2xl bg-stone-800" />
      </FadeIn>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8">
      <Reveal duration={0.5}>
        <section className="glass-panel-strong blueprint-border p-8 rounded-[24px] bg-[var(--bg-surface-strong)]">
          <div className="eyebrow">Student Portal</div>
          <h1 className="page-title mt-2 text-gradient">Digital Rental Agreements</h1>
          <p className="subtle-copy mt-2">
            Review, sign, and download your tenancy agreement and verify monthly rent terms.
          </p>
        </section>
      </Reveal>

      {error && <div className="status-banner error">{error}</div>}
      {success && <div className="status-banner success">{success}</div>}

      {agreements.length === 0 ? (
        <FadeIn>
          <div className="glass-panel p-12 text-center text-slate-400 rounded-[24px] bg-[var(--bg-surface)]">
            No rental agreements found for your occupancy.
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-6">
          {agreements.map((agg, idx) => {
            const isSelected = selectedAgreementId === agg.id;
            
            // Build visual stepper index from actual database states
            let stepperIndex = 1;
            if (agg.status === "PENDING_TENANT") stepperIndex = 2;
            if (agg.status === "ACTIVE") stepperIndex = 3;
            if (agg.status === "SUPERSEDED" || agg.status === "EXPIRED") stepperIndex = 3;

            return (
              <Reveal key={agg.id} delay={idx * 0.1} duration={0.5}>
                <article className="glass-panel p-6 rounded-[24px] space-y-5 bg-[var(--bg-surface)] border border-white/5">
                  <div className="flex flex-wrap justify-between items-center border-b border-white/10 pb-3">
                    <div>
                      <h2 className="text-lg font-bold text-white">Tenancy Agreement (v{agg.version})</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Stay Period: {new Date(agg.startDate).toLocaleDateString()} - {new Date(agg.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <span
                        className={`px-3 py-1 rounded-md text-xs font-bold tracking-wider ${
                          agg.status === "ACTIVE"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : agg.status === "EXPIRED"
                            ? "bg-slate-500/20 text-slate-400"
                            : agg.status === "SUPERSEDED"
                            ? "bg-indigo-500/20 text-indigo-300"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {agg.status}
                      </span>
                    </div>
                  </div>

                  {/* Visual State Stepper Timeline */}
                  <div className="py-2">
                    <p className="text-[10px] uppercase text-slate-500 tracking-wider mb-3">Signing Timeline Status</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className={`p-2 rounded-lg border ${stepperIndex >= 1 ? "bg-stone-800 text-white border-white/20" : "bg-stone-900/50 text-slate-600 border-white/5"}`}>
                        <div className="font-bold">1. Draft</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Terms Proposed</div>
                      </div>
                      <div className={`p-2 rounded-lg border ${stepperIndex >= 2 ? "bg-stone-800 text-white border-white/20" : "bg-stone-900/50 text-slate-600 border-white/5"}`}>
                        <div className="font-bold">2. Review</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Tenant Signature Required</div>
                      </div>
                      <div className={`p-2 rounded-lg border ${stepperIndex >= 3 ? "bg-stone-800 text-white border-white/20" : "bg-stone-900/50 text-slate-600 border-white/5"}`}>
                        <div className="font-bold">3. Executed</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Agreement Active</div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 text-sm">
                    <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                      <span className="text-xs text-slate-500 uppercase tracking-wider block">Monthly Rent</span>
                      <strong className="text-lg text-slate-200 mt-1 block">₹{agg.rentAmount}</strong>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                      <span className="text-xs text-slate-500 uppercase tracking-wider block">Security Deposit</span>
                      <strong className="text-lg text-slate-200 mt-1 block">₹{agg.securityDeposit}</strong>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-white/5 p-4">
                      <span className="text-xs text-slate-500 uppercase tracking-wider block">Notice Period</span>
                      <strong className="text-lg text-slate-200 mt-1 block">{agg.noticePeriodDays} Days</strong>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5">
                    <div className="flex gap-4 text-xs text-slate-400">
                      <span>Student Signed: {agg.tenantSigned ? `✅ (${new Date(agg.tenantSignedAt).toLocaleDateString()})` : "❌"}</span>
                      <span>Landlord Signed: {agg.landlordSigned ? `✅ (${new Date(agg.landlordSignedAt).toLocaleDateString()})` : "❌"}</span>
                    </div>

                    <div className="flex gap-3">
                      <button 
                        className="text-xs text-sky-400 hover:underline font-semibold"
                        onClick={() => setSelectedAgreementId(isSelected ? null : agg.id)}
                      >
                        {isSelected ? "Hide Contract Details" : "View Contract Details"}
                      </button>

                      {agg.documentPath && (
                        <a
                          className="btn-secondary text-xs py-1.5 px-4 font-semibold text-center"
                          href={`/api/agreement/document/${agg.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Download Snapshot
                        </a>
                      )}

                      {agg.status === "PENDING_TENANT" && !agg.tenantSigned && (
                        <button
                          className="btn-primary text-xs py-1.5 px-4 font-semibold tracking-wider"
                          disabled={actionLoading}
                          onClick={() => handleSign(agg.id)}
                        >
                          {actionLoading ? "Signing..." : "Sign & Acknowledge"}
                        </button>
                      )}
                    </div>
                  </div>

                  <Expand isExpanded={isSelected}>
                    <div className="p-4 rounded-xl bg-black/20 border border-white/5 text-xs text-slate-300 space-y-2 mt-3 leading-relaxed">
                      <h4 className="font-semibold text-white uppercase text-[10px] tracking-wider mb-2">Legal Tenancy Terms Summary</h4>
                      <p>1. The Tenant agrees to pay the Monthly Rent of ₹{agg.rentAmount} on or before the due date specified in the statement timeline.</p>
                      <p>2. A security deposit of ₹{agg.securityDeposit} has been recorded. This will be subject to check-out inspections by the landlord.</p>
                      <p>3. Notice period of {agg.noticePeriodDays} days is required by either party prior to termination of the occupancy stay.</p>
                      <p>4. Compliance verification documents must remain current throughout the active duration of this agreement.</p>
                    </div>
                  </Expand>
                </article>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}
