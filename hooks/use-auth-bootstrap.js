"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/client/api";
import { routes } from "@/lib/routes";

export function useAuthBootstrap() {
  const [session, setSession] = useState(null);
  const [authConfig, setAuthConfig] = useState({ googleEnabled: false, otpEnabled: true });

  useEffect(() => {
    Promise.all([
      apiGet(routes.api.session, { user: null }),
      apiGet(routes.api.authConfig, { googleEnabled: false, otpEnabled: true })
    ]).then(([sessionData, configData]) => {
      setSession(sessionData.user || null);
      setAuthConfig(configData || { googleEnabled: false, otpEnabled: true });
    });
  }, []);

  return { session, setSession, authConfig, setAuthConfig };
}
