"use client";

import { useEffect, useState } from "react";
import { getParentDashboard, getPaymentLedger, submitPayment, getParentChildAgreements, getParentAnalytics } from "@/lib/api";
import { requireSessionOrRedirect } from "@/lib/session";
import DawnAnalyticsViewer from "@/components/DawnAnalyticsViewer";
import { FadeIn, Reveal, Expand } from "@/components/ui/Motion";

export default function ParentDashboardPage() {
  const [data, setData] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [childAgreements, setChildAgreements] = useState([]);
  const [parentAnalytics, setParentAnalytics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submittingId, setSubmittingId] = useState(null);
  const [receiptRef, setReceiptRef] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [expandedPaymentId, setExpandedPaymentId] = useState(null);
  const [expandedAgreementId, setExpandedAgreementId] = useState(null);
  const [expandedComplaintId, setExpandedComplaintId] = useState(null);

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const [dashPayload, ledgerPayload, agreementPayload, analyticsPayload] = await Promise.all([
        getParentDashboard(),
        getPaymentLedger().catch(() => []),
        getParentChildAgreements().catch(() => []),
        getParentAnalytics().catch(() => []),
      ]);
      setData(dashPayload);
      setLedger(ledgerPayload || []);
      setChildAgreements(agreementPayload || []);
      setParentAnalytics(analyticsPayload || []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load Guardian Command Center.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (requireSessionOrRedirect()) {
      loadDashboard();
    }
  }, []);

  async function handleSubmitProof(month, studentId) {
    if (!receiptRef.trim()) {
      setSubmitError("Receipt reference is required");
      return;
    }
    setSubmitError("");
    try {
      await submitPayment({
        month,
        receiptRef: receiptRef.trim(),
        studentId,
      });
      setReceiptRef("");
      setSubmittingId(null);
      await loadDashboard();
    } catch (requestError) {
      setSubmitError(requestError.message || "Failed to submit payment proof.");
    }
  }

  if (loading) {
    return (
      <FadeIn className="mx-auto max-w-7xl p-6 space-y-6">
        <div className="surface-panel h-48 animate-pulse rounded-2xl bg-stone-800" />
        <div className="surface-panel h-96 animate-pulse rounded-2xl bg-stone-800" />
      </FadeIn>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="status-banner error">{error}</div>
      </div>
    );
  }

  const { parent, child, occupancy, complaints, guestStays } = data || {};

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-8">
      {/* Header */}
      <Reveal duration={0.5}>
        <section className="glass-panel-strong blueprint-border p-8 rounded-[24px] bg-[var(--bg-surface-strong)]">
          <div className="eyebrow">Guardian Command Center</div>
          <h1 className="page-title mt-2 text-gradient">Hello, {parent?.name || "Guardian"}</h1>
          <p className="subtle-copy mt-2">
            Monitor your child's housing context, current accommodation details, safety reports, active guest stays, and rent ledger.
          </p>
        </section>
      </Reveal>

      {!child ? (
        <FadeIn>
          <div className="glass-panel p-12 text-center text-slate-400 rounded-[24px] bg-[var(--bg-surface)] border border-white/5">
            No linked student profile found. Please make sure the student registration was successful.
          </div>
        </FadeIn>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column - Child Profile & Active Occupancy */}
          <div className="lg:col-span-4 space-y-6">
            {/* Child Profile Card */}
            <article className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface)] border border-white/5">
              <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">Student Profile</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Name</p>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">{child.name}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Email</p>
                  <p className="text-sm text-slate-300 mt-0.5">{child.email}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Institution</p>
                  <p className="text-sm text-slate-300 mt-0.5">{child.institution?.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-slate-500">Corridor</p>
                  <p className="text-sm text-slate-300 mt-0.5">{child.corridor?.name || "N/A"}</p>
                </div>
              </div>
            </article>

            {/* Occupancy Card */}
            <article className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface)] border border-white/5">
              <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">Active Occupancy</h2>
              {occupancy ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">Unit ID</p>
                    <p className="text-sm font-semibold text-slate-200 mt-0.5">Unit #{occupancy.unit.id}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">Rent</p>
                    <p className="text-sm text-slate-200 mt-0.5">₹{occupancy.unit.rent} / month</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">Stay Duration</p>
                    <p className="text-sm text-slate-300 mt-0.5">
                      Started: {new Date(occupancy.startDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">Room & Bed Details</p>
                    <p className="text-sm text-slate-300 mt-0.5">
                      Room: {occupancy.occupant?.roomNumber || "N/A"} (Bed: {occupancy.occupant?.occupantIndex || "N/A"})
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">Child is not currently checked into any hostel unit.</p>
              )}
            </article>
          </div>

          {/* Right Column - Active Complaints, Guest Stays, and Payment Ledger */}
          <div className="lg:col-span-8 space-y-6">
            {/* Rent Ledger Card */}
            <article className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface)] border border-white/5">
              <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">Rent Ledger</h2>
              {ledger.length === 0 ? (
                <p className="text-sm text-slate-400">No rent statements or ledger records available.</p>
              ) : (
                <div className="space-y-4">
                  {ledger.map((statement, sIndex) => (
                    <div key={sIndex} className="border border-white/5 rounded-xl p-4 bg-white/5 space-y-3">
                      <div className="flex justify-between items-center text-xs text-slate-400">
                        <span>Stay Period: {new Date(statement.occupancy.startDate).toLocaleDateString()} - Present</span>
                        <span className="font-semibold text-slate-300">Unit #{statement.occupancy.unit?.id}</span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="hidden sm:grid grid-cols-5 text-xs font-semibold uppercase text-slate-500 px-3 pb-1 border-b border-white/5">
                          <div>Month</div>
                          <div>Amount</div>
                          <div>Status</div>
                          <div>Receipt Ref</div>
                          <div className="text-right">Action</div>
                        </div>

                        {statement.payments.map((payment) => {
                          const isExpanded = expandedPaymentId === payment.id;
                          return (
                            <div key={payment.id} className="rounded-lg border border-white/5 bg-black/10 overflow-hidden text-sm">
                              <div 
                                className="grid grid-cols-1 sm:grid-cols-5 items-center gap-2 p-3 cursor-pointer"
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
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
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
                                <div className="text-right flex justify-between sm:block text-xs font-semibold text-sky-400">
                                  <span className="sm:hidden text-slate-500 font-normal">Details:</span>
                                  <span>{isExpanded ? "Hide" : "Open"}</span>
                                </div>
                              </div>

                              <Expand isExpanded={isExpanded}>
                                <div className="p-3 bg-black/30 border-t border-white/5 space-y-2 text-xs text-slate-300">
                                  <p>Rent obligation monthly breakdown for {payment.month}.</p>
                                  {payment.status === "PENDING" && (
                                    <div className="pt-2 border-t border-white/5">
                                      {submittingId === payment.id ? (
                                        <div className="flex flex-col gap-2 max-w-sm">
                                          <input
                                            className="input-shell text-xs py-1.5 px-3 bg-stone-900 border-white/10 text-white rounded-lg"
                                            onChange={(e) => setReceiptRef(e.target.value)}
                                            placeholder="Enter Receipt Reference #"
                                            value={receiptRef}
                                          />
                                          <div className="flex gap-2 justify-end">
                                            <button
                                              className="text-xs text-rose-400 hover:underline"
                                              onClick={() => {
                                                setSubmittingId(null);
                                                setReceiptRef("");
                                              }}
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              className="btn-primary text-xs py-1 px-3"
                                              onClick={() => handleSubmitProof(payment.month, child.id)}
                                            >
                                              Submit Reference
                                            </button>
                                          </div>
                                          {submitError && <p className="text-[10px] text-rose-400">{submitError}</p>}
                                        </div>
                                      ) : (
                                        <button
                                          className="btn-primary text-xs py-1 px-3 font-semibold"
                                          onClick={() => setSubmittingId(payment.id)}
                                        >
                                          Submit Rent Proof
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
                    </div>
                  ))}
                </div>
              )}
            </article>

            {/* Active Guest Stays Card */}
            <article className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface)] border border-white/5">
              <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">Active Guests</h2>
              {guestStays.length === 0 ? (
                <p className="text-sm text-slate-400">No active guests registered for your child's room.</p>
              ) : (
                <div className="space-y-3">
                  {guestStays.map((guest) => (
                    <div key={guest.id} className="flex justify-between items-center p-3 border border-white/5 rounded-xl bg-white/5">
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{guest.guestName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Checked-in: {new Date(guest.startDate).toLocaleString()}
                        </p>
                      </div>
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider bg-emerald-500/20 text-emerald-300">
                        Active Stay
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>

            {/* Child Agreements Card */}
            <article className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface)] border border-white/5">
              <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">Tenancy Agreements</h2>
              {childAgreements.length === 0 ? (
                <p className="text-sm text-slate-400">No agreements registered for your child.</p>
              ) : (
                <div className="space-y-4">
                  {childAgreements.map((agg) => {
                    const isExpanded = expandedAgreementId === agg.id;
                    return (
                      <div key={agg.id} className="p-4 border border-white/5 rounded-xl bg-white/5 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-white">Version {agg.version}</span>
                          <span
                            className={`px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                              agg.status === "ACTIVE"
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {agg.status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                          <div>Rent: ₹{agg.rentAmount}/mo</div>
                          <div>Deposit: ₹{agg.securityDeposit}</div>
                          <div>Notice: {agg.noticePeriodDays} Days</div>
                          <div>
                            Period: {new Date(agg.startDate).toLocaleDateString()} - {new Date(agg.endDate).toLocaleDateString()}
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t border-white/5">
                          <button
                            className="text-xs text-sky-400 font-semibold hover:underline"
                            onClick={() => setExpandedAgreementId(isExpanded ? null : agg.id)}
                          >
                            {isExpanded ? "Hide Legal Disclaimer" : "View Legal Disclaimer"}
                          </button>

                          {agg.documentPath && (
                            <a
                              href={`/api/agreement/document/${agg.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-sky-300 hover:underline font-semibold"
                            >
                              View Signed PDF
                            </a>
                          )}
                        </div>

                        <Expand isExpanded={isExpanded}>
                          <div className="p-3 bg-black/30 rounded-lg text-[11px] text-slate-400 leading-relaxed mt-2">
                            This rental agreement context has been authorized and executed by both the student tenant and the landlord. Signed documentation is retained in compliance with local housing acts.
                          </div>
                        </Expand>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>

            {/* Active Complaints Card */}
            <article className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface)] border border-white/5">
              <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">Active Complaints</h2>
              {complaints.length === 0 ? (
                <p className="text-sm text-slate-400">No active complaints or safety alerts reported for this unit.</p>
              ) : (
                <div className="space-y-3">
                  {complaints.map((complaint) => {
                    const isExpanded = expandedComplaintId === complaint.id;
                    return (
                      <div key={complaint.id} className="p-4 border border-white/5 rounded-xl bg-white/5 space-y-2 text-sm">
                        <div 
                          className="flex justify-between items-center cursor-pointer"
                          onClick={() => setExpandedComplaintId(isExpanded ? null : complaint.id)}
                        >
                          <span className="text-xs font-bold uppercase text-rose-400">Severity {complaint.severity}</span>
                          <div className="flex gap-3 items-center">
                            <span className="text-xs text-slate-500">{new Date(complaint.createdAt).toLocaleDateString()}</span>
                            <span className="text-xs text-sky-400 font-semibold">{isExpanded ? "Hide" : "Open"}</span>
                          </div>
                        </div>
                        <p className="text-slate-200">{complaint.message || "No description provided."}</p>
                        
                        <Expand isExpanded={isExpanded}>
                          <div className="grid gap-2 grid-cols-2 text-xs text-slate-400 border-t border-white/5 pt-2 mt-2">
                            <div>Incident: {complaint.incidentType || "General"}</div>
                            <div>SLA Deadline: {complaint.slaDeadline ? new Date(complaint.slaDeadline).toLocaleDateString() : "None"}</div>
                          </div>
                        </Expand>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>

            {parentAnalytics && parentAnalytics.map((childAnalytics, caIdx) => (
              <article key={caIdx} className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface)] border border-white/5">
                <h2 className="text-lg font-bold text-gradient border-b border-white/10 pb-2">
                  Residency Analytics for {childAnalytics.childName}
                </h2>
                <DawnAnalyticsViewer analytics={childAnalytics.metrics} />
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
