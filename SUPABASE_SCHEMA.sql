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
