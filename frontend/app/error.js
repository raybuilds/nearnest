"use client";

import styles from "./error.module.css";

export default function Error({ error, reset }) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.kicker}>Dawn Property OS</p>
        <h2>Something went wrong.</h2>
        <p className={styles.message}>{error?.message || "An unexpected issue interrupted this view."}</p>
        <button className={styles.button} onClick={() => reset()} type="button">
          Try again
        </button>
      </div>
    </div>
  );
}
