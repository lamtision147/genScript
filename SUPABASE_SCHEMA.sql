create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  password_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.history_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  title text,
  variant_label text,
  form_data jsonb not null default '{}'::jsonb,
  result_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  history_item_id uuid references public.history_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, history_item_id)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  session_token text unique not null,
  user_id uuid references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.support_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references public.users(id) on delete set null,
  name text,
  email text,
  contact text,
  page text,
  subject text,
  message text not null,
  status text not null default 'open',
  assigned_to text,
  admin_note text,
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_support_requests_created_at on public.support_requests(created_at desc);
create index if not exists idx_support_requests_status on public.support_requests(status);

create table if not exists public.support_chat_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'open',
  last_user_message_at timestamptz,
  last_admin_message_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists idx_support_chat_conversations_user on public.support_chat_conversations(user_id);
create index if not exists idx_support_chat_conversations_updated on public.support_chat_conversations(updated_at desc);
create index if not exists idx_support_chat_conversations_status on public.support_chat_conversations(status);

create table if not exists public.support_chat_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conversation_id uuid not null references public.support_chat_conversations(id) on delete cascade,
  sender_role text not null,
  sender_id uuid,
  message text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_support_chat_messages_conversation on public.support_chat_messages(conversation_id, created_at asc);

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
  expires_at timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create index if not exists idx_billing_subscriptions_plan on public.billing_subscriptions(plan);
create index if not exists idx_billing_subscriptions_status on public.billing_subscriptions(status);

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

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_webhook_events_event_type on public.billing_webhook_events(event_type);
