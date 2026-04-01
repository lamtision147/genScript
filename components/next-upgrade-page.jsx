"use client";

import NextPageFrame from "@/components/next-page-frame";
import NextShellHeader from "@/components/next-shell-header";
import NextTextField from "@/components/next-text-field";
import { useUiLanguage } from "@/hooks/use-ui-language";
import { useUpgradeWorkspace } from "@/hooks/use-upgrade-workspace";
import { routes } from "@/lib/routes";
import { useEffect } from "react";

export default function NextUpgradePage() {
  const { language, setLanguage } = useUiLanguage("vi");
  const {
    session,
    planInfo,
    paymentProvider,
    loadingPlan,
    processing,
    cancelling,
    message,
    cardForm,
    isPro,
    actions
  } = useUpgradeWorkspace(language);

  const isVi = language === "vi";
  const title = isVi ? "Nâng cấp gói Pro" : "Upgrade to Pro";
  const subtitle = isVi
    ? "Mở toàn bộ giới hạn lưu trữ: lịch sử không giới hạn và yêu thích không giới hạn."
    : "Unlock all storage limits: unlimited history and unlimited favorites.";

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
          eyebrow="Seller Studio"
          title={title}
          subtitle={subtitle}
          user={session}
          language={language}
          onLanguageChange={setLanguage}
        />

        <section className="content-card upgrade-page-card">
          <div className="upgrade-grid">
            <section className="upgrade-plan-card">
              <div className="upgrade-badge">{isPro ? "PRO" : "FREE"}</div>
              <h2 className="section-title">{isVi ? "Gói Seller Studio Pro" : "Seller Studio Pro plan"}</h2>
              <p className="page-subtitle">
                {isVi ? "299.000đ / tháng" : "299,000 VND / month"}
              </p>

              <ul className="upgrade-feature-list">
                <li>{isVi ? "Lịch sử nội dung không giới hạn" : "Unlimited content history"}</li>
                <li>{isVi ? "Yêu thích không giới hạn" : "Unlimited favorites"}</li>
                <li>{isVi ? "Ưu tiên hỗ trợ từ team" : "Priority support from team"}</li>
              </ul>

              <div className="upgrade-limits-box">
                <div>
                  <strong>{isVi ? "Gói hiện tại:" : "Current plan:"}</strong>
                  <span>{isPro ? (isVi ? " Pro" : " Pro") : (isVi ? " Free" : " Free")}</span>
                </div>
                <div>
                  <strong>{isVi ? "Giới hạn yêu thích:" : "Favorites limit:"}</strong>
                  <span>
                    {planInfo?.limits?.unlimitedFavorites ? (isVi ? " Không giới hạn" : " Unlimited") : ` ${planInfo?.limits?.favoritesLimit ?? 5}`}
                  </span>
                </div>
                <div>
                  <strong>{isVi ? "Giới hạn lịch sử:" : "History limit:"}</strong>
                  <span>
                    {planInfo?.limits?.unlimitedHistory ? (isVi ? " Không giới hạn" : " Unlimited") : ` ${planInfo?.limits?.historyLimit ?? 5}`}
                  </span>
                </div>
              </div>

              {isPro ? (
                <div className="upgrade-actions-stack">
                  <button
                    type="button"
                    className="ghost-button"
                    disabled={cancelling}
                    onClick={actions.cancelProPlan}
                  >
                    {cancelling
                      ? (isVi ? "Đang hủy..." : "Cancelling...")
                      : (isVi ? "Hủy gói Pro" : "Cancel Pro plan")}
                  </button>
                  <a className="ghost-button" href={routes.scriptProductInfo}>{isVi ? "Quay lại Trang tạo nội dung" : "Back to Studio"}</a>
                </div>
              ) : null}
            </section>

            <section className="upgrade-payment-card">
              <h3 className="subsection-title">{isVi ? "Thanh toán" : "Payment"}</h3>
              <p className="inline-note">
                {paymentProvider === "stripe"
                  ? (isVi ? "Stripe đã sẵn sàng ở backend. UI hiện tại vẫn dùng form nội bộ để demo luồng." : "Stripe is configured on backend. Current UI still uses internal form for flow demo.")
                  : (isVi ? "Demo UI thanh toán nội bộ (mock)." : "Internal mock payment UI demo.")}
              </p>

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

              {!isPro && paymentProvider === "stripe" ? (
                <button
                  type="button"
                  className="ghost-button"
                  disabled={processing || loadingPlan}
                  onClick={actions.startStripeCheckout}
                >
                  {processing
                    ? (isVi ? "Đang chuyển tới Stripe..." : "Redirecting to Stripe...")
                    : (isVi ? "Thanh toán qua Stripe" : "Pay with Stripe")}
                </button>
              ) : null}

              {message ? <div className="history-empty">{message}</div> : null}
            </section>
          </div>
        </section>
      </section>
    </NextPageFrame>
  );
}
