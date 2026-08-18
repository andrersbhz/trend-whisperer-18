alter table if exists public.threads_accounts
  add column if not exists last_metrics jsonb,
  add column if not exists metrics_updated_at timestamptz;

comment on column public.threads_accounts.last_metrics is 'Latest Threads API metrics snapshot for the connected account.';
comment on column public.threads_accounts.metrics_updated_at is 'Timestamp of the latest successful Threads metrics refresh.';
