"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCorridors, getUnits } from "@/lib/api";
import { getStoredRole } from "@/lib/session";
import UnitCard from "@/components/UnitCard";
import { FadeIn, Reveal } from "@/components/ui/Motion";

const highlights = [
  {
    title: "Visibility-led discovery",
    body: "Students browse governed inventory instead of raw supply volume, with clearer reasoning attached to each unit.",
  },
  {
    title: "Complaint-led governance",
    body: "Issues are not buried in support workflows. They directly influence trust posture, audit pressure, and visibility.",
  },
  {
    title: "Dawn as explanation layer",
    body: "Dawn helps interpret housing intelligence, compare options, and draft complaints without replacing platform rules.",
  },
];

export default function HomePage() {
  const [role, setRole] = useState("");
  const [corridors, setCorridors] = useState([]);
  const [selectedCorridor, setSelectedCorridor] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRole(getStoredRole() || "");
    async function loadCorridors() {
      try {
        const list = await getCorridors();
        if (Array.isArray(list)) {
          setCorridors(list);
          if (list.length > 0) {
            setSelectedCorridor(list[0]);
          }
        }
      } catch (_) {}
    }
    loadCorridors();
  }, []);

  useEffect(() => {
    if (!selectedCorridor) return;
    async function loadUnits() {
      setLoading(true);
      try {
        const data = await getUnits(selectedCorridor.id);
        if (Array.isArray(data)) {
          setUnits(data.slice(0, 4)); // Show top 4 preview units
        }
      } catch (_) {}
      setLoading(false);
    }
    loadUnits();
  }, [selectedCorridor]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:py-12 md:py-16">
      {/* Editorial Hero */}
      <section className="mb-16 md:mb-24">
        <Reveal duration={0.6}>
          <span className="text-xs font-bold uppercase tracking-[0.35em] text-[var(--color-terracotta)]">
            NearNest Student Housing
          </span>
        </Reveal>
        <Reveal duration={0.7} delay={0.1}>
          <h1 
            className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-[3.25rem] md:text-[4rem] max-w-4xl"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-main)" }}
          >
            Housing discovery guided by trust, safety, and accountability.
          </h1>
        </Reveal>
        <Reveal duration={0.8} delay={0.2}>
          <p 
            className="mt-8 text-base leading-relaxed sm:text-lg md:text-xl max-w-2xl" 
            style={{ color: "var(--text-muted)" }}
          >
            We connect students with governed properties where compliance records, complaint context, 
            and trust indicators are built directly into the search experience.
          </p>
        </Reveal>
        <Reveal duration={0.8} delay={0.3} className="mt-10 flex flex-wrap gap-4">
          <Link className="btn-primary" href="/units">
            Explore All Units
          </Link>
          <Link className="btn-secondary" href="/docs">
            How Governance Works
          </Link>
        </Reveal>
      </section>

      {/* Corridor Explorer Section */}
      <section className="mb-20 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <Reveal duration={0.5}>
            <span className="text-xs font-bold uppercase tracking-[0.28em]" style={{ color: "var(--text-soft)" }}>
              Locations & Zones
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--text-main)" }}>
              Explore Corridors
            </h2>
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Select a governed academic cluster to inspect compliant student hostels and active housing units nearby.
            </p>
          </Reveal>

          {/* Corridor Selection List */}
          <div className="mt-8 flex flex-col gap-2.5">
            {corridors.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCorridor(c)}
                className={`w-full text-left rounded-xl px-5 py-4 transition-all duration-300 border flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-teal)] ${
                  selectedCorridor?.id === c.id
                    ? "bg-[var(--bg-soft-strong)] border-[var(--border-strong)] shadow-sm translate-x-1"
                    : "bg-transparent border-[var(--border)] hover:bg-[var(--bg-soft)]"
                }`}
                type="button"
              >
                <strong className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                  {c.name}
                </strong>
                <span className="mt-1 text-[11px] uppercase tracking-wider" style={{ color: "var(--text-soft)" }}>
                  City Code {c.cityCode}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Corridor Preview Units Grid */}
        <div className="lg:col-span-8">
          <div className="mb-6 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-soft)" }}>
              Previewing {selectedCorridor?.name || "Corridor"}
            </span>
            <Link href="/units" className="text-xs font-semibold uppercase tracking-wider text-[var(--color-terracotta)] hover:underline">
              View catalog &rarr;
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {loading ? (
              Array.from({ length: 2 }).map((_, idx) => (
                <div key={idx} className="glass-panel h-[320px] animate-pulse rounded-2xl" />
              ))
            ) : units.length > 0 ? (
              units.map((unit) => (
                <FadeIn key={unit.id}>
                  <UnitCard unit={unit} compact showForStudent={role === "student"} />
                </FadeIn>
              ))
            ) : (
              <div className="glass-panel text-center py-16 md:col-span-2 text-sm" style={{ color: "var(--text-soft)" }}>
                No active units discoverable in this zone.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Trust & Highlights */}
      <section className="border-t border-[var(--border)] pt-16">
        <div className="grid gap-10 md:grid-cols-3">
          {highlights.map((h, idx) => (
            <Reveal key={idx} delay={idx * 0.1} duration={0.5} className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-terracotta)]">
                0{idx + 1}
              </span>
              <h3 className="mt-4 text-lg font-bold" style={{ color: "var(--text-main)" }}>
                {h.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {h.body}
              </p>
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
