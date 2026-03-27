import fs from "fs";
import path from "path";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const USERS_FILE = path.join(process.cwd(), "users-store.json");

function readLocalUsers() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function findUserByEmail(email) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase.from("users").select("*").eq("email", email).maybeSingle();
    if (!error) return data;
  }

  return readLocalUsers().find((item) => item.email === email) || null;
}
