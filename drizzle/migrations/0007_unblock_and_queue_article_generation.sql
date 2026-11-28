DROP INDEX public.article_automation_one_active_lane;
CREATE UNIQUE INDEX article_automation_one_running_lane ON public.article_automation_jobs(user_id,(CASE WHEN stage IN ('publish','trends') THEN 'publish' ELSE 'generate' END)) WHERE status='running';

CREATE OR REPLACE FUNCTION public.enqueue_article_automation(p_user uuid,p_origin text DEFAULT 'scheduled',p_payload jsonb DEFAULT '{}'::jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,7));
 IF p_origin='scheduled' THEN
  SELECT id INTO v_id FROM public.article_automation_jobs WHERE user_id=p_user AND status IN ('pending','running','paused') AND stage IN ('publish','trends') ORDER BY created_at LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 END IF;
 INSERT INTO public.article_automation_jobs(user_id,origin,stage,payload) VALUES(p_user,p_origin,CASE WHEN p_origin='scheduled' THEN 'publish' ELSE 'research' END,p_payload) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_article_automation(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_article_automation(uuid,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_article_automation(p_id uuid) RETURNS SETOF public.article_automation_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.article_automation_jobs SET status='paused', pause_reason='A execução anterior perdeu a confirmação. Confira o resultado antes de retomar.', outcome_unknown=true, lease_token=NULL, lease_expires_at=NULL, updated_at=now() WHERE id=p_id AND status='running' AND lease_expires_at<now();
 RETURN QUERY UPDATE public.article_automation_jobs AS candidate SET status='running',lease_token=gen_random_uuid(),lease_expires_at=now()+interval '130 seconds',updated_at=now()
 WHERE candidate.id=p_id AND candidate.status='pending' AND candidate.available_at<=now()
 AND NOT EXISTS(
  SELECT 1 FROM public.article_automation_jobs AS other
  WHERE other.user_id=candidate.user_id AND other.id<>candidate.id AND other.status='running'
  AND (CASE WHEN other.stage IN ('publish','trends') THEN 'publish' ELSE 'generate' END)=(CASE WHEN candidate.stage IN ('publish','trends') THEN 'publish' ELSE 'generate' END)
 ) RETURNING candidate.*;
END $$;
REVOKE ALL ON FUNCTION public.claim_article_automation(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_article_automation(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.resume_article_automation(p_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.article_automation_jobs SET status='pending',pause_reason=NULL,outcome_unknown=false,available_at=now(),updated_at=now() WHERE id=p_id AND user_id=auth.uid() AND status='paused';
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.resume_article_automation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resume_article_automation(uuid) TO authenticated;