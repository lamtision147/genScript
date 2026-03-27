"use client";

export default function NextTextareaField({ label, value, onChange, placeholder = "", helper = "" }) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {helper ? <div className="field-helper">{helper}</div> : null}
    </div>
  );
}
