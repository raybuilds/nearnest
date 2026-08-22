"use client";

import { useEffect, useState } from "react";
import { getPaymentLedger, submitPayment, getStudentAnalytics } from "@/lib/api";
import { requireSessionOrRedirect } from "@/lib/session";
import DawnAnalyticsViewer from "@/components/DawnAnalyticsViewer";
import { FadeIn, Reveal, Expand } from "@/components/ui/Motion";
import { AnimatePresence } from "framer-motion";

export default function StudentPaymentsPage() {
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submittingId, setSubmittingId] = useState(null);
  const [receiptRef, setReceiptRef] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [studentAnalytics, setStudentAnalytics] = useState(null);
  const [expandedPaymentId, setExpandedPaymentId] = useState(null);

  async function loadLedger() {
    setLoading(true);
    setError("");
    try {
      const payload = await getPaymentLedger();
      setLedger(Array.isArray(payload) ? payload : []);
      const analyticsPayload = await getStudentAnalytics();
      setStudentAnalytics(analyticsPayload);
    } catch (requestError) {
      setError(requestError.message || "Failed to load rent ledger.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (requireSessionOrRedirect()) {
      loadLedger();
    }
  }, []);

  async function handleSubmitProof(month) {
    if (!receiptRef.trim()) {
      setError("Receipt reference is required.");
      return;
    }
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await submitPayment({
        month,
        receiptRef: receiptRef.trim(),
      });
      setReceiptRef("");
      setSubmittingId(null);
      setSuccess("Payment proof submitted successfully.");
      await loadLedger();
    } catch (requestError) {
      setError(requestError.message || "Failed to submit payment proof.");
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
      {/* Header */}
      <Reveal duration={0.5}>
        <section className="glass-panel-strong blueprint-border p-8 rounded-[24px] bg-[var(--bg-surface-strong)]">
          <div className="eyebrow">Student Portal</div>
          <h1 className="page-title mt-2 text-gradient">Rent Ledger & Statements</h1>
          <p className="subtle-copy mt-2">
            Verify your monthly rent obligations, upload bank receipt references, and track verification updates.
          </p>
        </section>
      </Reveal>

      {error && <div className="status-banner error">{error}</div>}
      {success && <div className="status-banner success">{success}</div>}

      {ledger.length === 0 ? (
        <FadeIn>
          <div className="glass-panel p-12 text-center text-slate-400 rounded-[24px] bg-[var(--bg-surface)]">
            <p className="text-sm">No rent statement records or active occupancies found.</p>
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-6">
          {ledger.map((statement, sIndex) => (
            <Reveal key={sIndex} delay={sIndex * 0.1} duration={0.5}>
              <section className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface)] border border-white/5">
                <div className="flex flex-wrap justify-between items-center border-b border-white/10 pb-3">
                  <div>
                    <h2 className="text-lg font-bold text-white">Unit #{statement.occupancy.unit?.id || "N/A"}</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Stay Duration: {new Date(statement.occupancy.startDate).toLocaleDateString()} -{" "}
                      {statement.occupancy.endDate ? new Date(statement.occupancy.endDate).toLocaleDateString() : "Present"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase tracking-wider text-slate-500 block">Monthly Rent</span>
                    <span className="text-lg font-bold text-slate-200">₹{statement.occupancy.unit?.rent || 0}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="hidden sm:grid grid-cols-5 text-xs uppercase tracking-wider text-slate-500 font-semibold px-4 pb-2 border-b border-white/5">
                    <div>Month</div>
                    <div>Amount</div>
                    <div>Status</div>
                    <div>Receipt Reference</div>
                    <div className="text-right">Action</div>
                  </div>

                  {statement.payments.map((payment) => {
                    const isExpanded = expandedPaymentId === payment.id;
                    return (
                      <div 
                        key={payment.id} 
                        className="rounded-xl border border-white/5 bg-white/5 transition-all hover:bg-white/10 overflow-hidden"
                      >
                        <div 
                          className="grid grid-cols-1 sm:grid-cols-5 items-center gap-3 p-4 text-sm cursor-pointer select-none"
                          onClick={() => setExpandedPaymentId(isExpanded ? null : payment.id)}
                        >
                          <div className="font-semibold text-slate-200 flex justify-between sm:block">
                            <span className="sm:hidden text-slate-500 font-normal">Month:</span>
                            {payment.month}
                          </div>
                          <div className="text-slate-300 flex justify-between sm:block">
                            <span className="sm:hidden text-slate-500 font-normal">Amount:</span>
                            ₹{payment.amount}
                          </div>
                          <div className="flex justify-between sm:block">
                            <span className="sm:hidden text-slate-500 font-normal">Status:</span>
                            <span
                              className={`px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                                payment.status === "VERIFIED"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : payment.status === "PAID"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-rose-500/20 text-rose-300"
                              }`}
                            >
                              {payment.status}
                            </span>
                          </div>
                          <div className="text-slate-400 truncate flex justify-between sm:block">
                            <span className="sm:hidden text-slate-500 font-normal">Receipt:</span>
                            {payment.receiptRef || "—"}
                          </div>
                          <div className="text-right flex justify-between sm:block items-center">
                            <span className="sm:hidden text-slate-500 font-normal">Expand:</span>
                            <span className="text-xs text-sky-400 font-medium">
                              {isExpanded ? "Close Details" : "View / Edit"}
                            </span>
                          </div>
                        </div>

                        <Expand isExpanded={isExpanded}>
                          <div className="p-4 bg-black/25 border-t border-white/5 text-xs text-slate-300 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <p className="text-[10px] uppercase text-slate-500 tracking-wider">Statement Information</p>
                                <p className="mt-1 text-slate-300">
                                  Your payment of ₹{payment.amount} for the month of {payment.month} is currently in{" "}
                                  <strong className="text-white">{payment.status}</strong> state.
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase text-slate-500 tracking-wider">Verification Steps</p>
                                <p className="mt-1 text-slate-400">
                                  {payment.status === "PENDING" && "Please submit bank receipt transaction ID reference."}
                                  {payment.status === "PAID" && "Awaiting Landlord check-off and approval."}
                                  {payment.status === "VERIFIED" && "Statement closed. All compliance cleared."}
                                </p>
                              </div>
                            </div>

                            {payment.status === "PENDING" && (
                              <div className="pt-2 border-t border-white/5">
                                {submittingId === payment.id ? (
                                  <div className="flex flex-col gap-2 max-w-md">
                                    <label className="text-slate-400">Bank Transaction ID / Reference Number</label>
                                    <div className="flex gap-2">
                                      <input
                                        className="input-shell text-xs py-1.5 px-3 bg-stone-900 border-white/10 text-white rounded-lg flex-1"
                                        onChange={(e) => setReceiptRef(e.target.value)}
                                        placeholder="e.g. TXN987654321"
                                        value={receiptRef}
                                        disabled={actionLoading}
                                      />
                                      <button
                                        className="btn-primary text-xs font-semibold tracking-wider px-4"
                                        disabled={actionLoading}
                                        onClick={() => handleSubmitProof(payment.month)}
                                      >
                                        {actionLoading ? "Submitting..." : "Confirm"}
                                      </button>
                                      <button
                                        className="btn-secondary text-xs px-3"
                                        disabled={actionLoading}
                                        onClick={() => {
                                          setSubmittingId(null);
                                          setReceiptRef("");
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    className="btn-primary text-xs py-1.5 px-4 font-semibold tracking-wider"
                                    onClick={() => setSubmittingId(payment.id)}
                                  >
                                    Submit Bank Reference Proof
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </Expand>
                      </div>
                    );
                  })}
                </div>
              </section>
            </Reveal>
          ))}
        </div>
      )}

      {studentAnalytics && (
        <Reveal duration={0.5}>
          <section className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface)] border border-white/5">
            <h2 className="text-lg font-bold text-white mb-2">My Residency Analytics</h2>
            <DawnAnalyticsViewer analytics={studentAnalytics} />
          </section>
        </Reveal>
      )}
    </div>
  );
}
