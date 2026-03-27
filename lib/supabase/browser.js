import { createClient } from "@supabase/supabase-js";
import { appEnv } from "@/lib/env";

export function createBrowserSupabaseClient() {
  if (!appEnv.supabaseUrl || !appEnv.supabaseAnonKey) {
    return null;
  }

  return createClient(appEnv.supabaseUrl, appEnv.supabaseAnonKey);
}
