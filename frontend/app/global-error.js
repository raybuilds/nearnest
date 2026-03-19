"use client";

import styles from "./error.module.css";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body className={styles.globalBody}>
        <div className={styles.page}>
          <div className={styles.card}>
            <p className={styles.kicker}>Dawn Property OS</p>
            <h2>Application recovery required.</h2>
            <p className={styles.message}>{error?.message || "A global rendering error occurred."}</p>
            <button className={styles.button} onClick={() => reset()} type="button">
              Reload experience
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
