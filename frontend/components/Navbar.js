"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import styles from "./Navbar.module.css";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/units", label: "Units" },
  { href: "/complaints", label: "Complaints" },
  { href: "/reports", label: "Reports" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [role, setRole] = useState("admin");
  const [userName, setUserName] = useState("Rohit Yadav");

  useEffect(() => {
    const syncIdentity = () => {
      setRole(localStorage.getItem("role") || "admin");
      setUserName(localStorage.getItem("userName") || "Rohit Yadav");
    };

    syncIdentity();
    window.addEventListener("storage", syncIdentity);
    return () => window.removeEventListener("storage", syncIdentity);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  return (
    <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ""}`}>
      <div className={styles.inner}>
        <Link className={styles.logo} href="/">
          <span className={styles.logoDot} />
          <span className={styles.logoText}>Dawn</span>
        </Link>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`} href={item.href}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.actions}>
          <div className={styles.badgeCluster}>
            <span className={styles.notification}>7</span>
            <div>
              <p className={styles.roleLabel}>{role}</p>
              <p className={styles.userLabel}>{userName}</p>
            </div>
          </div>
          <div className={styles.avatar}>{initials || "D"}</div>
        </div>
      </div>
    </header>
  );
}
