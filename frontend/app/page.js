"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">NearNest Frontend</h1>
      <p className="text-slate-600">Choose a module:</p>
      <div className="flex gap-3">
        <Link className="rounded bg-slate-900 px-4 py-2 text-white" href="/register">
          Register
        </Link>
        <Link className="rounded bg-slate-900 px-4 py-2 text-white" href="/dashboard">
          Dashboard
        </Link>
        <Link className="rounded bg-slate-900 px-4 py-2 text-white" href="/admin">
          Admin
        </Link>
      </div>
    </div>
  );
}
