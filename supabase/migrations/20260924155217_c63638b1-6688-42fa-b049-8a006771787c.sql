SELECT cron.unschedule('auto-pipeline-every-minute');
DROP INDEX IF EXISTS public.idx_trending_topics_user;
DROP INDEX IF EXISTS public.idx_trending_topics_user_id;