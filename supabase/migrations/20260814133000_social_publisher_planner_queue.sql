-- Social Publisher: templates, planner and resilient queue
-- Designed to extend the existing facebook_accounts / threads_accounts infrastructure.

create table if not exists public.social_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  platform text not null default 'all',
  body text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_templates_user_idx on public.social_templates(user_id, platform);

create table if not exists public.social_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  article_id uuid null,
  target_keys text[] not null default '{}',
  caption text not null,
  image_url text null,
  link_url text null,
  scheduled_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','processing','published','partial','failed','cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 4,
  next_attempt_at timestamptz null,
  locked_at timestamptz null,
  last_error text null,
  result jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz null
);

create index if not exists social_queue_due_idx
  on public.social_queue(status, scheduled_at, next_attempt_at)
  where status in ('pending','failed');
create index if not exists social_queue_user_idx on public.social_queue(user_id, created_at desc);

create table if not exists public.social_planners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_keys text[] not null default '{}',
  template_id uuid null references public.social_templates(id) on delete set null,
  enabled boolean not null default true,
  weekdays smallint[] not null default '{1,2,3,4,5}',
  start_time time not null default '09:00',
  end_time time not null default '20:00',
  interval_minutes integer not null default 120 check (interval_minutes >= 5),
  filters jsonb not null default '{}'::jsonb,
  last_run_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_planners_user_idx on public.social_planners(user_id, enabled);

alter table public.social_templates enable row level security;
alter table public.social_queue enable row level security;
alter table public.social_planners enable row level security;

do $$ begin
  create policy "users_manage_own_social_templates" on public.social_templates
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users_manage_own_social_queue" on public.social_queue
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "users_manage_own_social_planners" on public.social_planners
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Claim one due job atomically. Service-role callers bypass RLS.
create or replace function public.claim_next_social_job()
returns setof public.social_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  picked public.social_queue%rowtype;
begin
  select * into picked
  from public.social_queue
  where status in ('pending','failed')
    and attempts < max_attempts
    and scheduled_at <= now()
    and coalesce(next_attempt_at, scheduled_at) <= now()
    and (locked_at is null or locked_at < now() - interval '10 minutes')
  order by coalesce(next_attempt_at, scheduled_at), created_at
  for update skip locked
  limit 1;

  if picked.id is null then
    return;
  end if;

  update public.social_queue
     set status = 'processing',
         locked_at = now(),
         attempts = attempts + 1,
         updated_at = now()
   where id = picked.id
   returning * into picked;

  return next picked;
end;
$$;

revoke all on function public.claim_next_social_job() from public, anon, authenticated;
grant execute on function public.claim_next_social_job() to service_role;
