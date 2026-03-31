# Production Checklist

## 1. Database

- [ ] Create Supabase project
- [ ] Run `SUPABASE_SCHEMA.sql`
- [ ] Confirm tables exist:
  - [ ] `users`
  - [ ] `history_items`
  - [ ] `favorites`
  - [ ] `sessions`

## 2. Environment Variables

- [ ] `PUBLIC_BASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `AI_API_BASE`
- [ ] `AI_API_KEY`
- [ ] `AI_MODEL`
- [ ] `SMTP_HOST`
- [ ] `SMTP_PORT`
- [ ] `SMTP_USER`
- [ ] `SMTP_PASS`
- [ ] `SMTP_FROM`
- [ ] `SMTP_SECURE`

## 3. Google OAuth

- [ ] Create Google OAuth Web App credentials
- [ ] Set `GOOGLE_CLIENT_ID`
- [ ] Set `GOOGLE_CLIENT_SECRET`
- [ ] Add local callback:
  - [ ] `http://127.0.0.1:3000/api/auth/google/callback`
- [ ] Add production callback:
  - [ ] `https://your-domain.com/api/auth/google/callback`

## 4. SMTP / OTP

- [ ] Test signup OTP email
- [ ] Test password reset OTP email
- [ ] Confirm OTP mail subject/body render correctly

## 5. App Flows

- [ ] Sign up with OTP
- [ ] Login with email/password
- [ ] Reset password
- [ ] Login with Google
- [ ] Generate product content
- [ ] Improve generated content
- [ ] Save favorite
- [ ] Restore from history
- [ ] Open favorite from profile

## 6. Vercel Deploy

- [ ] Add all env vars to Vercel
- [ ] Deploy from the Next.js runtime
- [ ] Validate `/login`
- [ ] Validate `/scriptProductInfo`
- [ ] Validate `/profile`

## 7. Launch Readiness (P0 freeze + monitoring)

- [ ] Freeze new features for 5-7 days before launch window
- [ ] Keep only P0 fixes (upload/suggest/generate/login/history)
- [ ] Confirm admin has `Launch metrics` tab in `/admin`
- [ ] Check launch metrics for at least 3 consecutive days:
  - [ ] Generate success rate >= 97%
  - [ ] First output completion rate >= 80%
  - [ ] Average first output latency < 10s
  - [ ] No recurring top errors without owner
- [ ] Verify `/api/health` returns 200

## 8. Onboarding + Feedback Loop

- [ ] Verify first-time onboarding banner appears on `/scriptProductInfo`
- [ ] Verify quickstart (`Dùng dữ liệu mẫu`) can produce first output
- [ ] Verify onboarding dismiss state is persisted
- [ ] Verify feedback box can submit to `/api/feedback`
- [ ] Review feedback daily during first launch week

## 9. Closed Beta Rollout

- [ ] Invite 20-30 pilot sellers
- [ ] Capture real-world bug reports by category
- [ ] Prioritize fixes by frequency x severity
- [ ] Re-check launch metrics after each hotfix

## 10. Benchmark Automation

- [ ] Run `npm run benchmark:run` against production at least 2 times/day in launch week
- [ ] Ensure category benchmark passes threshold (category >= 85%, group >= 90%, confident >= 70%)
- [ ] Ensure launch KPI benchmark is executed with admin auth cookie
- [ ] Store benchmark summary artifacts under `scripts/benchmark-output/`
- [ ] Configure `BENCHMARK_ALERT_WEBHOOK_URL` for warning/fail notifications

## 11. Post-Deploy Cleanup

- [ ] Decide when to retire legacy `server.js`
- [ ] Rotate shared keys exposed during development
- [ ] Move sample/dev accounts out of production data
