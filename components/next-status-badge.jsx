"use client";

export default function NextStatusBadge({ tone = "ai", className = "", children }) {
  const mergedClassName = ["content-source-badge", tone, className].filter(Boolean).join(" ");
  return <div className={mergedClassName}>{children}</div>;
}
