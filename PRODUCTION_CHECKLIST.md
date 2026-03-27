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

## 7. Post-Deploy Cleanup

- [ ] Decide when to retire legacy `server.js`
- [ ] Rotate shared keys exposed during development
- [ ] Move sample/dev accounts out of production data
