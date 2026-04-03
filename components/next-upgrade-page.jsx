"use client";

import NextPageFrame from "@/components/next-page-frame";
import NextShellHeader from "@/components/next-shell-header";
import NextTextField from "@/components/next-text-field";
import NextSelectField from "@/components/next-select-field";
import { useUiLanguage } from "@/hooks/use-ui-language";
import { useUpgradeWorkspace } from "@/hooks/use-upgrade-workspace";
import { routes } from "@/lib/routes";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function NextUpgradePage() {
  const { language, setLanguage } = useUiLanguage("vi");
  const {
    session,
    planInfo,
    paymentProvider,
    selectedGateway,
    loadingPlan,
    processing,
    cancelling,
    cancelConfirmOpen,
    message,
    successPopupOpen,
    successPopupMessage,
    cardForm,
    isPro,
    actions
  } = useUpgradeWorkspace(language);

  const isVi = language === "vi";
  const title = isVi ? "Nâng cấp gói Pro" : "Upgrade to Pro";
  const subtitle = isVi
    ? "Mở toàn bộ tính năng để tạo nhiều bản nội dung, test nhanh và chốt đơn ổn định hơn mỗi ngày."
    : "Unlock full features to generate more variants, test faster, and improve daily conversion.";
  const favoriteLimitText = planInfo?.limits?.unlimitedFavorites
    ? (isVi ? "Không giới hạn" : "Unlimited")
    : String(planInfo?.limits?.favoritesLimit ?? 5);
  const historyLimitText = planInfo?.limits?.unlimitedHistory
    ? (isVi ? "Không giới hạn" : "Unlimited")
    : String(planInfo?.limits?.historyLimit ?? 5);
  const monthlyDisplay = isVi ? "249.000đ" : "$10";
  const firstMonthDisplay = isVi ? "129.000đ" : "$5";
  const regularDisplay = isVi ? "249.000đ" : "$10";
  const usingStripe = selectedGateway === "stripe";
  const isStripeAvailable = paymentProvider === "stripe";
  const planExpiresAtText = (() => {
    const raw = session?.planExpiresAt || planInfo?.expiresAt || "";
    if (!raw) return isVi ? "Chưa có" : "Not available";
    const parsed = new Date(raw);
    if (!Number.isFinite(parsed.getTime())) return raw;
    return parsed.toLocaleDateString(isVi ? "vi-VN" : "en-US");
  })();
  const remainingDaysText = Number.isFinite(Number(planInfo?.remainingDays))
    ? `${Math.max(0, Number(planInfo.remainingDays))} ${isVi ? "ngày" : "days"}`
    : "--";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const checkoutStatus = String(params.get("checkout") || "").toLowerCase();
    const sessionId = String(params.get("session_id") || "").trim();

    if (checkoutStatus === "cancel") {
      actions.setMessage(isVi ? "Bạn đã hủy thanh toán Stripe." : "You cancelled Stripe checkout.");
      return;
    }

    if (checkoutStatus === "success" && sessionId) {
      actions.confirmStripeCheckout(sessionId);
    }
  }, [isVi]);

  return (
    <NextPageFrame>
      <section className="panel full-span">
        <NextShellHeader
          eyebrow="SellerScript"
          title={title}
          subtitle={subtitle}
          user={session}
          language={language}
          onLanguageChange={setLanguage}
        />

        <section className="content-card upgrade-page-shell">
          <section className="upgrade-hero-card">
            <div className="upgrade-hero-main">
              <div className={`upgrade-plan-pill ${isPro ? "pro" : "free"}`}>{isPro ? "PRO" : "FREE"}</div>
              <h2 className="section-title upgrade-hero-title">{isVi ? "Gói SellerScript Pro" : "SellerScript Pro Plan"}</h2>
              <p className="upgrade-hero-subtitle">
                {isVi
                  ? "Dành cho seller cần tạo nhiều phiên bản nội dung theo phong cách khác nhau, tối ưu nhanh theo từng sản phẩm và từng chiến dịch."
                  : "Built for sellers who need multi-style content variants and faster optimization across products and campaigns."}
              </p>
              <div className="upgrade-hero-stats">
                <div className="upgrade-stat-card">
                  <span>{isVi ? "Giới hạn yêu thích" : "Favorites limit"}</span>
                  <strong>{favoriteLimitText}</strong>
                </div>
                <div className="upgrade-stat-card">
                  <span>{isVi ? "Giới hạn lịch sử" : "History limit"}</span>
                  <strong>{historyLimitText}</strong>
                </div>
              </div>
            </div>

            <aside className="upgrade-price-card">
              <span className="upgrade-price-label">{isVi ? "Giá gói Pro" : "Pro pricing"}</span>
              <p className="upgrade-price-anchor">
                <span className="upgrade-old-price upgrade-old-price-prominent">{regularDisplay}</span>
                <span className="upgrade-price-save-badge">{isVi ? "-50% tháng đầu" : "-50% first month"}</span>
              </p>
              <p className="upgrade-price-value">{firstMonthDisplay}</p>
              <p className="upgrade-price-cycle">{isVi ? "tháng đầu tiên" : "first month"}</p>
              <p className="upgrade-regular-price">{isVi ? `Từ tháng thứ 2: ${regularDisplay}/tháng` : `From month 2: ${regularDisplay}/month`}</p>
              <div className="upgrade-discount-chip">
                {isVi
                  ? `Giá gốc ${regularDisplay}, ưu đãi tháng đầu 50%`
                  : `Regular price ${regularDisplay}, first month 50% off`}
              </div>
              <div className="upgrade-provider-chip">
                {isVi ? "Cổng thanh toán" : "Payment provider"}: {paymentProvider === "stripe" ? "Stripe" : (isVi ? "Nội bộ (mock)" : "Internal (mock)")}
              </div>
            </aside>
          </section>

          <div className="upgrade-card-grid">
            <article className="upgrade-info-card">
              <h3 className="subsection-title">{isVi ? "Những gì bạn nhận được" : "What you get"}</h3>
              <ul className="upgrade-feature-list">
                <li>{isVi ? "Generate/cải tiến không giới hạn ở cả 2 trang" : "Unlimited generate/improve on both pages"}</li>
                <li>{isVi ? "Tạo nhiều phiên bản nội dung để A/B test nhanh" : "Generate multiple variants for fast A/B testing"}</li>
                <li>{isVi ? "Lịch sử và yêu thích không giới hạn để tái sử dụng nội dung tốt" : "Unlimited history and favorites to reuse winning content"}</li>
                <li>{isVi ? "Phù hợp vận hành team và đa chiến dịch bán hàng" : "Built for team workflows and multi-campaign selling"}</li>
              </ul>
            </article>

            <article className="upgrade-info-card">
              <h3 className="subsection-title">{isVi ? "Trạng thái tài khoản" : "Account status"}</h3>
              <div className="upgrade-limit-rows">
                <div className="upgrade-limit-row">
                  <span>{isVi ? "Gói hiện tại" : "Current plan"}</span>
                  <strong>{isPro ? "PRO" : "FREE"}</strong>
                </div>
                <div className="upgrade-limit-row">
                  <span>{isVi ? "Yêu thích" : "Favorites"}</span>
                  <strong>{favoriteLimitText}</strong>
                </div>
                <div className="upgrade-limit-row">
                  <span>{isVi ? "Lịch sử" : "History"}</span>
                  <strong>{historyLimitText}</strong>
                </div>
                <div className="upgrade-limit-row">
                  <span>{isVi ? "Generate/ngày (Nội dung sản phẩm)" : "Daily generate (Product)"}</span>
                  <strong>{isPro ? (isVi ? "Không giới hạn" : "Unlimited") : "5"}</strong>
                </div>
                <div className="upgrade-limit-row">
                  <span>{isVi ? "Generate/ngày (Kịch bản video)" : "Daily generate (Video)"}</span>
                  <strong>{isPro ? (isVi ? "Không giới hạn" : "Unlimited") : "5"}</strong>
                </div>
                <div className="upgrade-limit-row">
                  <span>{isVi ? "Hiệu lực gói Pro đến" : "Pro valid until"}</span>
                  <strong>{isPro ? planExpiresAtText : (isVi ? "Không áp dụng" : "N/A")}</strong>
                </div>
                <div className="upgrade-limit-row">
                  <span>{isVi ? "Thời gian còn lại" : "Remaining time"}</span>
                  <strong>{isPro ? remainingDaysText : (isVi ? "Không áp dụng" : "N/A")}</strong>
                </div>
                {isPro && planInfo?.cancelAtPeriodEnd ? (
                  <div className="upgrade-limit-row">
                    <span>{isVi ? "Trạng thái hủy" : "Cancellation status"}</span>
                    <strong>{isVi ? "Đã hủy, giữ Pro tới ngày hết hạn" : "Cancelled, Pro remains until expiry"}</strong>
                  </div>
                ) : null}
              </div>

              {isPro ? (
                <div className="upgrade-actions-stack">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={cancelling}
                    onClick={actions.requestCancelProPlan}
                  >
                    {cancelling
                      ? (isVi ? "Đang hủy..." : "Cancelling...")
                      : (planInfo?.cancelAtPeriodEnd
                        ? (isVi ? "Đã đặt hủy gói" : "Cancellation scheduled")
                        : (isVi ? "Hủy gói Pro" : "Cancel Pro plan"))}
                  </button>
                  <a className="ghost-button" href={routes.scriptProductInfo}>{isVi ? "Quay lại Trang tạo nội dung" : "Back to Studio"}</a>
                </div>
              ) : null}
            </article>

            <section className="upgrade-payment-card">
              <h3 className="subsection-title">{isVi ? "Thanh toán" : "Payment"}</h3>
              <p className="inline-note">
                {paymentProvider === "stripe"
                  ? (isVi ? "Stripe đã sẵn sàng ở backend. Bạn có thể thanh toán trực tiếp qua Stripe hoặc dùng form nội bộ để demo." : "Stripe is configured on backend. You can pay via Stripe or use internal form for demo flow.")
                  : (isVi ? "Đang chạy giao diện thanh toán nội bộ (mock)." : "Using internal mock payment UI.")}
              </p>

              <NextSelectField
                label={isVi ? "Cổng thanh toán" : "Payment gateway"}
                value={selectedGateway}
                options={isStripeAvailable
                  ? [
                    { value: "stripe", label: "Stripe" },
                    { value: "internal", label: isVi ? "Nội bộ (mock)" : "Internal (mock)" }
                  ]
                  : [{ value: "internal", label: isVi ? "Nội bộ (mock)" : "Internal (mock)" }]}
                onChange={actions.setPaymentGateway}
              />

              {usingStripe ? (
                <div className="upgrade-gateway-preview stripe">
                  <div className="upgrade-gateway-preview-head">
                    <strong>Stripe</strong>
                    <span>{isVi ? "Thanh toán bảo mật, chuyển hướng tới trang Stripe chính thức." : "Secure checkout, redirect to official Stripe page."}</span>
                  </div>
                  <div className="upgrade-gateway-preview-rows">
                    <div>
                      <span>{isVi ? "Thẻ thanh toán" : "Card payment"}</span>
                      <strong>Visa · Mastercard · JCB</strong>
                    </div>
                    <div>
                      <span>{isVi ? "Bảo mật" : "Security"}</span>
                      <strong>PCI DSS · 3D Secure</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-grid">
                    <NextTextField
                      label={isVi ? "Tên chủ thẻ" : "Card holder"}
                      value={cardForm.cardHolder}
                      onChange={(value) => actions.updateCardField("cardHolder", value)}
                      placeholder={isVi ? "NGUYEN VAN A" : "JOHN DOE"}
                    />
                    <NextTextField
                      label={isVi ? "Số thẻ" : "Card number"}
                      value={cardForm.cardNumber}
                      onChange={(value) => actions.updateCardField("cardNumber", value)}
                      placeholder="4242 4242 4242 4242"
                    />
                  </div>

                  <div className="form-grid">
                    <NextTextField
                      label={isVi ? "Ngày hết hạn" : "Expiry"}
                      value={cardForm.expiry}
                      onChange={(value) => actions.updateCardField("expiry", value)}
                      placeholder="MM/YY"
                    />
                    <NextTextField
                      label="CVC"
                      value={cardForm.cvc}
                      onChange={(value) => actions.updateCardField("cvc", value)}
                      placeholder="123"
                    />
                  </div>
                </>
              )}

              <div className="upgrade-payment-actions">
                {usingStripe ? (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={processing || loadingPlan || isPro}
                    onClick={actions.startStripeCheckout}
                  >
                    {isPro
                      ? (isVi ? "Bạn đang ở gói Pro" : "You are already on Pro")
                      : (processing ? (isVi ? "Đang chuyển tới Stripe..." : "Redirecting to Stripe...") : (isVi ? "Thanh toán qua Stripe" : "Pay with Stripe"))}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary-button"
                    disabled={processing || loadingPlan || isPro}
                    onClick={actions.submitUpgrade}
                  >
                    {isPro
                      ? (isVi ? "Bạn đang ở gói Pro" : "You are already on Pro")
                      : (processing ? (isVi ? "Đang xử lý thanh toán..." : "Processing payment...") : (isVi ? "Thanh toán và nâng cấp Pro" : "Pay and upgrade to Pro"))}
                  </button>
                )}

                {!isPro && usingStripe ? (
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={processing || loadingPlan}
                    onClick={() => actions.setPaymentGateway("internal")}
                  >
                    {processing
                      ? (isVi ? "Đang xử lý..." : "Processing...")
                      : (isVi ? "Sử dụng form nội bộ" : "Use internal form")}
                  </button>
                ) : null}
              </div>

              {message ? <div className="upgrade-feedback-banner">{message}</div> : null}
            </section>

            <article className="upgrade-info-card upgrade-note-card">
              <h3 className="subsection-title">{isVi ? "Ghi chú thanh toán" : "Billing notes"}</h3>
              <ul className="upgrade-note-list">
                <li>{isVi ? "Nâng cấp có hiệu lực ngay sau khi thanh toán thành công." : "Upgrade is activated right after successful payment."}</li>
                <li>{isVi ? "Khi hủy gói, bạn vẫn dùng Pro tới hết chu kỳ đã thanh toán." : "When cancelled, Pro access remains until the paid cycle ends."}</li>
                <li>{isVi ? "Nếu đăng ký lại trước khi hết hạn, hệ thống sẽ cộng dồn thêm thời gian gói mới." : "If you resubscribe before expiry, new time is added on top of remaining Pro time."}</li>
                <li>{isVi ? "Dữ liệu lịch sử và yêu thích vẫn được giữ nguyên khi đổi gói." : "History and favorites data remain intact when plan changes."}</li>
              </ul>
            </article>
          </div>
        </section>
      </section>

      {cancelConfirmOpen && typeof document !== "undefined" ? createPortal(
        <div className="upgrade-success-overlay" role="dialog" aria-modal="true" aria-label={isVi ? "Xác nhận hủy gói Pro" : "Confirm Pro cancellation"} onClick={(event) => {
          if (event.target === event.currentTarget) {
            actions.closeCancelConfirm();
          }
        }}>
          <div className="upgrade-success-modal">
            <div className="upgrade-success-icon" aria-hidden="true">!</div>
            <h3>{isVi ? "Xác nhận hủy gói Pro" : "Confirm Pro cancellation"}</h3>
            <p>
              {isVi
                ? `Bạn vẫn được dùng đầy đủ Pro đến hết ngày ${planExpiresAtText}. Sau thời điểm này, tài khoản sẽ về Free.`
                : `Your Pro access remains active until ${planExpiresAtText}. After that, your account switches back to Free.`}
            </p>
            <div className="upgrade-success-actions">
              <button type="button" className="primary-button" onClick={actions.confirmCancelProPlan}>
                {isVi ? "Xác nhận hủy" : "Confirm cancellation"}
              </button>
              <button type="button" className="ghost-button" onClick={actions.closeCancelConfirm}>
                {isVi ? "Giữ gói Pro" : "Keep Pro"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {successPopupOpen && typeof document !== "undefined" ? createPortal(
        <div className="upgrade-success-overlay" role="dialog" aria-modal="true" aria-label={isVi ? "Nâng cấp thành công" : "Upgrade success"}>
          <div className="upgrade-success-modal">
            <div className="upgrade-success-icon" aria-hidden="true">✓</div>
            <h3>{isVi ? "Nâng cấp Pro thành công" : "Pro upgrade successful"}</h3>
            <p>{successPopupMessage}</p>
            <div className="upgrade-success-actions">
              <a className="primary-button" href={routes.scriptProductInfo}>{isVi ? "Bắt đầu sử dụng Pro" : "Start using Pro"}</a>
              <button type="button" className="ghost-button" onClick={actions.closeSuccessPopup}>{isVi ? "Đóng" : "Close"}</button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </NextPageFrame>
  );
}


