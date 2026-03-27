"use client";

export default function NextStatusBadge({ tone = "ai", children }) {
  return <div className={`content-source-badge ${tone}`}>{children}</div>;
}
