"use client";

import { useEffect, useState } from "react";
import { getGuestStays, checkInGuest, checkOutGuest } from "@/lib/api";
import { requireSessionOrRedirect } from "@/lib/session";
import { FadeIn, Reveal } from "@/components/ui/Motion";

export default function StudentGuestsPage() {
  const [stays, setStays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [guestName, setGuestName] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function loadStays() {
    setLoading(true);
    setError("");
    try {
      const payload = await getGuestStays();
      setStays(Array.isArray(payload) ? payload : []);
    } catch (requestError) {
      setError(requestError.message || "Failed to load guest logs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (requireSessionOrRedirect()) {
      loadStays();
    }
  }, []);

  async function handleCheckIn(e) {
    e.preventDefault();
    if (!guestName.trim()) {
      setError("Guest name is required.");
      return;
    }
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await checkInGuest({ guestName: guestName.trim() });
      setGuestName("");
      setSuccess("Guest registered and checked-in successfully.");
      await loadStays();
    } catch (requestError) {
      setError(requestError.message || "Failed to register guest.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCheckOut(id) {
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await checkOutGuest(id);
      setSuccess("Guest checked-out successfully.");
      await loadStays();
    } catch (requestError) {
      setError(requestError.message || "Failed to check out guest.");
    } finally {
      setActionLoading(false);
    }
  }

  const activeStays = stays.filter((s) => s.active);
  const historicalStays = stays.filter((s) => !s.active);

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
          <h1 className="page-title mt-2 text-gradient">Guest & Stay Logs</h1>
          <p className="subtle-copy mt-2">
            Register new overnight guests, check out active stays, and review your historical guest logs.
          </p>
        </section>
      </Reveal>

      {error && <div className="status-banner error">{error}</div>}
      {success && <div className="status-banner success">{success}</div>}

      <div className="grid gap-6 md:grid-cols-12">
        {/* Check-In Form */}
        <section className="md:col-span-4 glass-panel p-6 rounded-[24px] h-fit bg-[var(--bg-surface)] border border-white/5">
          <h2 className="text-lg font-bold text-white border-b border-white/10 pb-2">Register New Guest</h2>
          <form className="mt-4 space-y-4" onSubmit={handleCheckIn}>
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Guest Name</span>
              <input
                className="input-shell text-sm py-2 px-3 bg-stone-900 border-white/10 text-white rounded-lg"
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Enter guest's full name"
                value={guestName}
                disabled={actionLoading}
              />
            </label>
            <button className="btn-primary w-full text-xs py-2.5 font-semibold tracking-wider" disabled={actionLoading} type="submit">
              {actionLoading ? "Registering..." : "Register Guest"}
            </button>
          </form>
        </section>

        {/* Guest Logs */}
        <div className="md:col-span-8 space-y-6">
          {/* Active Stays */}
          <section className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface)] border border-white/5">
            <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2">Active Guests</h3>
            {activeStays.length === 0 ? (
              <p className="text-sm text-slate-400">No active guests registered.</p>
            ) : (
              <div className="space-y-3">
                {activeStays.map((guest, idx) => (
                  <Reveal key={guest.id} delay={idx * 0.05} duration={0.4}>
                    <div className="flex justify-between items-center p-4 border border-white/5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{guest.guestName}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Stay started: {new Date(guest.startDate).toLocaleString()}
                        </p>
                      </div>
                      <button
                        className="btn-secondary text-xs hover:border-rose-500 hover:text-rose-300 transition-colors"
                        disabled={actionLoading}
                        onClick={() => handleCheckOut(guest.id)}
                      >
                        Check Out
                      </button>
                    </div>
                  </Reveal>
                ))}
              </div>
            )}
          </section>

          {/* Historical Stays */}
          <section className="glass-panel p-6 rounded-[24px] space-y-4 bg-[var(--bg-surface)] border border-white/5">
            <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2">Historical Logs</h3>
            {historicalStays.length === 0 ? (
              <p className="text-sm text-slate-400">No historical stay logs found.</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {historicalStays.map((guest) => (
                  <div key={guest.id} className="p-4 border border-white/5 rounded-xl bg-white/5 space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-semibold text-slate-200">{guest.guestName}</p>
                      <span className="text-xs text-slate-500 font-medium">Checked Out</span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>In: {new Date(guest.startDate).toLocaleString()}</span>
                      <span>Out: {guest.endDate ? new Date(guest.endDate).toLocaleString() : "N/A"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
