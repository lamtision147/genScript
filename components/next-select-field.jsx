"use client";

export default function NextSelectField({ label, value, options, onChange }) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className="select-wrap">
        <select className="dropdown-select" value={value} onChange={(e) => onChange(e.target.value)}>
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
