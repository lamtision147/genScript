-- Billing subscriptions migration
-- Run this file in Supabase SQL editor after main schema is applied.

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active',
  provider text,
  transaction_ref text,
  amount numeric(12,2) not null default 0,
  currency text not null default 'VND',
  upgraded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create index if not exists idx_billing_subscriptions_plan on public.billing_subscriptions(plan);
create index if not exists idx_billing_subscriptions_status on public.billing_subscriptions(status);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_webhook_events_event_type on public.billing_webhook_events(event_type);

-- Optional backfill: create free subscriptions for users without any row.
insert into public.billing_subscriptions (
  user_id,
  plan,
  status,
  provider,
  transaction_ref,
  amount,
  currency,
  upgraded_at,
  updated_at
)
select
  u.id,
  'free',
  'active',
  'backfill',
  concat('backfill_', u.id::text),
  0,
  'VND',
  now(),
  now()
from public.users u
left join public.billing_subscriptions b on b.user_id = u.id
where b.user_id is null;
