"use client";

export default function NextSelectField({ label, value, options, onChange }) {
  const selectId = `field-${String(label || "").replace(/\s+/g, "-").toLowerCase().replace(/[^a-z0-9\-]/g, "")}`;
  const normalizedOptions = Array.isArray(options) ? options : [];

  const renderOption = (option, index, parentLabel = "") => {
    if (typeof option === "string") {
      return <option key={`${selectId}-${parentLabel}-string-${index}`} value={index}>{option}</option>;
    }
    if (!option || typeof option !== "object") return null;
    return <option key={`${selectId}-${parentLabel}-${option.value}`} value={option.value}>{option.label}</option>;
  };

  return (
    <div className="field">
      <label htmlFor={selectId}>{label}</label>
      <div className="select-wrap">
        <select id={selectId} className="dropdown-select" value={value} onChange={(e) => onChange(e.target.value)}>
          {normalizedOptions.map((option, index) => {
            if (option && typeof option === "object" && Array.isArray(option.options)) {
              return (
                <optgroup key={`${selectId}-group-${index}`} label={option.label || ""}>
                  {option.options.map((nestedOption, nestedIndex) => renderOption(nestedOption, nestedIndex, option.label || `group-${index}`))}
                </optgroup>
              );
            }
            return renderOption(option, index);
          })}
        </select>
      </div>
    </div>
  );
}
