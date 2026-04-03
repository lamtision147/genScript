-- Generation quota migration
-- Run this file in Supabase SQL editor after main schema is applied.

create table if not exists public.generation_quota_daily (
  id uuid primary key default gen_random_uuid(),
  actor_key text not null,
  actor_type text not null default 'guest',
  user_id uuid references public.users(id) on delete set null,
  day date not null,
  scope text not null,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(actor_key, day, scope)
);

create index if not exists idx_generation_quota_daily_user_day on public.generation_quota_daily(user_id, day);
create index if not exists idx_generation_quota_daily_actor_day on public.generation_quota_daily(actor_key, day);
