import fs from "fs";
import path from "path";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const HISTORY_FILE = path.join(process.cwd(), "history-store.json");

function readLocalHistory() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, "utf8");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function listHistoryByUser(userId) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("history_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (!error) return data || [];
  }

  return readLocalHistory().filter((item) => item.userId === userId);
}
