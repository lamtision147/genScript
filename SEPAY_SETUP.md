# SePay auto-approval setup

This project supports automatic Pro activation via SePay webhook.

## 1) Configure webhook endpoint in SePay

- Webhook URL: `https://gen-script-tau.vercel.app/api/billing/sepay-webhook`
- Method: `POST`
- Content-Type: `application/json`

## 2) Set webhook secret (recommended)

Set the same secret in SePay webhook config and Vercel env:

```bash
npx vercel env add SEPAY_WEBHOOK_SECRET production
```

The server accepts token via one of these:
- `Authorization: Bearer <secret>`
- `x-sepay-signature: <secret>`
- `x-sepay-token: <secret>`
- `x-api-key: <secret>`

## 3) Deploy

```bash
npx vercel --prod --yes
```

## 4) Supabase migration (idempotency table)

Run:
- `scripts/supabase-sepay-webhook-migration.sql`

or ensure table exists from `SUPABASE_SCHEMA.sql`:
- `public.billing_webhook_events`

## 5) How matching works

- User creates manual upgrade intent -> pending row with transaction ref: `manual_<transferRef>`
- User transfer content includes: `PRO <transferRef>`
- SePay webhook extracts `transferRef` and amount
- Server calls activation:
  - if pending row exists and amount is valid -> upgrade to Pro automatically
  - if not found / mismatch -> keeps pending for manual admin handling

## 6) Recommended payload fields from SePay

At least one transfer-content field should include `PRO <transferRef>`:
- `content` / `description` / `transactionContent` / `transferContent` / `addInfo`

Amount fields accepted:
- `transferAmount`, `amount`, `creditAmount`, `transactionAmount`

Transaction id fields accepted:
- `gatewayTransactionId`, `transactionId`, `id`, `referenceCode`, `sepayTransactionId`, `txnId`
