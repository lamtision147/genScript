import { createClient } from "@supabase/supabase-js";
import { appEnv } from "@/lib/env";

export function createServerSupabaseClient() {
  if (!appEnv.supabaseUrl || !appEnv.supabaseServiceRoleKey) {
    return null;
  }

  return createClient(appEnv.supabaseUrl, appEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false }
  });
}
