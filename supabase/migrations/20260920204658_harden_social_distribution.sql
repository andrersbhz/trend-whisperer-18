-- Reliability and idempotency hardening for AutoPostWP Social Distribution.

alter table public.social_queue
  drop constraint if exists social_queue_status_check;
alter table public.social_queue
  add constraint social_queue_status_check
  check (status in ('pending','processing','published','partial','failed','needs_review','cancelled'));

alter table public.social_queue
  add column if not exists idempotency_key text,
  add column if not exists planner_id uuid references public.social_planners(id) on delete set null;

create unique index if not exists social_queue_idempotency_idx
  on public.social_queue(user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.social_campaigns
  add column if not exists idempotency_key text;

create unique index if not exists social_campaigns_idempotency_idx
  on public.social_campaigns(user_id, idempotency_key)
  where idempotency_key is not null;

alter table public.social_planners
  add column if not exists next_run_at timestamptz,
  add column if not exists last_error text,
  add column if not exists timezone text not null default 'America/Sao_Paulo';

alter table public.social_publications
  add column if not exists social_queue_id uuid references public.social_queue(id) on delete set null;

create unique index if not exists social_publications_queue_target_idx
  on public.social_publications(social_queue_id, account_key)
  where social_queue_id is not null;

grant select, insert, update, delete on table
  public.social_templates,
  public.social_queue,
  public.social_planners,
  public.social_campaigns,
  public.social_campaign_items,
  public.social_traffic_events
to authenticated;
grant usage, select on sequence public.social_traffic_events_id_seq to authenticated;

drop function if exists public.claim_next_social_job();
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
  set status = 'processing',
      locked_at = now(),
      attempts = attempts + 1,
      updated_at = now()
  where id = picked.id
  returning * into picked;

  return next picked;
end;
$$;

revoke all on function public.claim_next_social_job(uuid) from public, anon, authenticated;
grant execute on function public.claim_next_social_job(uuid) to service_role;

-- Creates the campaign, queue rows and campaign items in one transaction.
create or replace function public.create_social_campaign_atomic(
  p_user_id uuid,
  p_campaign jsonb,
  p_items jsonb
)
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

  select * into campaign_row
  from public.social_campaigns
  where user_id = p_user_id
    and idempotency_key = nullif(p_campaign->>'idempotency_key', '')
  limit 1;

  if campaign_row.id is not null then
    return jsonb_build_object('campaign', to_jsonb(campaign_row), 'existing', true, 'created_count', 0);
  end if;

  insert into public.social_campaigns (
    user_id, article_id, name, source_type, base_url, preset,
    publish_wordpress, status, target_keys, utm_campaign, total_items,
    idempotency_key
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
      destination_url, utm_source, utm_medium, utm_campaign, utm_content,
      scheduled_at
    ) values (
      campaign_row.id, p_user_id, queue_row_id, item->>'target_key',
      item->>'platform', (item->>'variant')::integer,
      nullif(item->>'destination_url', ''), item->>'utm_source',
      'social', p_campaign->>'utm_campaign', nullif(item->>'utm_content', ''),
      (item->>'scheduled_at')::timestamptz
    );
    inserted_count := inserted_count + 1;
  end loop;

  return jsonb_build_object(
    'campaign', to_jsonb(campaign_row),
    'existing', false,
    'created_count', inserted_count
  );
end;
$$;

revoke all on function public.create_social_campaign_atomic(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_social_campaign_atomic(uuid, jsonb, jsonb) to service_role;
