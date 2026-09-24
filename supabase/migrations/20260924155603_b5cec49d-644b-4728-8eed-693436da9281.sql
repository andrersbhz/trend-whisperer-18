REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, email, whatsapp, avatar_url) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_user_plan(
  p_user_id uuid,
  p_plan public.subscription_plan,
  p_blog_limit integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_blog_limit NOT IN (1, 10, 50) OR
     (p_plan = 'basico' AND p_blog_limit <> 1) OR
     (p_plan = 'avancado' AND p_blog_limit <> 10) OR
     (p_plan = 'enterprise' AND p_blog_limit <> 50) THEN
    RAISE EXCEPTION 'Plano ou limite inválido';
  END IF;
  UPDATE public.profiles
  SET subscription_plan = p_plan, blog_limit = p_blog_limit
  WHERE id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_update_user_plan(uuid, public.subscription_plan, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_plan(uuid, public.subscription_plan, integer) TO authenticated, service_role;

DROP POLICY IF EXISTS "Public can read safe author columns" ON public.authors;
CREATE POLICY "Public can read authors of published articles"
ON public.authors FOR SELECT TO anon
USING (EXISTS (
  SELECT 1 FROM public.articles a
  WHERE a.author_id = authors.id AND a.status = 'published'
));

DROP POLICY IF EXISTS "public read platform settings" ON public.platform_settings;
CREATE POLICY "public read active platform settings"
ON public.platform_settings FOR SELECT TO anon, authenticated
USING (singleton IS TRUE);
REVOKE SELECT ON public.platform_settings FROM anon;
GRANT SELECT (
  id, singleton, brand_name, brand_short, tagline, description, logo_url, favicon_url,
  hero_video_url, primary_color, accent_color, contact_email, cta_primary, cta_secondary,
  offer_badge, footer_text, updated_at, plans_json, button_radius, button_hover_style,
  font_color_base, font_color_muted, hero_image_url, hero_title_color, hero_title_size,
  hero_description_color, hero_description_size, hero_link_url, hero_link_label,
  hero_button_bg_color, hero_button_text_color, google_site_verification, theme_json
) ON public.platform_settings TO anon;

DROP POLICY IF EXISTS "brand assets public read" ON storage.objects;
CREATE POLICY "brand assets referenced public read"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'brand-assets'
  AND EXISTS (
    SELECT 1 FROM public.platform_settings ps
    WHERE ps.singleton IS TRUE
      AND (ps.logo_url LIKE '%' || storage.objects.name OR ps.favicon_url LIKE '%' || storage.objects.name OR ps.hero_image_url LIKE '%' || storage.objects.name)
  )
);
CREATE POLICY "brand assets owner read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'brand-assets' AND owner_id = auth.uid()::text);

DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public can view article images" ON storage.objects;
CREATE POLICY "published article images public read"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'article-images'
  AND EXISTS (
    SELECT 1 FROM public.articles a
    WHERE a.status = 'published'
      AND a.featured_image_url LIKE '%' || storage.objects.name
  )
);
CREATE POLICY "article image owner read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'article-images'
  AND (
    owner_id = auth.uid()::text
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
CREATE POLICY "Users upload own article images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'article-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND owner_id = auth.uid()::text
);