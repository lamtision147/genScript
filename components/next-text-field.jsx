"use client";

export default function NextTextField({ label, value, onChange, placeholder = "", type = "text" }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
