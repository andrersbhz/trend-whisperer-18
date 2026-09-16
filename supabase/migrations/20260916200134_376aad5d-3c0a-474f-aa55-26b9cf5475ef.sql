ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS writer_profile text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS writer_prompt_strict boolean NOT NULL DEFAULT false;

GRANT SELECT (writer_profile, writer_prompt_strict) ON public.user_settings TO authenticated;
GRANT UPDATE (writer_profile, writer_prompt_strict) ON public.user_settings TO authenticated;
GRANT INSERT (writer_profile, writer_prompt_strict) ON public.user_settings TO authenticated;