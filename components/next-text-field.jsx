"use client";

export default function NextTextField({ label, value, onChange, placeholder = "", type = "text" }) {
  const inputId = `field-${String(label || "").replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9\-]/g, "")}`;
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
