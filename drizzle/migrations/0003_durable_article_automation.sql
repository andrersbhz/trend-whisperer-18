CREATE TABLE public.article_automation_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
 origin text NOT NULL DEFAULT 'scheduled' CHECK (origin IN ('scheduled','manual','validation')),
 stage text NOT NULL DEFAULT 'publish' CHECK (stage IN ('publish','trends','research','text','save','image','done')),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','paused','completed')),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb, checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
 article_id uuid, lease_token uuid, lease_expires_at timestamptz,
 available_at timestamptz NOT NULL DEFAULT now(), pause_reason text, outcome_unknown boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.article_automation_jobs TO authenticated;
GRANT ALL ON public.article_automation_jobs TO service_role;
ALTER TABLE public.article_automation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read automation progress" ON public.article_automation_jobs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE UNIQUE INDEX article_automation_one_active_user ON public.article_automation_jobs(user_id) WHERE status IN ('pending','running','paused');
CREATE INDEX article_automation_due ON public.article_automation_jobs(available_at, updated_at) WHERE status = 'pending';

CREATE FUNCTION public.enqueue_article_automation(p_user uuid, p_origin text DEFAULT 'scheduled', p_payload jsonb DEFAULT '{}'::jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text, 7));
 SELECT id INTO v_id FROM public.article_automation_jobs WHERE user_id = p_user AND status IN ('pending','running','paused');
 IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 INSERT INTO public.article_automation_jobs(user_id, origin, stage, payload) VALUES(p_user,p_origin,CASE WHEN p_origin = 'scheduled' THEN 'publish' ELSE 'research' END,p_payload) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_article_automation(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_article_automation(uuid,text,jsonb) TO service_role;

CREATE FUNCTION public.claim_article_automation(p_id uuid) RETURNS SETOF public.article_automation_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 UPDATE public.article_automation_jobs SET status='paused', pause_reason='A execução anterior perdeu a confirmação. Confira o resultado antes de retomar.', outcome_unknown=true, lease_token=NULL, lease_expires_at=NULL, updated_at=now() WHERE id=p_id AND status='running' AND lease_expires_at < now();
 RETURN QUERY UPDATE public.article_automation_jobs SET status='running', lease_token=gen_random_uuid(), lease_expires_at=now()+interval '130 seconds', updated_at=now() WHERE id=p_id AND status='pending' AND available_at<=now() RETURNING *;
END $$;
REVOKE ALL ON FUNCTION public.claim_article_automation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_article_automation(uuid) TO service_role;

CREATE FUNCTION public.advance_article_automation(p_id uuid,p_lease uuid,p_stage text,p_checkpoint jsonb,p_article uuid DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 UPDATE public.article_automation_jobs SET stage=p_stage, checkpoint=p_checkpoint, article_id=COALESCE(p_article,article_id), status=CASE WHEN p_stage='done' THEN 'completed' ELSE 'pending' END, available_at=now()+interval '10 seconds', lease_token=NULL, lease_expires_at=NULL, updated_at=now() WHERE id=p_id AND status='running' AND lease_token=p_lease AND lease_expires_at>now();
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.advance_article_automation(uuid,uuid,text,jsonb,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.advance_article_automation(uuid,uuid,text,jsonb,uuid) TO service_role;

CREATE FUNCTION public.save_automation_article(p_id uuid,p_lease uuid,p_article jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j public.article_automation_jobs; a public.articles;
BEGIN
 SELECT * INTO j FROM public.article_automation_jobs WHERE id=p_id FOR UPDATE;
 IF j.article_id IS NOT NULL THEN RETURN j.article_id; END IF;
 IF j.status<>'running' OR j.lease_token IS DISTINCT FROM p_lease OR j.lease_expires_at<=now() OR j.stage<>'save' THEN RAISE EXCEPTION 'Lease inválida'; END IF;
 IF (p_article->>'user_id')::uuid IS DISTINCT FROM j.user_id THEN RAISE EXCEPTION 'Usuário inválido'; END IF;
 SELECT * INTO a FROM jsonb_populate_record(NULL::public.articles,p_article);
 INSERT INTO public.articles(id,user_id,title,content,excerpt,category,seo_keyword,focus_keyword,seo_title,meta_title,meta_description,slug,featured_image_url,status,is_approved,scheduled_at,trending_topic,trend_score,ai_provider,visual_elements,image_alt,image_caption,image_verification_status,fact_check_status,fact_check_notes,research_references,entity_verification,source_urls,seo_audit_log,pipeline_log)
 VALUES(gen_random_uuid(),a.user_id,a.title,a.content,a.excerpt,a.category,a.seo_keyword,a.focus_keyword,a.seo_title,a.meta_title,a.meta_description,a.slug,a.featured_image_url,a.status,a.is_approved,a.scheduled_at,a.trending_topic,a.trend_score,a.ai_provider,a.visual_elements,a.image_alt,a.image_caption,a.image_verification_status,a.fact_check_status,a.fact_check_notes,a.research_references,a.entity_verification,a.source_urls,a.seo_audit_log,a.pipeline_log) RETURNING id INTO a.id;
 UPDATE public.article_automation_jobs SET article_id=a.id,stage=CASE WHEN checkpoint->>'imageMode'='ai' THEN 'image' ELSE 'done' END,status=CASE WHEN checkpoint->>'imageMode'='ai' THEN 'pending' ELSE 'completed' END,available_at=now()+interval '10 seconds',lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=p_id;
 RETURN a.id;
END $$;
REVOKE ALL ON FUNCTION public.save_automation_article(uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_automation_article(uuid,uuid,jsonb) TO service_role;

CREATE FUNCTION public.dispatch_article_automation(p_url text,p_bearer text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j record; v_secret text; v_count integer := 0;
BEGIN
 SELECT value INTO v_secret FROM public._internal_config WHERE key='cron_secret';
 IF v_secret IS NULL OR length(v_secret)<32 THEN RAISE EXCEPTION 'Agendador não configurado'; END IF;
 UPDATE public.article_automation_jobs SET status='paused', pause_reason='A execução perdeu a confirmação. Confira o resultado antes de retomar.', outcome_unknown=true, lease_token=NULL, lease_expires_at=NULL, updated_at=now() WHERE status='running' AND lease_expires_at<now();
 FOR j IN SELECT id FROM public.article_automation_jobs WHERE status='pending' AND available_at<=now() ORDER BY updated_at,created_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
  PERFORM net.http_post(url:=p_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||p_bearer,'x-cron-secret',v_secret),body:=jsonb_build_object('jobId',j.id),timeout_milliseconds:=125000);
  UPDATE public.article_automation_jobs SET available_at=now()+interval '2 minutes' WHERE id=j.id;
  v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_article_automation(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_article_automation(text,text) TO service_role;

CREATE FUNCTION public.resume_article_automation(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.article_automation_jobs SET status='pending',pause_reason=NULL,outcome_unknown=false,available_at=now(),updated_at=now() WHERE id=p_id AND user_id=auth.uid() AND status='paused' AND NOT outcome_unknown;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.resume_article_automation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resume_article_automation(uuid) TO authenticated;
