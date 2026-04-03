"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client/api";
import { routes } from "@/lib/routes";
import { readSessionCache, writeSessionCache } from "@/lib/client/session-cache";

export function useAuthBootstrap() {
  const [session, setSessionState] = useState(() => readSessionCache());
  const [authConfig, setAuthConfig] = useState({ googleEnabled: false, otpEnabled: true });

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      apiGet(routes.api.session),
      apiGet(routes.api.authConfig, { googleEnabled: false, otpEnabled: true })
    ]).then(([sessionResult, configResult]) => {
      if (cancelled) return;

      if (sessionResult.status === "fulfilled") {
        const nextUser = sessionResult.value?.user || null;
        setSessionState(nextUser);
        writeSessionCache(nextUser);
      }

      if (configResult.status === "fulfilled") {
        setAuthConfig(configResult.value || { googleEnabled: false, otpEnabled: true });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function setSessionWithCache(nextSessionOrUpdater) {
    setSessionState((prev) => {
      const nextSession = typeof nextSessionOrUpdater === "function"
        ? nextSessionOrUpdater(prev)
        : nextSessionOrUpdater;
      writeSessionCache(nextSession || null);
      return nextSession || null;
    });
  }

  return { session, setSession: setSessionWithCache, authConfig, setAuthConfig };
}
