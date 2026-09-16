CREATE TABLE IF NOT EXISTS public.threads_app_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id text NOT NULL,
  app_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.threads_app_credentials TO authenticated;
GRANT ALL ON public.threads_app_credentials TO service_role;

ALTER TABLE public.threads_app_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "threads_app_credentials_own" ON public.threads_app_credentials;
CREATE POLICY "threads_app_credentials_own"
ON public.threads_app_credentials FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.encrypt_threads_app_secret()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.app_secret IS NOT NULL AND NEW.app_secret NOT LIKE 'ENCRYPTED:%' THEN
    NEW.app_secret := public.encrypt_credential(NEW.app_secret);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_encrypt_threads_app_secret ON public.threads_app_credentials;
CREATE TRIGGER trg_encrypt_threads_app_secret
BEFORE INSERT OR UPDATE ON public.threads_app_credentials
FOR EACH ROW EXECUTE FUNCTION public.encrypt_threads_app_secret();