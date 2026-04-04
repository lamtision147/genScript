-- SePay webhook idempotency table migration
-- Run this in Supabase SQL editor.

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_webhook_events_event_type on public.billing_webhook_events(event_type);
