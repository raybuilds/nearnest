"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("ops@dawnos.com");
  const [password, setPassword] = useState("password");

  function handleSubmit(event) {
    event.preventDefault();
    localStorage.setItem("role", "admin");
    localStorage.setItem("userName", "Rohit Yadav");
    localStorage.setItem("token", "mock-token");
    router.push("/dashboard");
  }

  return (
    <div className={styles.page}>
      <div className={styles.backdrop} />
      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.logo}>D</div>
        <h1>Dawn Property OS</h1>
        <p>Sign in to access premium portfolio intelligence.</p>
        <label>
          <span>Email</span>
          <input className="inputField" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          <span>Password</span>
          <input className="inputField" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button className="primaryButton" type="submit">
          Enter Dawn
        </button>
        <p className={styles.meta}>
          New here? <Link href="/register">Create your account</Link>
        </p>
      </form>
    </div>
  );
}
