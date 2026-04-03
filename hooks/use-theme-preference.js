"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "seller-script-theme";

function normalizeTheme(value) {
  const next = String(value || "").trim().toLowerCase();
  return next === "dark" ? "dark" : "light";
}

export function useThemePreference() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    const preferred = normalizeTheme(saved || "light");
    setTheme(preferred);
    document.documentElement.setAttribute("data-theme", preferred);
  }, []);

  function updateTheme(nextValue) {
    const nextTheme = normalizeTheme(nextValue);
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    }
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", nextTheme);
    }
  }

  function toggleTheme() {
    updateTheme(theme === "dark" ? "light" : "dark");
  }

  return {
    theme,
    isDark: theme === "dark",
    setTheme: updateTheme,
    toggleTheme
  };
}
