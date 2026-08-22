"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "nearnest-theme";

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(THEME_KEY, theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const rootTheme = document.documentElement.dataset.theme;
    if (rootTheme === "light" || rootTheme === "dark") {
      setTheme(rootTheme);
      return;
    }

    const stored = window.localStorage.getItem(THEME_KEY);
    const system = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    const nextTheme = stored === "light" || stored === "dark" ? stored : system;
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }

  return (
    <button className="theme-toggle" onClick={toggleTheme} type="button" aria-label="Toggle theme">
      <span>{theme === "light" ? "Moon" : "Sun"}</span>
      <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
    </button>
  );
}
