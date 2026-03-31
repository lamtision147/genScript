"use client";

import { useEffect, useState } from "react";
import { LANGUAGE_STORAGE_KEY, normalizeLanguage } from "@/lib/i18n";

export function useUiLanguage(defaultLang = "vi") {
  const [language, setLanguageState] = useState(defaultLang);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored) {
        setLanguageState(normalizeLanguage(stored));
        return;
      }
    } catch {
      // noop
    }

    try {
      const browserLang = normalizeLanguage((navigator.language || "").slice(0, 2));
      setLanguageState(browserLang);
    } catch {
      setLanguageState(defaultLang);
    }
  }, [defaultLang]);

  function setLanguage(nextLanguage) {
    const normalized = normalizeLanguage(nextLanguage);
    setLanguageState(normalized);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
    } catch {
      // noop
    }
  }

  return { language, setLanguage };
}
