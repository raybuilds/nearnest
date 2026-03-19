"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCorridors, getInstitutions, joinVDP, register } from "@/lib/api";
import styles from "./page.module.css";

const roleTabs = ["student", "landlord", "admin"];

export default function RegisterPage() {
  const router = useRouter();
  const [corridors, setCorridors] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [verificationFile, setVerificationFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "student",
    intake: "",
    corridorId: "",
    institutionId: "",
  });

  useEffect(() => {
    let active = true;

    async function loadCorridors() {
      try {
        const payload = await getCorridors();
        if (!active) return;

        const nextCorridors = Array.isArray(payload) ? payload : [];
        setCorridors(nextCorridors);
        setForm((current) => ({
          ...current,
          corridorId: current.corridorId || (nextCorridors[0] ? String(nextCorridors[0].id) : ""),
        }));
      } catch (loadError) {
        if (active) {
          setError(loadError.message || "Failed to load corridors");
        }
      }
    }

    loadCorridors();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInstitutions() {
      if (form.role !== "student" || !form.corridorId) {
        setInstitutions([]);
        return;
      }

      try {
        const payload = await getInstitutions(form.corridorId);
        if (active) {
          setInstitutions(Array.isArray(payload) ? payload : []);
        }
      } catch {
        if (active) {
          setInstitutions([]);
        }
      }
    }

    loadInstitutions();
    return () => {
      active = false;
    };
  }, [form.corridorId, form.role]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (form.role === "admin") {
        throw new Error("Admin self-registration is not available in the current backend.");
      }

      const body = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        ...(form.role === "student"
          ? {
              intake: form.intake,
              corridorId: Number(form.corridorId),
              ...(form.institutionId ? { institutionId: Number(form.institutionId) } : {}),
            }
          : {}),
      };

      const payload = await register(body);
      if (!payload) {
        return;
      }

      localStorage.setItem("token", payload.token || "");
      localStorage.setItem("role", payload.user?.role || "");
      localStorage.setItem("user", JSON.stringify(payload.user || {}));
      localStorage.setItem("userName", payload.user?.name || "");

      if (payload.studentId !== null && payload.studentId !== undefined) {
        localStorage.setItem("studentId", String(payload.studentId));
      } else {
        localStorage.removeItem("studentId");
      }

      if (payload.landlordId !== null && payload.landlordId !== undefined) {
        localStorage.setItem("landlordId", String(payload.landlordId));
      } else {
        localStorage.removeItem("landlordId");
      }

      if (form.role === "student") {
        await joinVDP({
          corridorId: Number(form.corridorId),
          intake: form.intake,
        });
      }

      setSuccess(
        verificationFile
          ? "Account created. Verification file was selected locally, but the backend has no student upload endpoint yet."
          : "Account created successfully."
      );

      router.push("/dashboard");
    } catch (submitError) {
      setError(submitError.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`pageShell ${styles.page}`}>
      <div className={styles.backdrop} />
      <div className={`${styles.shell} fade-up`}>
        <div className={`${styles.infoPanel} glass`}>
          <span className="chip ch-purple">Create your NearNest access</span>
          <h1 className="hero-heading">Verified housing access starts here.</h1>
          <p className={styles.lead}>
            Students can register and join the verified demand pool, while landlords can onboard their portfolio into the
            trust and audit workflow.
          </p>
          <div className={styles.infoGrid}>
            <div className="panel-light">
              <p className="label-caps">Student onboarding</p>
              <strong>Corridor and institution-aware registration</strong>
            </div>
            <div className="panel-light">
              <p className="label-caps">Landlord onboarding</p>
              <strong>Direct access to unit submission and governance</strong>
            </div>
          </div>
        </div>

        <form className={`auth-card ${styles.card}`} onSubmit={handleSubmit}>
          <div className={styles.brandLockup}>
            <div className={styles.logo}>N</div>
            <div>
              <h2 className={styles.title}>Create account</h2>
              <p className={styles.subtitle}>Set up your role and NearNest access</p>
            </div>
          </div>

          <div className={styles.roleTabs}>
            {roleTabs.map((tab) => (
              <button
                key={tab}
                className={tab === form.role ? styles.roleTabActive : styles.roleTab}
                onClick={() => update("role", tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          {error ? <div className="status-banner error">{error}</div> : null}
          {success ? <div className="status-banner success">{success}</div> : null}

          <label className={styles.field}>
            <span>Name</span>
            <input className="auth-input" onChange={(event) => update("name", event.target.value)} type="text" value={form.name} />
          </label>

          <label className={styles.field}>
            <span>Email</span>
            <input className="auth-input" onChange={(event) => update("email", event.target.value)} type="email" value={form.email} />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <input className="auth-input" onChange={(event) => update("password", event.target.value)} type="password" value={form.password} />
          </label>

          {form.role === "student" ? (
            <>
              <label className={styles.field}>
                <span>Intake</span>
                <input className="auth-input" onChange={(event) => update("intake", event.target.value)} placeholder="2026" type="text" value={form.intake} />
              </label>

              <label className={styles.field}>
                <span>Corridor</span>
                <select className="auth-input" onChange={(event) => update("corridorId", event.target.value)} value={form.corridorId}>
                  <option value="">Select corridor</option>
                  {corridors.map((corridor) => (
                    <option key={corridor.id} value={corridor.id}>
                      {corridor.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.field}>
                <span>Institution (optional)</span>
                <select className="auth-input" onChange={(event) => update("institutionId", event.target.value)} value={form.institutionId}>
                  <option value="">Select institution</option>
                  {institutions.map((institution) => (
                    <option key={institution.id} value={institution.id}>
                      {institution.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={styles.uploadZone}>
                <input
                  hidden
                  onChange={(event) => setVerificationFile(event.target.files?.[0] || null)}
                  type="file"
                />
                <span className="label-caps">Attach verification document (optional)</span>
                <strong>{verificationFile?.name || "Choose a file"}</strong>
              </label>
            </>
          ) : null}

          {form.role === "landlord" ? (
            <div className="panel-light">
              <p className="label-caps">Landlord access</p>
              <span>Landlord registration creates your linked landlord profile automatically.</span>
            </div>
          ) : null}

          {form.role === "admin" ? (
            <div className="status-banner warn">Admin registration is visible here, but the current backend only allows student and landlord self-registration.</div>
          ) : null}

          <button className="auth-button" disabled={loading} type="submit">
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p className={styles.footerText}>
            Already registered?{" "}
            <Link href="/login">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
