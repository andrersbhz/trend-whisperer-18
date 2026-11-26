CREATE OR REPLACE FUNCTION public.dispatch_article_automation(p_url text,p_bearer text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j record; v_secret text; v_count integer := 0;
BEGIN
 SELECT value INTO v_secret FROM public._internal_config WHERE key='cron_secret';
 IF v_secret IS NULL OR length(v_secret)<32 THEN RAISE EXCEPTION 'Agendador não configurado'; END IF;
 UPDATE public.article_automation_jobs SET status='paused', pause_reason='A execução perdeu a confirmação. Confira o resultado antes de retomar.', outcome_unknown=true, lease_token=NULL, lease_expires_at=NULL, updated_at=now() WHERE status='running' AND lease_expires_at<now();
 FOR j IN SELECT id FROM public.article_automation_jobs WHERE status='pending' AND available_at<=now() ORDER BY updated_at,created_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
  PERFORM net.http_post(url:=p_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||p_bearer,'x-cron-secret',v_secret),body:=jsonb_build_object('jobId',j.id),timeout_milliseconds:=125000);
  v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION public.dispatch_article_automation(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_article_automation(text,text) TO service_role;