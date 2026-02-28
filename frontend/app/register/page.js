"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [intake, setIntake] = useState("2026A");
  const [corridorId, setCorridorId] = useState("");
  const [institutionId, setInstitutionId] = useState("");
  const [corridors, setCorridors] = useState([]);
  const [institutions, setInstitutions] = useState([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [loadingCorridors, setLoadingCorridors] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await apiRequest("/corridors");
        setCorridors(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingCorridors(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!corridorId || role !== "student") {
      setInstitutions([]);
      setInstitutionId("");
      return;
    }

    (async () => {
      setLoadingInstitutions(true);
      try {
        const data = await apiRequest(`/institutions/${Number(corridorId)}`);
        setInstitutions(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingInstitutions(false);
      }
    })();
  }, [corridorId, role]);

  async function onSubmit(e) {
    e.preventDefault();
    setStatus("");
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        name,
        email,
        password,
        role,
      };
      if (role === "student") {
        payload.intake = intake;
        payload.corridorId = Number(corridorId);
        payload.institutionId = institutionId ? Number(institutionId) : null;
      }

      const result = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      localStorage.setItem("token", result.token);
      localStorage.setItem("role", result.user.role);
      localStorage.setItem("userId", String(result.user.id));
      if (result.studentId) {
        localStorage.setItem("studentId", String(result.studentId));
      }
      if (result.landlordId) {
        localStorage.setItem("landlordId", String(result.landlordId));
      }
      if (role === "student") {
        localStorage.setItem("corridorId", String(corridorId));
        await apiRequest("/vdp", {
          method: "POST",
          body: JSON.stringify({
            corridorId: Number(corridorId),
            intake,
          }),
        });
      }

      setStatus("Registration successful. Redirecting...");
      window.setTimeout(() => {
        window.location.href = "/dashboard";
      }, 600);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Create Account</h1>
      <form onSubmit={onSubmit} className="grid max-w-xl gap-3 rounded-xl border bg-white p-5 shadow-sm">
        <input className="rounded border p-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="rounded border p-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input
          className="rounded border p-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <select className="rounded border p-2" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="student">Student</option>
          <option value="landlord">Landlord</option>
          <option value="admin">Admin</option>
        </select>

        {role === "student" && (
          <>
            <input className="rounded border p-2" placeholder="Intake (e.g. 2026A)" value={intake} onChange={(e) => setIntake(e.target.value)} required />
            <select className="rounded border p-2" value={corridorId} onChange={(e) => setCorridorId(e.target.value)} required>
              <option value="">{loadingCorridors ? "Loading corridors..." : "Select corridor"}</option>
              {corridors.map((corridor) => (
                <option key={corridor.id} value={corridor.id}>
                  #{corridor.id} - {corridor.name}
                </option>
              ))}
            </select>
            <select className="rounded border p-2" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
              <option value="">
                {corridorId
                  ? loadingInstitutions
                    ? "Loading institutions..."
                    : "Select institution (optional)"
                  : "Select corridor first"}
              </option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
          </>
        )}

        <button className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60" type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Register"}
        </button>
      </form>
      {status && <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">{status}</p>}
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
