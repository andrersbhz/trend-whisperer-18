create table if not exists public.social_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
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
  user_id uuid not null,
  article_id uuid null,
  target_keys text[] not null default '{}',
  caption text not null,
  image_url text null,
  link_url text null,
  scheduled_at timestamptz not null default now(),
  status text not null default 'pending',
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
create index if not exists social_queue_due_idx on public.social_queue(status, scheduled_at, next_attempt_at) where status in ('pending','failed');
create index if not exists social_queue_user_idx on public.social_queue(user_id, created_at desc);

create table if not exists public.social_planners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
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
  next_run_at timestamptz,
  last_error text,
  timezone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_planners_user_idx on public.social_planners(user_id, enabled);

create table if not exists public.social_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  article_id uuid null references public.articles(id) on delete set null,
  name text not null,
  source_type text not null default 'article' check (source_type in ('article','custom','external')),
  base_url text null,
  preset text not null default 'normal' check (preset in ('light','normal','aggressive','custom')),
  publish_wordpress boolean not null default false,
  status text not null default 'active' check (status in ('draft','active','paused','completed','cancelled')),
  target_keys text[] not null default '{}',
  utm_campaign text not null default 'autopostwp',
  total_items integer not null default 0,
  idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_campaign_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.social_campaigns(id) on delete cascade,
  user_id uuid not null,
  queue_id uuid null references public.social_queue(id) on delete set null,
  target_key text not null,
  platform text not null,
  variant integer not null default 1,
  destination_url text null,
  utm_source text not null,
  utm_medium text not null default 'social',
  utm_campaign text not null default 'autopostwp',
  utm_content text null,
  scheduled_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.social_traffic_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  campaign_id uuid null references public.social_campaigns(id) on delete set null,
  article_id uuid null references public.articles(id) on delete set null,
  platform text null,
  target_key text null,
  event_type text not null check (event_type in ('click','view','engagement','conversion')),
  event_value numeric null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.social_queue drop constraint if exists social_queue_status_check;
alter table public.social_queue add constraint social_queue_status_check
  check (status in ('pending','processing','published','partial','failed','needs_review','cancelled'));
alter table public.social_queue
  add column if not exists idempotency_key text,
  add column if not exists planner_id uuid references public.social_planners(id) on delete set null;
create unique index if not exists social_queue_idempotency_idx on public.social_queue(user_id, idempotency_key) where idempotency_key is not null;
create unique index if not exists social_campaigns_idempotency_idx on public.social_campaigns(user_id, idempotency_key) where idempotency_key is not null;
create index if not exists social_campaigns_user_created_idx on public.social_campaigns(user_id, created_at desc);
create index if not exists social_campaign_items_campaign_idx on public.social_campaign_items(campaign_id, scheduled_at);
create index if not exists social_traffic_events_campaign_idx on public.social_traffic_events(campaign_id, occurred_at desc);

alter table public.social_publications
  add column if not exists social_queue_id uuid references public.social_queue(id) on delete set null;
create unique index if not exists social_publications_queue_target_idx
  on public.social_publications(social_queue_id, account_key) where social_queue_id is not null;

grant select, insert, update, delete on table
  public.social_templates, public.social_queue, public.social_planners,
  public.social_campaigns, public.social_campaign_items, public.social_traffic_events
to authenticated;
grant all on table
  public.social_templates, public.social_queue, public.social_planners,
  public.social_campaigns, public.social_campaign_items, public.social_traffic_events
to service_role;
grant usage, select on sequence public.social_traffic_events_id_seq to authenticated, service_role;

alter table public.social_templates enable row level security;
alter table public.social_queue enable row level security;
alter table public.social_planners enable row level security;
alter table public.social_campaigns enable row level security;
alter table public.social_campaign_items enable row level security;
alter table public.social_traffic_events enable row level security;

