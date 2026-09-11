-- 1) Remove SECURITY DEFINER view, replace with an explicit access-checked function
DROP VIEW IF EXISTS public.nexa_profiles_public;

CREATE OR REPLACE FUNCTION public.nexa_org_member_profiles(_org_id uuid)
RETURNS TABLE (id uuid, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM public.nexa_profiles p
  WHERE public.nexa_is_org_member(auth.uid(), _org_id)
    AND EXISTS (
      SELECT 1 FROM public.nexa_organization_members t
      WHERE t.organization_id = _org_id AND t.user_id = p.id
    );
$$;

REVOKE ALL ON FUNCTION public.nexa_org_member_profiles(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nexa_org_member_profiles(uuid) TO authenticated;

-- 2) authors: anon must never reach user_id and must not write
REVOKE ALL ON public.authors FROM anon;
GRANT SELECT (id, name, avatar_url, bio, role, category, created_at, updated_at)
  ON public.authors TO anon;
