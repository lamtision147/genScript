import fs from "fs";
import path from "path";

const ROOT = process.cwd();

export const paths = {
  users: path.join(ROOT, "users-store.json"),
  history: path.join(ROOT, "history-store.json")
};

export function readJsonArray(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeJsonArray(filePath, items) {
  fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf8");
}