drop policy if exists "users_manage_own_social_templates" on public.social_templates;
create policy "users_manage_own_social_templates" on public.social_templates for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users_manage_own_social_queue" on public.social_queue;
create policy "users_manage_own_social_queue" on public.social_queue for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users_manage_own_social_planners" on public.social_planners;
create policy "users_manage_own_social_planners" on public.social_planners for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users manage own social campaigns" on public.social_campaigns;
create policy "users manage own social campaigns" on public.social_campaigns for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users manage own social campaign items" on public.social_campaign_items;
create policy "users manage own social campaign items" on public.social_campaign_items for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "users manage own traffic events" on public.social_traffic_events;
create policy "users manage own traffic events" on public.social_traffic_events for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.claim_next_social_job(p_user_id uuid default null)
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
  where (
      status in ('pending','failed')
      or (status = 'processing' and locked_at < now() - interval '10 minutes')
    )
    and (p_user_id is null or user_id = p_user_id)
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
  set status = 'processing', locked_at = now(), attempts = attempts + 1, updated_at = now()
  where id = picked.id
  returning * into picked;

  return next picked;
end;
$$;
revoke all on function public.claim_next_social_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_next_social_job(uuid) to service_role;

create or replace function public.create_social_campaign_atomic(p_user_id uuid, p_campaign jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_row public.social_campaigns%rowtype;
  item jsonb;
  queue_row_id uuid;
  inserted_count integer := 0;
begin
  if p_user_id is null or coalesce(jsonb_array_length(p_items), 0) = 0 then
    raise exception 'Invalid campaign payload';
  end if;

  select * into campaign_row from public.social_campaigns
  where user_id = p_user_id and idempotency_key = nullif(p_campaign->>'idempotency_key', '')
  limit 1;

  if campaign_row.id is not null then
    return jsonb_build_object('campaign', to_jsonb(campaign_row), 'existing', true, 'created_count', 0);
  end if;

  insert into public.social_campaigns (
    user_id, article_id, name, source_type, base_url, preset,
    publish_wordpress, status, target_keys, utm_campaign, total_items, idempotency_key
  ) values (
    p_user_id,
    nullif(p_campaign->>'article_id', '')::uuid,
    p_campaign->>'name',
    coalesce(p_campaign->>'source_type', 'article'),
    nullif(p_campaign->>'base_url', ''),
    coalesce(p_campaign->>'preset', 'normal'),
    coalesce((p_campaign->>'publish_wordpress')::boolean, false),
    'active',
    array(select jsonb_array_elements_text(coalesce(p_campaign->'target_keys', '[]'::jsonb))),
    coalesce(p_campaign->>'utm_campaign', 'autopostwp'),
    jsonb_array_length(p_items),
    nullif(p_campaign->>'idempotency_key', '')
  ) returning * into campaign_row;

  for item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.social_queue (
      user_id, article_id, target_keys, caption, image_url, link_url,
      scheduled_at, status, attempts, max_attempts, idempotency_key
    ) values (
      p_user_id,
      nullif(p_campaign->>'article_id', '')::uuid,
      array[item->>'target_key'],
      item->>'caption',
      nullif(item->>'image_url', ''),
      nullif(item->>'destination_url', ''),
      (item->>'scheduled_at')::timestamptz,
      'pending', 0, 4,
      item->>'idempotency_key'
    ) returning id into queue_row_id;

    insert into public.social_campaign_items (
      campaign_id, user_id, queue_id, target_key, platform, variant,
      destination_url, utm_source, utm_medium, utm_campaign, utm_content, scheduled_at
    ) values (
      campaign_row.id, p_user_id, queue_row_id, item->>'target_key',
      item->>'platform', (item->>'variant')::integer,
      nullif(item->>'destination_url', ''), item->>'utm_source',
      'social', p_campaign->>'utm_campaign', nullif(item->>'utm_content', ''),
      (item->>'scheduled_at')::timestamptz
    );
    inserted_count := inserted_count + 1;
  end loop;

  return jsonb_build_object('campaign', to_jsonb(campaign_row), 'existing', false, 'created_count', inserted_count);
end;
$$;
revoke all on function public.create_social_campaign_atomic(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_social_campaign_atomic(uuid, jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';