"use client";

export default function NextPageFrame({ children }) {
  return (
    <main className="app-shell">
      <div className="page-frame">{children}</div>
    </main>
  );
}
