ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_status_check;
ALTER TABLE public.articles ADD CONSTRAINT articles_status_check CHECK (status = ANY (ARRAY['draft'::text,'generating'::text,'no_image'::text,'ready'::text,'publishing'::text,'published'::text,'failed'::text]));

CREATE OR REPLACE FUNCTION public.enforce_article_image_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_image boolean;
  auto_pub boolean;
BEGIN
  has_image := NEW.featured_image_url IS NOT NULL AND btrim(NEW.featured_image_url) <> '';

  IF NEW.status IN ('published', 'publishing') THEN
    RETURN NEW;
  END IF;

  IF NOT has_image THEN
    NEW.status := 'no_image';
    NEW.is_approved := false;
    RETURN NEW;
  END IF;

  IF NEW.status = 'no_image' THEN
    SELECT COALESCE(us.auto_publish, false) INTO auto_pub
    FROM public.user_settings us
    WHERE us.user_id = NEW.user_id
    LIMIT 1;

    IF COALESCE(auto_pub, false) THEN
      NEW.status := 'ready';
      NEW.is_approved := true;
    ELSE
      NEW.status := 'draft';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_article_image_gate ON public.articles;
CREATE TRIGGER trg_enforce_article_image_gate
BEFORE INSERT OR UPDATE ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.enforce_article_image_gate();

UPDATE public.articles
SET status = 'no_image', is_approved = false
WHERE status NOT IN ('published', 'publishing')
  AND (featured_image_url IS NULL OR btrim(featured_image_url) = '');