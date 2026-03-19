import styles from "./page.module.css";

const architectureNodes = [
  { title: "App Router", body: "Next.js 14 frontend with role-aware client pages and shared API service calls." },
  { title: "Express API", body: "Backend endpoints drive auth, units, complaints, audits, profiles, and Dawn intelligence." },
  { title: "Trust Logic", body: "Trust bands remain priority, standard, or hidden, with visibility and audit banners surfaced in UI." },
  { title: "Operational AI", body: "Dawn handles structured insight cards, complaint drafting, trust explanations, and advisory responses." },
];

const launchFlow = [
  "Register as a student or landlord and complete login to establish the local session.",
  "Students join the demand pool, browse visible units, shortlist housing, and submit complaints.",
  "Landlords publish draft units, upload required evidence, submit for review, and track complaints or audits.",
  "Admins review units, manage corridor resources, and resolve audit workflows through governance screens.",
];

const demoAccounts = [
  { role: "Student", email: "student@nearnest.local", password: "student123" },
  { role: "Landlord", email: "landlord@nearnest.local", password: "landlord123" },
  { role: "Admin", email: "admin@nearnest.local", password: "admin123" },
];

const apiHighlights = ["/auth/login", "/units/:corridorId", "/complaint", "/profile", "/admin/units/:corridorId", "/dawn/query"];

export default function DocsPage() {
  return (
    <div className={styles.page}>
      <section className={`${styles.hero} glass fade-up`}>
        <p className="label-caps">NearNest docs</p>
        <h1 className="hero-heading">NearNest docs</h1>
        <p className={styles.subtitle}>Product overview, launch flow, and backend route highlights for the current platform build.</p>
      </section>

      <section className="panel fade-up-d1">
        <p className="label-caps">Product overview</p>
        <p className={styles.copy}>
          NearNest is a student housing workflow that combines verified demand, trust-scored unit discovery, complaint tracking,
          landlord operations, audit governance, and Dawn-assisted intelligence.
        </p>
      </section>

      <section className="panel fade-up-d2">
        <p className="label-caps">Architecture snapshot</p>
        <div className="docs-grid">
          {architectureNodes.map((node) => (
            <article key={node.title} className="docs-node">
              <strong>{node.title}</strong>
              <p className={styles.copy}>{node.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.grid} fade-up-d3`}>
        <article className="panel">
          <p className="label-caps">Launch flow</p>
          <ol className={styles.flow}>
            {launchFlow.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </article>

        <article className="panel">
          <p className="label-caps">Demo accounts</p>
          <div className={styles.table}>
            {demoAccounts.map((account) => (
              <div key={account.role} className={styles.tableRow}>
                <strong>{account.role}</strong>
                <span>{account.email}</span>
                <code>{account.password}</code>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel-light fade-up-d3">
        <p className="label-caps">API route highlights</p>
        <div className={styles.apiList}>
          {apiHighlights.map((route) => (
            <code key={route}>{route}</code>
          ))}
        </div>
      </section>
    </div>
  );
}
