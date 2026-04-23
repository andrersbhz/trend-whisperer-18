-- Alter table to add research and verification columns
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS fact_check_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS fact_check_notes TEXT,
ADD COLUMN IF NOT EXISTS research_references JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS seo_audit_log JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS source_urls TEXT[];

-- Update comment for clarity
COMMENT ON COLUMN public.articles.fact_check_status IS 'Status da verificação de fatos: pending, safe, warning, review';
COMMENT ON COLUMN public.articles.research_references IS 'Lista de manchetes e links usados como referência de pesquisa';
COMMENT ON COLUMN public.articles.seo_audit_log IS 'Log da auditoria automática de SEO realizada antes da publicação';