"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Navbar() {
  const [role, setRole] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem("role") || "");
  }, []);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("userId");
    localStorage.removeItem("studentId");
    localStorage.removeItem("landlordId");
    localStorage.removeItem("corridorId");
    window.location.href = "/login";
  }

  return (
    <nav className="flex items-center justify-between">
      <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
        NearNest
      </Link>
      <div className="flex items-center gap-2">
        {!role && (
          <>
            <Link className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" href="/login">
              Login
            </Link>
            <Link className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" href="/register">
              Register
            </Link>
          </>
        )}
        {role === "student" && (
          <>
            <Link className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" href="/dashboard">
              Dashboard
            </Link>
            <Link className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" href="/complaints">
              Complaints
            </Link>
          </>
        )}
        {role === "landlord" && (
          <>
            <Link className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" href="/dashboard">
              Landlord
            </Link>
            <Link className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" href="/complaints">
              Complaints
            </Link>
          </>
        )}
        {role === "admin" && (
          <>
            <Link className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" href="/dashboard">
              Dashboard
            </Link>
            <Link className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" href="/complaints">
              Complaints
            </Link>
            <Link className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" href="/admin">
              Admin
            </Link>
          </>
        )}
        {role && (
          <>
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-700">{role}</span>
            <button className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100" onClick={logout} type="button">
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
