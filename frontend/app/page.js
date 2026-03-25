"use client";

import Link from "next/link";

const roleCards = [
  {
    role: "Student",
    responsibility: "Only sees supply that still meets trust and governance thresholds.",
    gain: "Clear visibility logic, safer discovery, and Dawn-assisted explanations.",
  },
  {
    role: "Landlord",
    responsibility: "Maintains evidence, checklists, SLA performance, and trust resilience.",
    gain: "Portfolio clarity, demand signals, and earlier intervention before suspension.",
  },
  {
    role: "Admin",
    responsibility: "Governs approvals, audits, corridor risk, and system-triggered visibility.",
    gain: "Transparent control over why units surface, pause, or disappear.",
  },
];

const principles = [
  "Behavior generates signals.",
  "Signals shape trust.",
  "Trust drives governance action.",
  "Governance determines visibility.",
];

export default function HomePage() {
  return (
    <div className="grid gap-8 pb-6">
      <section className="governance-grid items-stretch">
        <div className="glass-panel-strong blueprint-border fade-in-up lg:col-span-7 p-8 sm:p-10 lg:p-12">
          <div className="eyebrow">Behavioral Student Housing Governance</div>
          <h1 className="page-title mt-6 max-w-3xl text-gradient">
            Housing you can trust. Not just listings.
          </h1>
          <p className="subtle-copy mt-6 max-w-2xl">
            NearNest is a demand-gated governance platform for student housing. Units do not appear because they exist.
            They appear because their behavior, complaint history, SLA performance, and evidence posture still justify visibility.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link className="btn-primary" href="/dashboard">
              Enter Platform
            </Link>
            <Link className="btn-secondary" href="/docs">
              Read Docs
            </Link>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {principles.map((item, index) => (
              <div key={item} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Step {index + 1}</p>
                <strong className="mt-2 block text-lg text-white">{item}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="fade-in-up-delayed grid gap-4 lg:col-span-5">
          {roleCards.map((card) => (
            <article key={card.role} className="glass-panel blueprint-border p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title">{card.role}</h2>
                <span className={`role-badge role-${card.role.toLowerCase()}`}>{card.role}</span>
              </div>
              <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Responsibility</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{card.responsibility}</p>
              </div>
              <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">What they gain</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">{card.gain}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="glass-panel p-8 sm:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="eyebrow">Visibility Logic</div>
            <h2 className="section-title mt-4">Every surface answers why a unit is visible or hidden</h2>
            <p className="subtle-copy mt-3 max-w-2xl">
              NearNest avoids black-box housing discovery. Students see transparency notes, landlords see trust pressure,
              and admins see the exact governance signal behind every approval, suspension, and audit.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[420px]">
            <div className="metric-tile">
              <p>Transparency</p>
              <strong>Always On</strong>
              <span>No hidden decision-making in visibility logic.</span>
            </div>
            <div className="metric-tile">
              <p>Dawn</p>
              <strong>Assistive</strong>
              <span>Explains intelligence, but never makes governance decisions.</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
