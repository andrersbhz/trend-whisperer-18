CREATE OR REPLACE FUNCTION public.enqueue_article_automation(p_user uuid,p_origin text DEFAULT 'scheduled',p_payload jsonb DEFAULT '{}'::jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,7));
 IF p_origin='scheduled' THEN
  SELECT id INTO v_id FROM public.article_automation_jobs WHERE user_id=p_user AND status IN ('pending','running','paused') AND stage IN ('publish','trends') AND (status<>'paused' OR NOT outcome_unknown) ORDER BY created_at LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
 END IF;
 INSERT INTO public.article_automation_jobs(user_id,origin,stage,payload) VALUES(p_user,p_origin,CASE WHEN p_origin='scheduled' THEN 'publish' ELSE 'research' END,p_payload) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_article_automation(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_article_automation(uuid,text,jsonb) TO service_role;