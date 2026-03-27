"use client";

export default function NextProfilePasswordSection({ form, message, onFieldChange, onSubmit }) {
  return (
    <div className="profile-password-box">
      <h3 className="subsection-title">Đổi mật khẩu</h3>
      <div className="field">
        <label>Mật khẩu hiện tại</label>
        <input type="password" value={form.currentPassword} onChange={(e) => onFieldChange("currentPassword", e.target.value)} />
      </div>
      <div className="field">
        <label>Mật khẩu mới</label>
        <input type="password" value={form.newPassword} onChange={(e) => onFieldChange("newPassword", e.target.value)} />
      </div>
      {message ? <div className="auth-message">{message}</div> : null}
      <button type="button" className="primary-button" onClick={onSubmit}>Lưu mật khẩu mới</button>
    </div>
  );
}
