import fs from "fs";
import path from "path";

const ROOT = process.cwd();

export const paths = {
  users: path.join(ROOT, "users-store.json"),
  history: path.join(ROOT, "history-store.json"),
  aiUsage: path.join(ROOT, "ai-usage-store.json"),
  telemetry: path.join(ROOT, "telemetry-store.json"),
  feedback: path.join(ROOT, "feedback-store.json")
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
  try {
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}
