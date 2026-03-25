"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import UnitCard from "@/components/UnitCard";
import { getAdminUnits, getCorridors, getHiddenReasons, getLandlordUnits, getProfile, getUnits } from "@/lib/api";
import { getStoredRole } from "@/lib/session";

export default function UnitsPage() {
  const [role, setRole] = useState("");
  const [units, setUnits] = useState([]);
  const [hiddenReasons, setHiddenReasons] = useState({ hiddenCount: 0, hiddenUnits: [] });
  const [adminCorridorName, setAdminCorridorName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadUnits() {
      const currentRole = getStoredRole();
      setRole(currentRole);
      setLoading(true);
      setError("");

      try {
        if (!currentRole) {
          if (!active) return;
          setUnits([]);
          setHiddenReasons({ hiddenCount: 0, hiddenUnits: [] });
          return;
        }

        if (currentRole === "student") {
          const profile = await getProfile();
          const corridorId = profile?.identity?.corridorId;
          const [unitPayload, hiddenPayload] = corridorId
            ? await Promise.all([getUnits(corridorId), getHiddenReasons(corridorId)])
            : [[], { hiddenCount: 0, hiddenUnits: [] }];

          if (!active) return;
          setUnits(Array.isArray(unitPayload) ? unitPayload : []);
          setHiddenReasons(hiddenPayload || { hiddenCount: 0, hiddenUnits: [] });
        } else if (currentRole === "landlord") {
          const payload = await getLandlordUnits();
          if (!active) return;
          setUnits(Array.isArray(payload) ? payload : []);
        } else if (currentRole === "admin") {
          const corridors = await getCorridors();
          const corridorList = Array.isArray(corridors) ? corridors : [];
          const defaultCorridor = corridorList[0];

          if (!defaultCorridor) {
            if (!active) return;
            setUnits([]);
            setAdminCorridorName("");
            return;
          }

          const payload = await getAdminUnits(defaultCorridor.id);
          if (!active) return;
          setUnits(Array.isArray(payload) ? payload : []);
          setAdminCorridorName(defaultCorridor.name || "");
        } else {
          if (!active) return;
          setUnits([]);
          setHiddenReasons({ hiddenCount: 0, hiddenUnits: [] });
        }
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load units.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUnits().catch((requestError) => {
      if (active) {
        setError(requestError.message || "Unable to load units.");
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid gap-6">
      <section className="glass-panel-strong blueprint-border p-8 sm:p-10">
        <div className="eyebrow">
          {role === "student" ? "Student inventory" : role === "admin" ? "Admin governance inventory" : "Portfolio inventory"}
        </div>
        <h1 className="page-title mt-5 text-gradient">
          {!role
            ? "Trust-governed inventory access"
            : role === "student"
              ? "Visibility-led housing inventory"
              : role === "admin"
                ? "Governed corridor inventory"
                : "Governed unit inventory"}
        </h1>
        <p className="subtle-copy mt-4 max-w-3xl">
          {!role
            ? "NearNest only reveals governed inventory inside authenticated role-based workflows. Sign in to see the units your role is allowed to evaluate."
            : role === "student"
              ? "This page prioritizes why units remain visible or hidden inside the trust system."
              : role === "admin"
                ? `This view surfaces governed units for ${adminCorridorName || "the active corridor"} with trust and status context.`
                : "This page focuses on trust score, complaint pressure, and governance posture across your units."}
        </p>
      </section>

      {error ? <div className="status-banner error">{error}</div> : null}

      {!role && !loading ? (
        <section className="glass-panel p-8">
          <div className="max-w-2xl">
            <div className="eyebrow">Role-based access</div>
            <h2 className="section-title mt-4">Inventory is not public browsing</h2>
            <p className="subtle-copy mt-4">
              NearNest is a trust-driven governance platform, so units are shown only after login and only within the correct role context.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-primary" href="/login">
                Login to continue
              </Link>
              <Link className="btn-secondary" href="/register">
                Create account
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <div key={index} className="surface-panel h-72 animate-pulse" />)
        ) : units.length ? (
          units.map((unit) => <UnitCard key={unit.id} compact showForStudent={role === "student"} unit={unit} />)
        ) : (
          <div className="empty-state xl:col-span-2">
            {!role ? "Sign in to access governed inventory." : "No units are available for this role right now."}
          </div>
        )}
      </section>

      {role === "student" ? (
        <section className="glass-panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Hidden inventory</div>
              <h2 className="section-title mt-4">Blocked by governance</h2>
            </div>
            <span className="signal-chip signal-danger">{hiddenReasons.hiddenCount || 0} hidden</span>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {(hiddenReasons.hiddenUnits || []).map((item) => (
              <article key={item.unitId} className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                <strong className="text-white">Unit {item.unitId}</strong>
                <div className="mt-3 grid gap-2">
                  {(item.reasons || []).map((reason) => (
                    <p key={reason} className="text-sm leading-6 text-slate-300">
                      {reason}
                    </p>
                  ))}
                </div>
              </article>
            ))}
            {!hiddenReasons.hiddenUnits?.length ? <div className="empty-state md:col-span-2">No hidden units found.</div> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
