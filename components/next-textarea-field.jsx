"use client";

export default function NextTextareaField({ label, value, onChange, placeholder = "", helper = "" }) {
  const areaId = `field-${String(label || "").replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9\-]/g, "")}`;
  return (
    <div className="field">
      <label htmlFor={areaId}>{label}</label>
      <textarea id={areaId} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {helper ? <div className="field-helper">{helper}</div> : null}
    </div>
  );
}
