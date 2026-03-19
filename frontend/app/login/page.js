"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { login } from "@/lib/api";
import styles from "./page.module.css";

const roleTabs = ["student", "landlord", "admin"];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleTab, setRoleTab] = useState("student");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSessionExpired(params.get("reason") === "session-expired");
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = await login({ email, password });
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

      router.push("/dashboard");
    } catch (submitError) {
      setError(submitError.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`pageShell ${styles.page}`}>
      <div className={styles.backdrop} />
      <div className={`${styles.shell} fade-up`}>
        <div className={`${styles.brandPanel} glass`}>
          <span className="chip ch-blue">NearNest Access</span>
          <h1 className="hero-heading">Sign in to the housing command layer.</h1>
          <p className={styles.lead}>
            Access verified units, complaint timelines, trust visibility, and Dawn-powered operational guidance.
          </p>
          <div className={styles.featureList}>
            <div className="panel-light">
              <p className="label-caps">Trust visibility</p>
              <strong>Live governance data</strong>
            </div>
            <div className="panel-light">
              <p className="label-caps">Dawn assistance</p>
              <strong>Structured chat and insight cards</strong>
            </div>
          </div>
        </div>

        <form className={`auth-card ${styles.card}`} onSubmit={handleSubmit}>
          <div className={styles.brandLockup}>
            <div className={styles.logo}>N</div>
            <div>
              <h2 className={styles.title}>NearNest</h2>
              <p className={styles.subtitle}>Sign in to continue</p>
            </div>
          </div>

          <div className={styles.roleTabs}>
            {roleTabs.map((tab) => (
              <button
                key={tab}
                className={tab === roleTab ? styles.roleTabActive : styles.roleTab}
                onClick={() => setRoleTab(tab)}
                type="button"
              >
                {tab}
              </button>
            ))}
          </div>

          {sessionExpired ? <div className="status-banner warn">Your session expired. Please sign in again.</div> : null}
          {error ? <div className="status-banner error">{error}</div> : null}

          <label className={styles.field}>
            <span>Email</span>
            <input
              className="auth-input"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </label>

          <label className={styles.field}>
            <span>Password</span>
            <input
              className="auth-input"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              type="password"
              value={password}
            />
          </label>

          <button className="auth-button" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className={styles.footerText}>
            New here?{" "}
            <Link href="/register">
              Create your account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
