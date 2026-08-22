"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getRoleClass } from "@/lib/governance";
import { clearSession, getStoredRole, getStoredUser } from "@/lib/session";
import ThemeToggle from "@/components/ThemeToggle";
import { getAlerts } from "@/lib/api";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const publicLinks = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Register" },
];

function getNavItems(role) {
  const shared = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/units", label: "Units" },
    { href: "/complaints", label: "Complaints" },
    { href: "/alerts", label: "Alerts" },
    { href: "/docs", label: "Docs" },
    { href: "/profile", label: "Profile" },
  ];

  if (role === "admin") {
    return [{ href: "/admin", label: "Governance" }, ...shared];
  }

  if (role === "parent") {
    return [
      { href: "/parent/dashboard", label: "Command Center" },
      { href: "/alerts", label: "Alerts" },
      { href: "/docs", label: "Docs" },
      { href: "/profile", label: "Profile" },
    ];
  }

  if (role === "student") {
    return [
      ...shared.slice(0, 3),
      { href: "/student/guests", label: "Guests" },
      { href: "/student/payments", label: "Payments" },
      { href: "/student/agreements", label: "Agreements" },
      ...shared.slice(3),
    ];
  }

  return shared;
}

export default function Navbar() {
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

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
    
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);

    const handleKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("nearnest:session-changed", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!role) {
      setUnreadCount(0);
      return;
    }
    const fetchUnread = async () => {
      try {
        const res = await getAlerts("OPEN");
        if (res?.pagination) {
          setUnreadCount(res.pagination.total || 0);
        }
      } catch (_) {}
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [role]);

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
            className={`relative rounded-xl px-4.5 py-2 text-sm font-medium tracking-wide transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-teal)] flex items-center gap-2`}
            style={
              active
                ? { background: "var(--bg-soft-strong)", color: "var(--text-main)" }
                : { color: "var(--text-muted)" }
            }
          >
            {active && !shouldReduceMotion && (
              <motion.span
                layoutId="activeNavIndicator"
                className="absolute inset-0 z-[-1] rounded-xl bg-[color-mix(in_srgb,var(--bg-soft-strong)_50%,transparent)]"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <span>{item.label}</span>
            {item.href === "/alerts" && unreadCount > 0 && (
              <span className="grid h-4.5 w-4.5 place-items-center rounded-full bg-[var(--color-terracotta,#c2410c)] text-[10px] font-bold text-white shadow-sm ring-1 ring-white/10 animate-pulse">
                {unreadCount}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );

  return (
    <header 
      className={`sticky top-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? "border-b border-[var(--border)] bg-[var(--bg-surface-strong)] backdrop-blur-md shadow-sm" 
          : "bg-transparent"
      }`}
    >
      <div className="page-shell flex min-h-[84px] items-center justify-between gap-4 py-4">
        <div className="flex items-center gap-8">
          <Link 
            href="/" 
            className="flex items-center gap-3.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-teal)] rounded-xl p-1"
          >
            <span className="h-4 w-4 rounded-full bg-[linear-gradient(135deg,var(--accent-mint),var(--accent-cyan),#d9fff4)] shadow-[0_0_24px_rgba(70,209,189,0.35)] transition-transform duration-300 group-hover:scale-125" />
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-gradient" style={{ fontFamily: "var(--font-display)" }}>
                NearNest
              </span>
              <span className="text-[9px] uppercase tracking-[0.3em]" style={{ color: "var(--text-soft)" }}>
                Student housing trust platform
              </span>
            </div>
          </Link>

          <div className="hidden items-center gap-1.5 lg:flex">{navContent}</div>
        </div>

        <div className="hidden items-center gap-4 lg:flex">
          <ThemeToggle />
          {role ? (
            <>
              <span className={`${getRoleClass(role)} uppercase tracking-widest text-[10px] font-bold px-2.5 py-1 rounded-md`}>
                {role}
              </span>
              <div 
                className="flex items-center gap-3 rounded-full p-1 pr-3" 
                style={{ border: "1px solid var(--border)", background: "var(--bg-soft)" }}
              >
                <div 
                  className="grid h-8.5 w-8.5 place-items-center rounded-full bg-[linear-gradient(135deg,var(--accent-mint),var(--accent-cyan),#d9fff4)] text-xs font-bold shadow-inner" 
                  style={{ color: "var(--text-inverse)" }}
                >
                  {initials || "N"}
                </div>
                <div>
                  <p className="text-xs font-semibold leading-tight" style={{ color: "var(--text-main)" }}>
                    {name || "Governance user"}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-soft)" }}>
                    Enforced Identity
                  </p>
                </div>
              </div>
              <button 
                className="btn-ghost text-xs tracking-wider uppercase font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-teal)] rounded-lg px-3 py-1.5" 
                onClick={handleLogout} 
                type="button"
              >
                Logout
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              {publicLinks.map((item) => (
                <Link 
                  key={item.href} 
                  className={`${
                    item.label === "Register" 
                      ? "btn-primary shadow-sm hover:shadow" 
                      : "btn-secondary"
                  } text-xs tracking-wider uppercase font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-teal)]`} 
                  href={item.href}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <button
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl lg:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-teal)]"
          style={{ border: "1px solid var(--border)", background: "var(--bg-soft)", color: "var(--text-main)" }}
          onClick={() => setOpen((value) => !value)}
          type="button"
          aria-expanded={open}
        >
          <span className="sr-only">Toggle navigation</span>
          <div className="relative flex flex-col justify-between w-5 h-3.5">
            <span className={`block h-0.5 w-full bg-current transition-all duration-300 ${open ? "rotate-45 translate-y-1.5" : ""}`} />
            <span className={`block h-0.5 w-full bg-current transition-opacity duration-300 ${open ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 w-full bg-current transition-all duration-300 ${open ? "-rotate-45 -translate-y-1.5" : ""}`} />
          </div>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div 
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, height: "auto" }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="page-shell pb-6 lg:hidden overflow-hidden"
          >
            <div className="glass-panel p-5 border border-[var(--border)] rounded-2xl bg-[var(--bg-surface-strong)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <ThemeToggle />
                {role && (
                  <span className={`${getRoleClass(role)} uppercase tracking-widest text-[9px] font-bold px-2 py-0.5 rounded`}>
                    {role}
                  </span>
                )}
              </div>
              <div className="grid gap-2">{navContent}</div>
              <div className="mt-5 border-t border-[var(--border)] pt-5">
                {role ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--text-main)" }}>
                        {name || "Governance user"}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-soft)" }}>
                        Role-based visibility active
                      </p>
                    </div>
                    <button 
                      className="btn-secondary text-xs tracking-wider uppercase font-semibold" 
                      onClick={handleLogout} 
                      type="button"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {publicLinks.map((item) => (
                      <Link 
                        key={item.href} 
                        className="btn-secondary text-xs tracking-wider uppercase font-semibold text-center" 
                        href={item.href}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
