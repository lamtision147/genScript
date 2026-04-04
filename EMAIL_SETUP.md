# Email setup (no-reply + OTP + renewal reminders)

This project now sends OTP, password reset OTP, and renewal reminder emails from a no-reply sender.

## 1) Required SMTP envs

Set these in Vercel (production):

```bash
npx vercel env add SMTP_HOST production
npx vercel env add SMTP_PORT production
npx vercel env add SMTP_SECURE production
npx vercel env add SMTP_USER production
npx vercel env add SMTP_PASS production
```

## 2) no-reply sender env (recommended)

Use one of these:

- `MAIL_FROM_NO_REPLY` (preferred)
- or `SMTP_FROM_NO_REPLY`
- or `MAIL_FROM_DOMAIN` (auto builds `no-reply@<domain>`)

Example:

```bash
npx vercel env add MAIL_FROM_NO_REPLY production
```

Value example:

`Seller Studio <no-reply@yourdomain.com>`

## 3) Renewal reminder scheduler

The project includes a Vercel cron:

- path: `/api/cron/billing-renewal-reminder`
- schedule: `0 2 * * *` (daily)

Set secret to protect cron endpoint:

```bash
npx vercel env add CRON_SECRET production
```

Optional reminder days (default: `7,3,1`):

```bash
npx vercel env add RENEWAL_REMINDER_DAYS production
```

Example value: `7,3,1`

## 4) Deploy

```bash
npx vercel --prod --yes
```

## 5) Manual test renewal cron

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://gen-script-tau.vercel.app/api/cron/billing-renewal-reminder
```

## Notes

- OTP signup and forgot-password now use the same no-reply sender.
- Renewal reminders are deduplicated per user/day-threshold using a reminder state store.
