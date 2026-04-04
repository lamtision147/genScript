"use client";

import NextPageFrame from "@/components/next-page-frame";
import NextShellHeader from "@/components/next-shell-header";
import NextTextField from "@/components/next-text-field";
import NextSelectField from "@/components/next-select-field";
import { useUiLanguage } from "@/hooks/use-ui-language";
import { useUpgradeWorkspace } from "@/hooks/use-upgrade-workspace";
import { routes } from "@/lib/routes";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function NextUpgradePage() {
  const { language, setLanguage } = useUiLanguage("vi");
  const {
    session,
    planInfo,
    paymentProvider,
    selectedGateway,
    internalPaymentMethod,
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
  const usingInternal = selectedGateway === "internal";
  const usingInternalCard = usingInternal && internalPaymentMethod === "card";
  const isStripeAvailable = paymentProvider === "stripe";
  const hasSelectedGateway = Boolean(selectedGateway);
  const isLoggedIn = Boolean(session?.id || session?.email);
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
  const renewalMode = Boolean(isPro && planInfo?.cancelAtPeriodEnd);
  const canPurchasePro = Boolean(isLoggedIn && (!isPro || renewalMode));
  const [showPaymentSection, setShowPaymentSection] = useState(false);
  const proPerks = isVi
    ? [
      "Không giới hạn lượt tạo/cải tiến",
      "Tạo nhiều bản kịch bản cho cùng 1 brief",
      "So sánh theo tab, chốt nhanh bản tốt nhất",
      "Lưu trữ lịch sử nội dung không giới hạn"
    ]
    : [
      "Unlimited generate/improve",
      "Create multiple script versions for one brief",
      "Compare by tabs and lock the best version faster",
      "Unlimited content history storage"
    ];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const checkoutStatus = String(params.get("checkout") || "").toLowerCase();
    const sessionId = String(params.get("session_id") || "").trim();

    if (checkoutStatus === "cancel") {
      actions.setMessage(isVi ? "Bạn đã hủy thanh toán Stripe." : "You cancelled Stripe checkout.");
      setShowPaymentSection(true);
      return;
    }

    if (checkoutStatus === "success" && sessionId) {
      actions.confirmStripeCheckout(sessionId);
    }
  }, [isVi]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#upgrade-payment-card") {
      setShowPaymentSection(true);
    }
  }, []);

  function openPaymentSection() {
    setShowPaymentSection(true);
    setTimeout(() => {
      const paymentNode = document.getElementById("upgrade-payment-card");
      paymentNode?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

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
                {proPerks.map((perk) => <li key={perk}>{perk}</li>)}
              </ul>
            </article>

            <article className="upgrade-info-card">
              <h3 className="subsection-title">{isVi ? "Trạng thái tài khoản" : "Account status"}</h3>
              {!isLoggedIn ? (
                <div className="history-empty">
                  {isVi
                    ? "Vui lòng đăng nhập để xem trạng thái tài khoản và thông tin gói Pro của bạn."
                    : "Please log in to view your account status and Pro plan details."}
                </div>
              ) : null}
              <div className="upgrade-limit-rows">
                <div className="upgrade-limit-row">
                  <span>{isVi ? "Gói hiện tại" : "Current plan"}</span>
                  <strong>{isLoggedIn ? (isPro ? "PRO" : "FREE") : "--"}</strong>
                </div>
                <div className="upgrade-limit-row">
                  <span>{isVi ? "Yêu thích" : "Favorites"}</span>
                  <strong>{isLoggedIn ? favoriteLimitText : "--"}</strong>
                </div>
                <div className="upgrade-limit-row">
                  <span>{isVi ? "Lịch sử" : "History"}</span>
                  <strong>{isLoggedIn ? historyLimitText : "--"}</strong>
                </div>
                <div className="upgrade-limit-row">
                  <span>{isVi ? "Generate/ngày (Nội dung sản phẩm)" : "Daily generate (Product)"}</span>
                  <strong>{isLoggedIn ? (isPro ? (isVi ? "Không giới hạn" : "Unlimited") : "5") : "--"}</strong>
                </div>
                <div className="upgrade-limit-row">
                  <span>{isVi ? "Generate/ngày (Kịch bản video)" : "Daily generate (Video)"}</span>
                  <strong>{isLoggedIn ? (isPro ? (isVi ? "Không giới hạn" : "Unlimited") : "5") : "--"}</strong>
                </div>
                <div className="upgrade-limit-row">
                  <span>{isVi ? "Hiệu lực gói Pro đến" : "Pro valid until"}</span>
                  <strong>{isLoggedIn ? (isPro ? planExpiresAtText : (isVi ? "Không áp dụng" : "N/A")) : "--"}</strong>
                </div>
                <div className="upgrade-limit-row">
                  <span>{isVi ? "Thời gian còn lại" : "Remaining time"}</span>
                  <strong>{isLoggedIn ? (isPro ? remainingDaysText : (isVi ? "Không áp dụng" : "N/A")) : "--"}</strong>
                </div>
                {isLoggedIn && isPro && planInfo?.cancelAtPeriodEnd ? (
                  <div className="upgrade-limit-row">
                    <span>{isVi ? "Trạng thái hủy" : "Cancellation status"}</span>
                    <strong>{isVi ? "Đã hủy, giữ Pro tới ngày hết hạn" : "Cancelled, Pro remains until expiry"}</strong>
                  </div>
                ) : null}
              </div>

              {!isLoggedIn ? (
                <div className="upgrade-actions-stack">
                  <a className="primary-button" href={routes.login}>{isVi ? "Đăng nhập để tiếp tục" : "Log in to continue"}</a>
                </div>
              ) : isPro ? (
                <div className="upgrade-actions-stack">
                  {!planInfo?.cancelAtPeriodEnd ? (
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={cancelling}
                      onClick={actions.requestCancelProPlan}
                    >
                      {cancelling
                        ? (isVi ? "Đang hủy..." : "Cancelling...")
                        : (isVi ? "Hủy gói Pro" : "Cancel Pro plan")}
                    </button>
                  ) : (
                    <button type="button" className="primary-button" onClick={openPaymentSection}>
                      {isVi ? "Nâng cấp gói Pro" : "Upgrade to Pro"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="upgrade-actions-stack">
                  <button type="button" className="primary-button" onClick={openPaymentSection}>
                    {isVi ? "Nâng cấp gói Pro" : "Upgrade to Pro"}
                  </button>
                </div>
              )}
            </article>

            {showPaymentSection ? (
              <section id="upgrade-payment-card" className="upgrade-payment-card">
                <h3 className="subsection-title">{isVi ? "Thanh toán" : "Payment"}</h3>
                <p className="inline-note">
                  {paymentProvider === "stripe"
                    ? (isVi ? "Stripe đã sẵn sàng ở backend. Bạn có thể thanh toán trực tiếp qua Stripe hoặc dùng form nội bộ để demo." : "Stripe is configured on backend. You can pay via Stripe or use internal form for demo flow.")
                    : (isVi ? "Đang chạy giao diện thanh toán nội bộ (mock)." : "Using internal mock payment UI.")}
                </p>

                <NextSelectField
                  label={isVi ? "Cổng thanh toán" : "Payment gateway"}
                  value={selectedGateway}
                  options={[
                    { value: "", label: isVi ? "-- Chọn cổng thanh toán --" : "-- Select payment gateway --" },
                    ...(isStripeAvailable
                    ? [
                      { value: "stripe", label: "Stripe" },
                      { value: "internal", label: isVi ? "Nội bộ (mock)" : "Internal (mock)" }
                    ]
                    : [{ value: "internal", label: isVi ? "Nội bộ (mock)" : "Internal (mock)" }])
                  ]}
                  onChange={actions.setPaymentGateway}
                />

                {usingInternal ? (
                  <NextSelectField
                    label={isVi ? "Phương thức thanh toán" : "Payment method"}
                    value={internalPaymentMethod}
                    options={[
                      { value: "card", label: isVi ? "Thẻ tín dụng/ghi nợ" : "Credit / Debit card" },
                      { value: "bank_transfer", label: isVi ? "Chuyển khoản ngân hàng" : "Bank transfer" },
                      { value: "momo", label: "MoMo" },
                      { value: "zalopay", label: "ZaloPay" }
                    ]}
                    onChange={actions.setInternalPaymentMethod}
                  />
                ) : null}

                {hasSelectedGateway && usingStripe ? (
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
                ) : (hasSelectedGateway ? (
                  <>
                    {usingInternalCard ? (
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
                    ) : (
                      <>
                        <div className="form-grid">
                          <NextTextField
                            label={isVi ? "Tên người thanh toán" : "Payer name"}
                            value={cardForm.payerName}
                            onChange={(value) => actions.updateCardField("payerName", value)}
                            placeholder={isVi ? "NGUYEN VAN A" : "JOHN DOE"}
                          />
                          <NextTextField
                            label={isVi ? "Mã giao dịch" : "Transaction reference"}
                            value={cardForm.transferRef}
                            onChange={(value) => actions.updateCardField("transferRef", value)}
                            placeholder={isVi ? "VD: PRO2026A1" : "Ex: PRO2026A1"}
                          />
                        </div>

                        <div className="upgrade-gateway-preview">
                          <div className="upgrade-gateway-preview-head">
                            <strong>
                              {internalPaymentMethod === "bank_transfer"
                                ? (isVi ? "Chuyển khoản ngân hàng" : "Bank transfer")
                                : internalPaymentMethod === "momo"
                                  ? "MoMo"
                                  : "ZaloPay"}
                            </strong>
                            <span>
                              {isVi
                                ? "Demo phương thức thanh toán nội bộ: nhập thông tin người thanh toán và mã giao dịch để hoàn tất nâng cấp."
                                : "Internal payment method demo: enter payer info and transaction reference to complete upgrade."}
                            </span>
                          </div>
                          <div className="upgrade-gateway-preview-rows">
                            <div>
                              <span>{isVi ? "Người nhận" : "Receiver"}</span>
                              <strong>SellerScript Pro</strong>
                            </div>
                            <div>
                              <span>{isVi ? "Nội dung CK" : "Transfer note"}</span>
                              <strong>{isVi ? "Nâng cấp Pro + email tài khoản" : "Upgrade Pro + account email"}</strong>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="upgrade-gateway-placeholder">
                    {isVi
                      ? "Vui lòng chọn cổng thanh toán để hiển thị thông tin và form thanh toán tương ứng."
                      : "Please select a payment gateway to show the corresponding payment details and form."}
                  </div>
                ))}

                <div className="upgrade-payment-actions">
                  {usingStripe ? (
                    <button
                      type="button"
                      className="primary-button"
                      disabled={processing || loadingPlan || !canPurchasePro || !hasSelectedGateway}
                      onClick={actions.startStripeCheckout}
                    >
                      {!canPurchasePro
                        ? (isVi ? "Bạn đang ở gói Pro" : "You are already on Pro")
                        : (processing
                          ? (isVi ? "Đang chuyển tới Stripe..." : "Redirecting to Stripe...")
                          : (renewalMode
                            ? (isVi ? "Thanh toán gia hạn Pro qua Stripe" : "Pay via Stripe to extend Pro")
                            : (isVi ? "Thanh toán qua Stripe" : "Pay with Stripe")))}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary-button"
                      disabled={processing || loadingPlan || !canPurchasePro || !hasSelectedGateway}
                      onClick={actions.submitUpgrade}
                    >
                      {!canPurchasePro
                        ? (isVi ? "Bạn đang ở gói Pro" : "You are already on Pro")
                        : (processing
                          ? (isVi ? "Đang xử lý thanh toán..." : "Processing payment...")
                          : (renewalMode
                            ? (isVi ? "Thanh toán để gia hạn Pro" : "Pay to extend Pro")
                            : (isVi ? "Thanh toán và nâng cấp Pro" : "Pay and upgrade to Pro")))}
                    </button>
                  )}

                  {usingStripe && canPurchasePro && hasSelectedGateway ? (
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
            ) : null}

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
            <div className="upgrade-success-badge">{isVi ? "PRO ĐÃ KÍCH HOẠT" : "PRO ACTIVATED"}</div>
            <h3>{isVi ? "Nâng cấp Pro thành công" : "Pro upgrade successful"}</h3>
            <p className="upgrade-success-subtitle">
              {isVi
                ? "Tài khoản của bạn đã mở đầy đủ đặc quyền Pro. Bạn có thể bắt đầu tạo nhiều phiên bản nội dung và tối ưu chuyển đổi ngay." 
                : "Your account now has full Pro benefits. You can generate multiple content variants and optimize conversion right away."}
            </p>

            <div className="upgrade-success-summary">
              <div className="upgrade-success-summary-item">
                <span>{isVi ? "Gói hiện tại" : "Current plan"}</span>
                <strong>PRO</strong>
              </div>
              <div className="upgrade-success-summary-item">
                <span>{isVi ? "Hiệu lực đến" : "Valid until"}</span>
                <strong>{planExpiresAtText}</strong>
              </div>
              <div className="upgrade-success-summary-item">
                <span>{isVi ? "Thời gian còn lại" : "Remaining time"}</span>
                <strong>{remainingDaysText}</strong>
              </div>
              <div className="upgrade-success-summary-item">
                <span>{isVi ? "Giới hạn tạo" : "Generate limit"}</span>
                <strong>{isVi ? "Không giới hạn" : "Unlimited"}</strong>
              </div>
            </div>

            <ul className="upgrade-success-perks">
              {proPerks.map((perk) => (
                <li key={perk}>{perk}</li>
              ))}
            </ul>

            <p className="upgrade-success-note">{successPopupMessage}</p>
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


