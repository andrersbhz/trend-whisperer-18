CREATE FUNCTION public.dispatch_article_automation_hop(p_id uuid,p_url text,p_bearer text,p_hops integer) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_secret text;
BEGIN
 IF p_hops<0 OR p_hops>6 THEN RAISE EXCEPTION 'Limite de etapas inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.article_automation_jobs WHERE id=p_id AND status='pending' AND available_at<=now()) THEN RETURN false; END IF;
 SELECT value INTO v_secret FROM public._internal_config WHERE key='cron_secret';
 IF v_secret IS NULL OR length(v_secret)<32 THEN RAISE EXCEPTION 'Agendador não configurado'; END IF;
 PERFORM net.http_post(url:=p_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||p_bearer,'x-cron-secret',v_secret),body:=jsonb_build_object('jobId',p_id,'remainingHops',p_hops),timeout_milliseconds:=125000);
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_article_automation_hop(uuid,text,text,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_article_automation_hop(uuid,text,text,integer) TO service_role;