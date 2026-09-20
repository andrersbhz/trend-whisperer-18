-- AutoPostWP v1.5 — Distribution Hub
-- WordPress becomes an optional destination; social distribution is first-class.

create table if not exists public.social_campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_campaign_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.social_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
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
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid null references public.social_campaigns(id) on delete set null,
  article_id uuid null references public.articles(id) on delete set null,
  platform text null,
  target_key text null,
  event_type text not null check (event_type in ('click','view','engagement','conversion')),
  event_value numeric null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.social_campaigns enable row level security;
alter table public.social_campaign_items enable row level security;
alter table public.social_traffic_events enable row level security;

create policy "users manage own social campaigns" on public.social_campaigns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own social campaign items" on public.social_campaign_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users manage own traffic events" on public.social_traffic_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists social_campaigns_user_created_idx on public.social_campaigns(user_id, created_at desc);
create index if not exists social_campaign_items_campaign_idx on public.social_campaign_items(campaign_id, scheduled_at);
create index if not exists social_traffic_events_campaign_idx on public.social_traffic_events(campaign_id, occurred_at desc);

comment on table public.social_campaigns is 'AutoPostWP v1.5 multi-channel distribution campaigns. WordPress is optional.';
comment on table public.social_campaign_items is 'Per-network scheduled variants with UTM attribution.';
