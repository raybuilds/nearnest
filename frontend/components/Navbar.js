"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getRoleClass } from "@/lib/governance";
import { clearSession, getStoredRole, getStoredUser } from "@/lib/session";
import ThemeToggle from "@/components/ThemeToggle";

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
              active ? "shadow-glow" : ""
            }`}
            style={
              active
                ? { background: "var(--bg-soft-strong)", color: "var(--text-main)" }
                : { color: "var(--text-muted)" }
            }
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <header className="nav-shell sticky top-0 z-50">
      <div className="page-shell flex min-h-[84px] items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 rounded-full bg-[linear-gradient(135deg,var(--accent-mint),var(--accent-cyan),#d9fff4)] shadow-[0_0_28px_rgba(70,209,189,0.45)]" />
            <div className="flex flex-col">
              <span className="text-lg font-semibold text-gradient" style={{ fontFamily: "var(--font-display)" }}>
                NearNest
              </span>
              <span className="text-[10px] uppercase tracking-[0.28em]" style={{ color: "var(--text-soft)" }}>
                Student housing trust platform
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">{navContent}</div>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          {role ? (
            <>
              <span className={getRoleClass(role)}>{role}</span>
              <div className="flex items-center gap-3 rounded-full px-2 py-1.5" style={{ border: "1px solid var(--border)", background: "var(--bg-soft)" }}>
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[linear-gradient(135deg,var(--accent-mint),var(--accent-cyan),#d9fff4)] text-xs font-bold" style={{ color: "var(--text-inverse)" }}>
                  {initials || "N"}
                </div>
                <div className="pr-2">
                  <p className="text-sm font-medium" style={{ color: "var(--text-main)" }}>{name || "Governance user"}</p>
                  <p className="text-xs" style={{ color: "var(--text-soft)" }}>Role-based visibility enforced</p>
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl lg:hidden"
          style={{ border: "1px solid var(--border)", background: "var(--bg-soft)", color: "var(--text-main)" }}
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
            <div className="mb-3 flex items-center justify-between gap-3">
              <ThemeToggle />
            </div>
            <div className="grid gap-2">{navContent}</div>
            <div className="mt-4 soft-divider pt-4">
              {role ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className={getRoleClass(role)}>{role}</span>
                    <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>{name || "Governance user"}</p>
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
