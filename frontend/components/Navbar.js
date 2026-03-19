"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const [role, setRole] = useState("");
  const [userName, setUserName] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const syncIdentity = () => {
      const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
      setRole(localStorage.getItem("role") || "");
      setUserName(storedUser.name || localStorage.getItem("userName") || "");
    };

    syncIdentity();
    window.addEventListener("storage", syncIdentity);
    return () => window.removeEventListener("storage", syncIdentity);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const navItems = useMemo(() => {
    if (role === "admin") {
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/admin", label: "Admin" },
        { href: "/complaints", label: "Complaints" },
        { href: "/profile", label: "Profile" },
        { href: "/docs", label: "Docs" },
      ];
    }

    if (role === "student" || role === "landlord") {
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/complaints", label: "Complaints" },
        { href: "/profile", label: "Profile" },
      ];
    }

    return [];
  }, [role]);

  const initials = useMemo(
    () =>
      userName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((chunk) => chunk[0]?.toUpperCase())
        .join(""),
    [userName]
  );

  const roleClassName =
    role === "student" ? "rp-student" : role === "landlord" ? "rp-landlord" : role === "admin" ? "rp-admin" : "";

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    localStorage.removeItem("studentId");
    localStorage.removeItem("landlordId");
    localStorage.removeItem("userName");
    window.location.href = "/login";
  }

  return (
    <header className="site-header">
      <div
        className="app-container"
        style={{
          minHeight: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "0 0",
          position: "relative",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            minWidth: "fit-content",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
              boxShadow: "0 0 18px rgba(108, 142, 245, 0.5)",
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 20,
              fontWeight: 600,
              background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            NearNest
          </span>
        </Link>

        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          className="navbar-desktop"
        >
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  color: active ? "var(--accent-primary)" : "var(--text-muted)",
                  background: active ? "rgba(108, 142, 245, 0.12)" : "transparent",
                  border: active ? "1px solid rgba(108, 142, 245, 0.2)" : "1px solid transparent",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginLeft: "auto",
          }}
        >
          {role ? (
            <>
              <span className={`role-pill ${roleClassName}`}>{role}</span>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  background: "linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))",
                }}
              >
                {initials || "N"}
              </div>
              <button
                onClick={logout}
                type="button"
                style={{
                  border: 0,
                  background: "transparent",
                  color: "var(--text-subtle)",
                  fontSize: 12,
                  padding: 0,
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" style={{ color: "var(--accent-primary)", fontSize: 13 }}>
                Login
              </Link>
              <Link href="/register" style={{ color: "var(--accent-primary)", fontSize: 13 }}>
                Register
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Toggle navigation"
            style={{
              display: "none",
            }}
            className="navbar-toggle"
          >
            <span
              style={{
                width: 18,
                height: 2,
                background: "var(--text-main)",
                boxShadow: "0 6px 0 var(--text-main), 0 -6px 0 var(--text-main)",
              }}
            />
          </button>
        </div>

        <div
          className="navbar-mobile"
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            left: 0,
            display: menuOpen ? "grid" : "none",
            gap: 8,
            padding: 12,
            background: "rgba(19, 22, 43, 0.98)",
            border: "1px solid var(--border-base)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-panel)",
          }}
        >
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  color: active ? "var(--accent-primary)" : "var(--text-muted)",
                  background: active ? "rgba(108, 142, 245, 0.12)" : "transparent",
                  border: active ? "1px solid rgba(108, 142, 245, 0.2)" : "1px solid transparent",
                  fontSize: 14,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
      <style jsx>{`
        .navbar-toggle,
        .navbar-mobile {
          display: none;
        }

        @media (max-width: 767px) {
          .navbar-desktop {
            display: none !important;
          }

          .navbar-toggle {
            display: inline-grid !important;
            place-items: center;
            width: 38px;
            height: 38px;
            border: 1px solid var(--border-base);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.04);
          }

          .navbar-mobile {
            display: ${menuOpen ? "grid" : "none"} !important;
          }
        }
      `}</style>
    </header>
  );
}
