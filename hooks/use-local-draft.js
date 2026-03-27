"use client";

import { useEffect } from "react";

export function useLocalDraft(key, value, setValue) {
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setValue((prev) => ({ ...prev, ...parsed }));
    } catch {
      // noop
    }
  }, [key, setValue]);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // noop
    }
  }, [key, value]);
}
