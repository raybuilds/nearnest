"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCorridors, getInstitutions, joinVDP, register } from "@/lib/api";
import { setSessionFromPayload } from "@/lib/session";

const roles = ["student", "landlord"];

export default function RegisterPage() {
  const router = useRouter();
  const [corridors, setCorridors] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    role: "student",
    name: "",
    email: "",
    password: "",
    phone: "",
    corridorId: "",
    institutionId: "",
    intake: "",
  });

  useEffect(() => {
    let active = true;

    async function bootstrap() {
      try {
        const payload = await getCorridors();
        if (!active) return;
        const list = Array.isArray(payload) ? payload : [];
        setCorridors(list);
        setForm((current) => ({ ...current, corridorId: current.corridorId || String(list[0]?.id || "") }));
      } catch (requestError) {
        if (active) setError(requestError.message || "Unable to load corridors.");
      }
    }

    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapInstitutions() {
      if (form.role !== "student" || !form.corridorId) {
        setInstitutions([]);
        return;
      }

      try {
        const payload = await getInstitutions(form.corridorId);
        if (active) setInstitutions(Array.isArray(payload) ? payload : []);
      } catch {
        if (active) setInstitutions([]);
      }
    }

    bootstrapInstitutions();
    return () => {
      active = false;
    };
  }, [form.corridorId, form.role]);

  function update(field, value) {
    setError("");
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = await register({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        ...(form.role === "student"
          ? {
              corridorId: Number(form.corridorId),
              intake: form.intake,
              ...(form.institutionId ? { institutionId: Number(form.institutionId) } : {}),
            }
          : {}),
      });

      setSessionFromPayload(payload);

      if (form.role === "student") {
        await joinVDP({ corridorId: Number(form.corridorId), intake: form.intake });
      }

      router.push("/dashboard");
    } catch (requestError) {
      setError(requestError.message || "Unable to create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="governance-grid items-start">
      <section className="glass-panel-strong blueprint-border lg:col-span-6 p-8 sm:p-10">
        <div className="eyebrow">Registration</div>
        <h1 className="page-title mt-5 text-gradient">Enter the trust-governed housing network.</h1>
        <p className="subtle-copy mt-4 max-w-2xl">
          Student onboarding links you to corridor demand and institutional context. Landlord onboarding links you to the evidence,
          checklist, complaint, and governance workflow for your future units.
        </p>

        <div className="mt-8 grid gap-4">
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Student outcome</p>
            <strong className="mt-2 block text-lg text-white">Demand-gated discovery with visible trust logic</strong>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Landlord outcome</p>
            <strong className="mt-2 block text-lg text-white">Portfolio governance and operational accountability</strong>
          </div>
        </div>
      </section>

      <form className="glass-panel blueprint-border lg:col-span-6 p-8" onSubmit={handleSubmit}>
        <div className="flex flex-wrap gap-3">
          {roles.map((role) => (
            <button
              key={role}
              className={form.role === role ? "btn-primary" : "btn-secondary"}
              onClick={() => update("role", role)}
              type="button"
            >
              {role}
            </button>
          ))}
        </div>

        {error ? <div className="status-banner error mt-5">{error}</div> : null}

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Name</span>
            <input className="input-shell" onChange={(event) => update("name", event.target.value)} value={form.name} />
          </label>
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Email</span>
            <input className="input-shell" onChange={(event) => update("email", event.target.value)} type="email" value={form.email} />
          </label>
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Password</span>
            <input className="input-shell" onChange={(event) => update("password", event.target.value)} type="password" value={form.password} />
          </label>

          {form.role === "student" ? (
            <>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Corridor</span>
                <select className="input-shell" onChange={(event) => update("corridorId", event.target.value)} value={form.corridorId}>
                  <option value="">Select corridor</option>
                  {corridors.map((corridor) => (
                    <option key={corridor.id} value={corridor.id}>
                      {corridor.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Institution</span>
                <select className="input-shell" onChange={(event) => update("institutionId", event.target.value)} value={form.institutionId}>
                  <option value="">Select institution</option>
                  {institutions.map((institution) => (
                    <option key={institution.id} value={institution.id}>
                      {institution.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Intake</span>
                <input className="input-shell" onChange={(event) => update("intake", event.target.value)} placeholder="2026" value={form.intake} />
              </label>
            </>
          ) : (
            <label className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Phone</span>
              <input className="input-shell" onChange={(event) => update("phone", event.target.value)} value={form.phone} />
            </label>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-slate-400">
            Registration creates the identity layer for role-based rendering and governance-aware workflows.
          </p>
          <button className="btn-primary" disabled={loading} type="submit">
            {loading ? "Creating..." : "Create account"}
          </button>
        </div>

        <p className="mt-6 text-sm text-slate-400">
          Already registered?{" "}
          <Link className="text-sky-300" href="/login">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
