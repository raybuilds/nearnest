"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getRoleClass } from "@/lib/governance";
import { clearSession, getStoredRole, getStoredUser } from "@/lib/session";

const publicLinks = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
];

function getNavItems(role) {
  const shared = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/units", label: "Units" },
    { href: "/complaints", label: "Complaints" },
    { href: "/docs", label: "Docs" },
    { href: "/profile", label: "Profile" },
  ];

  if (role === "admin") {
    return [{ href: "/admin", label: "Governance" }, ...shared];
  }

  return shared;
}

export default function Navbar() {
  const pathname = usePathname();
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);

  const sync = () => {
    const user = getStoredUser();
    setRole(getStoredRole());
    setName(user.name || "");
  };

  useEffect(() => {
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("nearnest:session-changed", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("nearnest:session-changed", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  useEffect(() => {
    setOpen(false);
    sync();
  }, [pathname]);

  const navItems = useMemo(() => getNavItems(role), [role]);
  const initials = useMemo(() => {
    const source = name || "NearNest";
    return source
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((chunk) => chunk[0]?.toUpperCase())
      .join("");
  }, [name]);

  function handleLogout() {
    clearSession();
    window.location.href = "/login";
  }

  const navContent = (
    <>
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-2xl px-4 py-2 text-sm transition ${
              active ? "bg-white/10 text-white shadow-glow" : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(11,13,24,0.72)] backdrop-blur-2xl">
      <div className="page-shell flex min-h-[78px] items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-gradient-to-br from-violet-300 via-sky-300 to-emerald-200 shadow-[0_0_26px_rgba(99,179,255,0.6)]" />
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-gradient" style={{ fontFamily: "var(--font-display)" }}>
                NearNest
              </span>
              <span className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Trust Governance Platform</span>
            </div>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">{navContent}</div>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          {role ? (
            <>
              <span className={getRoleClass(role)}>{role}</span>
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-2 py-1.5">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-300 via-sky-300 to-emerald-200 text-xs font-bold text-slate-950">
                  {initials || "N"}
                </div>
                <div className="pr-2">
                  <p className="text-sm font-medium text-white">{name || "Governance user"}</p>
                  <p className="text-xs text-slate-400">Role-based visibility enforced</p>
                </div>
              </div>
              <button className="btn-ghost" onClick={handleLogout} type="button">
                Logout
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              {publicLinks.map((item) => (
                <Link key={item.href} className={item.label === "Register" ? "btn-primary" : "btn-secondary"} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <button
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white lg:hidden"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span className="sr-only">Toggle navigation</span>
          <span className="relative block h-0.5 w-5 bg-current before:absolute before:left-0 before:top-[-6px] before:h-0.5 before:w-5 before:bg-current after:absolute after:left-0 after:top-[6px] after:h-0.5 after:w-5 after:bg-current" />
        </button>
      </div>

      {open ? (
        <div className="page-shell pb-4 lg:hidden">
          <div className="glass-panel p-4">
            <div className="grid gap-2">{navContent}</div>
            <div className="mt-4 soft-divider pt-4">
              {role ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className={getRoleClass(role)}>{role}</span>
                    <p className="mt-2 text-sm text-slate-300">{name || "Governance user"}</p>
                  </div>
                  <button className="btn-secondary" onClick={handleLogout} type="button">
                    Logout
                  </button>
                </div>
              ) : (
                <div className="grid gap-2">
                  {publicLinks.map((item) => (
                    <Link key={item.href} className="btn-secondary" href={item.href}>
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
