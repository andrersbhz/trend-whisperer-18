
DROP POLICY IF EXISTS "Allow anon and auth to manage their own status" ON public.online_users;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='online_users' AND policyname='Public can view online users') THEN
    CREATE POLICY "Public can view online users" ON public.online_users FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;

REVOKE INSERT, UPDATE, DELETE ON public.online_users FROM anon, authenticated;
GRANT SELECT ON public.online_users TO anon, authenticated;
GRANT ALL ON public.online_users TO service_role;

DROP FUNCTION IF EXISTS public.get_online_locations(integer);
CREATE FUNCTION public.get_online_locations(p_minutes integer)
RETURNS TABLE(id uuid, longitude double precision, latitude double precision, country text, state text, city text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (user_id)
    u.id, u.longitude, u.latitude, u.country, u.state, u.city
  FROM public.online_users u
  WHERE u.last_seen > (now() - (p_minutes || ' minutes')::interval)
  ORDER BY user_id, last_seen DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.update_online_status(text, double precision, double precision, text, text, text);
CREATE FUNCTION public.update_online_status(
  p_user_id text, p_longitude double precision, p_latitude double precision,
  p_country text, p_state text, p_city text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.online_users (user_id, longitude, latitude, country, state, city, last_seen)
  VALUES (p_user_id, p_longitude, p_latitude, p_country, p_state, p_city, now())
  ON CONFLICT (id) DO UPDATE SET
    last_seen = now(),
    longitude = p_longitude,
    latitude = p_latitude,
    country = COALESCE(p_country, public.online_users.country),
    state = COALESCE(p_state, public.online_users.state),
    city = COALESCE(p_city, public.online_users.city);
END;
$$;

REVOKE ALL ON FUNCTION public.get_online_locations(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_online_status(text, double precision, double precision, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_online_locations(integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_online_status(text, double precision, double precision, text, text, text) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.encrypt_credential(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_credential(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.encrypt_facebook_credentials() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.encrypt_user_settings_credentials() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clean_old_trending_topics() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_data() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.encrypt_credential(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_credential(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_facebook_credentials() TO service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_user_settings_credentials() TO service_role;
GRANT EXECUTE ON FUNCTION public.clean_old_trending_topics() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_data() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_credentials_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_credentials_status() TO authenticated, service_role;
