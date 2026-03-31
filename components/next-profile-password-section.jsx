"use client";

import { getCopy } from "@/lib/i18n";

export default function NextProfilePasswordSection({ form, message, onFieldChange, onSubmit, language = "vi" }) {
  const copy = getCopy(language);

  return (
    <div className="profile-password-box">
      <h3 className="subsection-title profile-vi-heading">{copy.profile.changePassword}</h3>
      <div className="field">
        <label className="profile-vi-label">{copy.profile.currentPassword}</label>
        <input type="password" value={form.currentPassword} onChange={(e) => onFieldChange("currentPassword", e.target.value)} />
      </div>
      <div className="field">
        <label className="profile-vi-label">{copy.profile.newPassword}</label>
        <input type="password" value={form.newPassword} onChange={(e) => onFieldChange("newPassword", e.target.value)} />
      </div>
      {message ? <div className="auth-message profile-vi-text">{message}</div> : null}
      <button type="button" className="primary-button" onClick={onSubmit}>{copy.profile.savePassword}</button>
    </div>
  );
}
