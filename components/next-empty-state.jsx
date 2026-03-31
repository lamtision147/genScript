"use client";

export default function NextEmptyState({ children, error = false, className = "" }) {
  return <div className={`history-empty ${error ? "error-state" : ""} ${className}`.trim()}>{children}</div>;
}
