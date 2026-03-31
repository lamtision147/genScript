"use client";

export default function NextSelectField({ label, value, options, onChange }) {
  const selectId = `field-${String(label || "").replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9\-]/g, "")}`;
  return (
    <div className="field">
      <label htmlFor={selectId}>{label}</label>
      <div className="select-wrap">
        <select id={selectId} className="dropdown-select" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((option, index) => {
            if (typeof option === "string") {
              return <option key={`${label}-${index}`} value={index}>{option}</option>;
            }
            return <option key={option.value} value={option.value}>{option.label}</option>;
          })}
        </select>
      </div>
    </div>
  );
}
