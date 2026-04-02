"use client";

export default function NextGenerationControls({
  language = "vi"
}) {
  const isVi = language === "vi";

  return (
    <section className="generation-controls">
      <div className="generation-control-item">
        <p className="field-helper">
          {isVi
            ? "Gói Free tạo 1 bản/lần. Nâng cấp Pro để mở tính năng A/B 2 bản và chọn bản tốt nhất tự động."
            : "Free generates 1 variant per request. Upgrade to Pro to unlock 2-variant A/B with automatic best pick."}
        </p>
        <a className="ghost-button" href="/upgrade">{isVi ? "Nâng cấp Pro" : "Upgrade Pro"}</a>
      </div>
    </section>
  );
}
