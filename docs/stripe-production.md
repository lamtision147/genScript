# Stripe Production Setup

This document explains how to run Seller Studio Pro billing with Stripe in production.

## 1) Required environment variables

Set these variables in your deployment environment (e.g. Vercel Project Settings):

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PUBLIC_BASE_URL` (must match your public app domain)
- `SESSION_SECRET` (minimum 24 chars)

Reference file: `.env.example`.

## 2) Create Stripe webhook endpoint

In Stripe Dashboard:

1. Open **Developers -> Webhooks**.
2. Add endpoint URL:
   - `https://<your-domain>/api/billing/stripe-webhook`
3. Subscribe to event:
   - `checkout.session.completed`
4. Copy webhook signing secret into:
   - `STRIPE_WEBHOOK_SECRET`

## 3) Checkout flow used in app

1. UI calls `POST /api/billing/create-checkout-session`.
2. API creates a Stripe Checkout Session and returns `checkoutUrl`.
3. User pays on Stripe hosted page.
4. User returns to `/upgrade?checkout=success&session_id=...`.
5. UI calls `POST /api/billing/confirm-checkout`.
6. App upgrades user to Pro after confirming payment status `paid`.
7. Webhook endpoint also receives the completion event and can finalize upgrade.

## 4) Idempotency strategy

Current implementation is safe to call multiple times because subscription upsert is keyed by `user_id`.

Recommended hardening (next patch):

- Persist processed Stripe event IDs in a dedicated table (e.g. `billing_webhook_events`).
- Ignore duplicate events if `event_id` already exists.
- Log all webhook failures with request ID and event ID.

## 5) Go-live checklist

- Run SQL migration for `billing_subscriptions` (see `scripts/supabase-billing-migration.sql`).
- Confirm `/upgrade` shows Stripe button when env keys are configured.
- Complete a real test payment in Stripe test mode.
- Verify plan changes to Pro in:
  - `/upgrade`
  - `/profile`
  - `/admin` subscription panel
- Verify Free limits apply after downgrade.

## 6) Rollback plan

If Stripe endpoints fail in production:

- Keep existing mock upgrade route enabled as fallback (`/api/billing/upgrade`).
- Disable Stripe button from UI by removing Stripe env keys.
- Billing still works via internal mock for emergency continuity.
