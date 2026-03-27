"use client";

export default function NextEmptyState({ children, error = false }) {
  return <div className={`history-empty ${error ? "error-state" : ""}`}>{children}</div>;
}
