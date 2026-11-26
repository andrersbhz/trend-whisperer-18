DROP INDEX public.article_automation_one_active_user;
CREATE UNIQUE INDEX article_automation_one_active_lane ON public.article_automation_jobs(user_id,(CASE WHEN stage IN ('publish','trends') THEN 'publish' ELSE 'generate' END)) WHERE status IN ('pending','running','paused');
CREATE OR REPLACE FUNCTION public.enqueue_article_automation(p_user uuid,p_origin text DEFAULT 'scheduled',p_payload jsonb DEFAULT '{}'::jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,7));
 SELECT id INTO v_id FROM public.article_automation_jobs WHERE user_id=p_user AND status IN ('pending','running','paused') AND (CASE WHEN p_origin='scheduled' THEN stage IN ('publish','trends') ELSE stage NOT IN ('publish','trends') END);
 IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 INSERT INTO public.article_automation_jobs(user_id,origin,stage,payload) VALUES(p_user,p_origin,CASE WHEN p_origin='scheduled' THEN 'publish' ELSE 'research' END,p_payload) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_article_automation(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_article_automation(uuid,text,jsonb) TO service_role;