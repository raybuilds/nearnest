const pillars = [
  {
    title: "Behavior",
    body: "Complaints, evidence quality, self-declaration accuracy, and resolution behavior feed the system.",
  },
  {
    title: "Signals",
    body: "Complaint density, SLA breaches, incident flags, and audit triggers are translated into visible operational signals.",
  },
  {
    title: "Trust",
    body: "Trust score is not cosmetic. It determines whether a unit remains visible or starts sliding toward restriction.",
  },
  {
    title: "Governance",
    body: "Admins and rules enforce approval, suspension, audit, and corrective plans based on traceable causes.",
  },
  {
    title: "Visibility",
    body: "Students only see supply that still meets the trust and governance bar for safe discovery.",
  },
];

const dawnCapabilities = [
  "Draft complaint language from a situation description.",
  "Explain why a unit is visible or hidden.",
  "Recommend safer units from live intelligence.",
  "Summarize corridor risk and operational pressure.",
];

export default function DocsPage() {
  return (
    <div className="grid gap-6">
      <section className="glass-panel-strong blueprint-border p-8 sm:p-10">
        <div className="eyebrow">Platform Docs</div>
        <h1 className="page-title mt-5 text-gradient">NearNest is governance software disguised as housing UX.</h1>
        <p className="subtle-copy mt-4 max-w-3xl">
          This platform is deliberately not a generic listing marketplace. Every page, card, and action exists to expose why
          a unit is visible, hidden, suspended, or trusted.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        {pillars.map((pillar) => (
          <article key={pillar.title} className="glass-panel p-5">
            <div className="eyebrow">{pillar.title}</div>
            <p className="mt-4 text-sm leading-6 text-slate-300">{pillar.body}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="glass-panel p-6">
          <div className="eyebrow">Role Model</div>
          <div className="mt-5 grid gap-4">
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
              Students receive trust-filtered visibility, not raw inventory volume.
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
              Landlords manage evidence, trust decline, complaint pressure, and audit exposure.
            </div>
            <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
              Admins see corridor risk, governance triggers, and distribution of trust across supply.
            </div>
          </div>
        </article>

        <article className="glass-panel p-6">
          <div className="eyebrow">Dawn Assistant</div>
          <div className="mt-5 grid gap-3">
            {dawnCapabilities.map((item) => (
              <div key={item} className="rounded-[24px] border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-300">
                {item}
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-400">
            Dawn is not the decision-maker. It is the interface to intelligence and explanation.
          </p>
        </article>
      </section>
    </div>
  );
}
