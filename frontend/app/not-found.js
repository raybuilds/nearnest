import Link from "next/link";
import styles from "./error.module.css";

export default function NotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.kicker}>Dawn Property OS</p>
        <h2>Page not found.</h2>
        <p className={styles.message}>The page you requested does not exist in this workspace.</p>
        <Link className={styles.linkButton} href="/">
          Return home
        </Link>
      </div>
    </div>
  );
}
