
-- Revoke broad execute privileges from all SECURITY DEFINER functions, then re-grant only those that must be callable from the client.

REVOKE ALL ON FUNCTION public.encrypt_credential(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_credential(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_facebook_credentials() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.encrypt_user_settings_credentials() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_author_by_category() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clean_old_trending_topics() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_expired_data() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_credentials_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_online_status(text, double precision, double precision, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_online_locations(integer) FROM PUBLIC;

-- Re-grant only the RPCs the app actually calls from the browser.
GRANT EXECUTE ON FUNCTION public.get_credentials_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_online_status(text, double precision, double precision, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_online_locations(integer) TO anon, authenticated;
