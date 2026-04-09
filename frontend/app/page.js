"use client";

import Link from "next/link";

const roleCards = [
  {
    role: "Student",
    responsibility: "Discovers governed housing with trust signals, complaint context, and transparent visibility logic.",
    gain: "Safer discovery with clearer reasons behind what appears, what disappears, and what Dawn can explain.",
  },
  {
    role: "Landlord",
    responsibility: "Operates units through evidence quality, complaint resolution, and trust resilience.",
    gain: "A sharper operating view of portfolio health before governance pressure becomes suspension.",
  },
  {
    role: "Admin",
    responsibility: "Oversees audits, corridor risk, approvals, and corrective governance action.",
    gain: "A system-wide lens on why visibility exists and where intervention is actually required.",
  },
];

const principles = [
  "Behavior produces signals",
  "Signals shape trust",
  "Trust governs visibility",
  "Complaints drive accountability",
];

const highlights = [
  {
    title: "Trust-led discovery",
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
  return (
    <div className="grid gap-8 pb-10">
      <section className="governance-grid items-stretch">
        <div className="glass-panel-strong blueprint-border fade-in-up relative overflow-hidden p-8 sm:p-10 lg:col-span-8 lg:p-12">
          <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(116,240,218,0.18),transparent_60%)]" />
          <div className="relative">
            <div className="eyebrow">Premium Student Housing Governance</div>
            <p className="editorial-kicker mt-6">NearNest makes trust visible before a student commits.</p>
            <h1 className="page-title mt-4 max-w-4xl">
              Student housing discovery with governance, trust, and complaints built into the interface.
            </h1>
            <p className="subtle-copy mt-6 max-w-2xl">
              NearNest is not a listings wall. It is a student housing platform where complaint history, evidence posture,
              trust score, and governance actions determine what students see and how landlords operate.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link className="btn-primary" href="/dashboard">
                Enter NearNest
              </Link>
              <Link className="btn-secondary" href="/docs">
                Explore how it works
              </Link>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {principles.map((item, index) => (
                <div key={item} className="mosaic-tile">
                  <p className="text-[11px] uppercase tracking-[0.28em]" style={{ color: "var(--text-soft)" }}>
                    Framework {index + 1}
                  </p>
                  <strong className="mt-3 block text-lg" style={{ color: "var(--text-main)" }}>
                    {item}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="fade-in-up-delayed grid gap-4 lg:col-span-4">
          <div className="story-card min-h-[210px]">
            <div className="eyebrow">Live product identity</div>
            <h2 className="section-title mt-4">A consumer-grade housing experience with operational depth.</h2>
            <p className="subtle-copy mt-4">
              NearNest speaks to students, landlords, and admins without flattening their responsibilities into one generic dashboard.
            </p>
          </div>

          <div className="dawn-panel p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-[linear-gradient(135deg,var(--accent-mint),var(--accent-cyan),#d9fff4)] text-sm font-bold" style={{ color: "var(--text-inverse)" }}>
                D
              </div>
              <div>
                <p className="editorial-kicker">Core assistant experience</p>
                <p className="mt-1 text-lg font-semibold" style={{ color: "var(--text-main)" }}>
                  Dawn explains trust, risk, and next actions.
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-200/90">
              Dawn is branded into the product as the intelligence and explanation layer, not a generic floating chatbot.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {roleCards.map((card) => (
          <article key={card.role} className="story-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">{card.role}</h2>
              <span className={`role-badge role-${card.role.toLowerCase()}`}>{card.role}</span>
            </div>
            <div className="mt-5 rounded-[24px] p-4" style={{ background: "var(--bg-soft)", border: "1px solid var(--border)" }}>
              <p className="editorial-kicker">Responsibility</p>
              <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-muted)" }}>{card.responsibility}</p>
            </div>
            <div className="mt-4 rounded-[24px] p-4" style={{ background: "var(--bg-soft)", border: "1px solid var(--border)" }}>
              <p className="editorial-kicker">What changes in the UI</p>
              <p className="mt-3 text-sm leading-6" style={{ color: "var(--text-muted)" }}>{card.gain}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="glass-panel p-8 sm:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="eyebrow">Why NearNest Feels Different</div>
            <h2 className="section-title mt-4">The interface keeps housing trust understandable, not hidden in backend logic.</h2>
            <p className="subtle-copy mt-3">
              Each page is meant to show why visibility exists, why complaint pressure matters, and why Dawn can explain but
              not override the system.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[440px]">
            <div className="metric-tile">
              <p>Visibility model</p>
              <strong>Traceable</strong>
              <span>Students and operators can see the reasons behind what is discoverable.</span>
            </div>
            <div className="metric-tile">
              <p>System feel</p>
              <strong>Premium</strong>
              <span>Editorial layout, softer surfaces, and stronger hierarchy replace generic SaaS glass.</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {highlights.map((item) => (
          <article key={item.title} className="glass-panel p-6">
            <p className="editorial-kicker">{item.title}</p>
            <p className="mt-4 text-base leading-7" style={{ color: "var(--text-muted)" }}>
              {item.body}
            </p>
          </article>
        ))}
      </section>

      <footer className="glass-panel-strong p-8 sm:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="eyebrow">NearNest</div>
            <h2 className="section-title mt-4">Governed housing discovery for students, landlords, and admins.</h2>
            <p className="subtle-copy mt-4">
              Trust-driven visibility, complaint-led governance, landlord operations, admin oversight, and Dawn as the
              explanation interface all belong in the same product language.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="btn-secondary" href="/units">
              Browse governed units
            </Link>
            <Link className="btn-primary" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
