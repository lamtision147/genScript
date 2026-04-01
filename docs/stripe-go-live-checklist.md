# Stripe Go-Live Checklist

Use this checklist before turning on real payments.

## A) Environment & Secrets

- [ ] `PUBLIC_BASE_URL` points to production domain.
- [ ] `SESSION_SECRET` is set (>= 24 chars).
- [ ] `STRIPE_SECRET_KEY` is set to **live** key in production.
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set to **live** key in production.
- [ ] `STRIPE_WEBHOOK_SECRET` is copied from Stripe webhook endpoint.

## B) Database

- [ ] Run `scripts/supabase-billing-migration.sql` in production database.
- [ ] Confirm tables exist:
  - `billing_subscriptions`
  - `billing_webhook_events`
- [ ] Optional backfill executed for existing users.

## C) Stripe Dashboard

- [ ] Create webhook endpoint: `https://<domain>/api/billing/stripe-webhook`.
- [ ] Subscribe event: `checkout.session.completed`.
- [ ] Verify webhook delivery status is green.

## D) Functional Tests (live-like)

- [ ] User can open `/upgrade` and see Stripe button.
- [ ] Stripe checkout creates session from `/api/billing/create-checkout-session`.
- [ ] After successful payment, app upgrades user to Pro.
- [ ] `/profile` shows plan Pro and unlimited limits.
- [ ] `/scriptProductInfo` and `/scriptVideoReview` no longer show Free limit banner.
- [ ] Admin subscription panel can see upgraded user.
- [ ] Admin CSV export works.

## E) Failure/Recovery Tests

- [ ] Cancel payment returns user to `/upgrade?checkout=cancel` with correct message.
- [ ] Duplicate webhook event does not double-process (idempotency check).
- [ ] If Stripe temporarily fails, mock/manual upgrade endpoint still available for emergency support.

## F) Monitoring

- [ ] Track API error rate for:
  - `/api/billing/create-checkout-session`
  - `/api/billing/confirm-checkout`
  - `/api/billing/stripe-webhook`
- [ ] Track webhook failures and alert on repeated failures.

## G) Rollback

- [ ] Remove Stripe env keys to hide Stripe path (fallback to mock/manual flow).
- [ ] Keep existing user plan data unchanged.
- [ ] Communicate temporary maintenance status to internal team.
