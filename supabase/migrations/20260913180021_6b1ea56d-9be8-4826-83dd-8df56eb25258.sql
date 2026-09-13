ALTER TABLE public.trending_topics
  ADD COLUMN IF NOT EXISTS trend_score numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS growth text,
  ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS seo_potential integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discover_potential integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS entity_verification jsonb,
  ADD COLUMN IF NOT EXISTS image_verification_status text,
  ADD COLUMN IF NOT EXISTS pipeline_log jsonb,
  ADD COLUMN IF NOT EXISTS trend_score numeric;

CREATE INDEX IF NOT EXISTS idx_trending_topics_score ON public.trending_topics (user_id, used, trend_score DESC);