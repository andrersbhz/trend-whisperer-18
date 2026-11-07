ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS ninerouter_endpoint text,
  ADD COLUMN IF NOT EXISTS ninerouter_api_key text,
  ADD COLUMN IF NOT EXISTS ninerouter_model text,
  ADD COLUMN IF NOT EXISTS ninerouter_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.encrypt_ninerouter_key()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE enc_key text;
BEGIN
  SELECT value INTO enc_key FROM public._internal_config WHERE key = 'encryption_key';
  IF enc_key IS NOT NULL AND enc_key <> '' AND NEW.ninerouter_api_key IS NOT NULL AND NEW.ninerouter_api_key <> ''
     AND left(NEW.ninerouter_api_key, 10) <> 'ENCRYPTED:' THEN
    NEW.ninerouter_api_key := 'ENCRYPTED:' || encode(extensions.pgp_sym_encrypt(NEW.ninerouter_api_key, enc_key), 'base64');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_encrypt_ninerouter_key ON public.user_settings;
CREATE TRIGGER trg_encrypt_ninerouter_key BEFORE INSERT OR UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.encrypt_ninerouter_key();

REVOKE SELECT (ninerouter_api_key) ON public.user_settings FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_ninerouter_status()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce((SELECT ninerouter_api_key IS NOT NULL AND ninerouter_api_key <> '' FROM public.user_settings WHERE user_id = auth.uid()), false)
$$;