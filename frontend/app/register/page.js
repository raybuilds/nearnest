"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "Rohit Yadav",
    email: "rohityadav7122004@gmail.com",
    password: "password",
    role: "landlord",
  });

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    localStorage.setItem("role", form.role);
    localStorage.setItem("userName", form.name);
    localStorage.setItem("token", "mock-token");
    router.push("/dashboard");
  }

  return (
    <div className={styles.page}>
      <div className={styles.backdrop} />
      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.logo}>D</div>
        <h1>Create your Dawn workspace</h1>
        <p>Launch a dark-luxury operating system for property intelligence and remediation workflows.</p>
        <label>
          <span>Name</span>
          <input className="inputField" value={form.name} onChange={(event) => update("name", event.target.value)} />
        </label>
        <label>
          <span>Email</span>
          <input className="inputField" value={form.email} onChange={(event) => update("email", event.target.value)} />
        </label>
        <label>
          <span>Password</span>
          <input className="inputField" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} />
        </label>
        <label>
          <span>Role</span>
          <select className="selectField" value={form.role} onChange={(event) => update("role", event.target.value)}>
            <option value="tenant">Tenant</option>
            <option value="landlord">Landlord</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button className="primaryButton" type="submit">
          Create Account
        </button>
        <p className={styles.meta}>
          Already registered? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
