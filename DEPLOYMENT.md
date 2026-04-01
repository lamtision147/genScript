# Deployment Notes

## Current status

This project currently runs as a custom Node server with:

- local JSON files for users/history
- in-memory sessions
- local SMTP-based OTP
- AI calls through OmniRoute or OpenAI-compatible APIs

## Important production warning

The current storage/session approach is **not durable on Vercel** because:

- filesystem writes are ephemeral
- in-memory session state is not shared across serverless invocations

## Recommended production architecture

For a reliable Vercel deployment, migrate to:

- Next.js App Router
- persistent database (e.g. Postgres / Supabase)
- durable session store (e.g. database or auth provider)
- durable file/object storage for uploads

## Minimum migration targets

1. Move auth/session/history/favorites into persistent storage.
2. Replace local JSON files with DB tables.
3. Replace in-memory session maps with signed sessions or managed auth.
4. Keep AI generation in server-side route handlers.
5. Keep SMTP OTP or switch to a managed auth/email provider.

## Environment variables

Use `.env.example` as the base reference.

### Billing + Stripe variables

For production Pro billing with Stripe, also set:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

Detailed runbook: `docs/stripe-production.md`.
Operational checklist: `docs/stripe-go-live-checklist.md`.

## Suggested next stack

- Next.js
- Supabase (auth + Postgres) or Prisma + Postgres
- Resend / SMTP for email
- Vercel Blob / S3 for uploads

## Current migration status

- Next.js App Router scaffold: done
- Login/Profile/Product pages: in progress but already usable
- Auth/history/favorites API routes in Next.js: done
- Supabase-ready service layer: done
- AI generate route in Next.js: done
- Final production cutover from legacy runtime: pending

## Production recommendation

Use `npm run dev` / `npm run build` / `npm run start` for the Next.js runtime going forward.
Keep `legacy-start` only as a temporary fallback during migration.

## Launch operations runbook

For launch week operations, use this cadence:

1. P0 freeze window (5-7 days)
   - Only fix blockers in upload/suggest/generate/login/history.
2. Admin monitoring
   - Review `/admin` -> `AI Usage` and `Launch metrics` tabs at least twice daily.
3. Key thresholds before scaling traffic
   - Generate success rate >= 97%
   - First output completion rate >= 80%
   - Average first output latency < 10s
4. Feedback loop
   - Collect in-app feedback from `/scriptProductInfo` quick feedback panel.
   - Resolve highest-frequency issues first.
5. Roll-forward strategy
   - Deploy small, frequent patches.
   - Re-validate `npm run build` and key E2E flows before each production deploy.
