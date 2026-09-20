-- Required Vault secrets (created during production deployment):
--   autopostwp_project_url  -> https://<project-ref>.supabase.co
--   autopostwp_anon_key     -> project legacy anon JWT

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'autopostwp_project_url')
     or not exists (select 1 from vault.decrypted_secrets where name = 'autopostwp_anon_key') then
    raise exception 'Create Vault secrets autopostwp_project_url and autopostwp_anon_key before applying this migration';
  end if;
end;
$$;

select cron.schedule(
  'autopostwp-process-social-queue',
  '* * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'autopostwp_project_url') || '/functions/v1/process-social-queue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'autopostwp_anon_key'),
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'autopostwp_anon_key')
      ),
      body := '{"limit": 10}'::jsonb,
      timeout_milliseconds := 50000
    );
  $cron$
);

select cron.schedule(
  'autopostwp-process-social-planners',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'autopostwp_project_url') || '/functions/v1/process-social-planners',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'autopostwp_anon_key'),
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'autopostwp_anon_key')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 50000
    );
  $cron$
);
