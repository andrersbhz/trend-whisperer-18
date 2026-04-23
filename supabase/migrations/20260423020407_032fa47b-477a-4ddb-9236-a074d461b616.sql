-- Drop the facebook_accounts table
DROP TABLE IF EXISTS public.facebook_accounts;

-- Remove columns from user_settings
ALTER TABLE public.user_settings 
DROP COLUMN IF EXISTS facebook_page_id,
DROP COLUMN IF EXISTS facebook_access_token,
DROP COLUMN IF EXISTS instagram_account_id;

-- Drop and recreate get_credentials_status function
DROP FUNCTION IF EXISTS public.get_credentials_status();

CREATE OR REPLACE FUNCTION public.get_credentials_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    res jsonb;
    uid uuid := auth.uid();
BEGIN
    SELECT jsonb_build_object(
        'has_wp_password', (wordpress_app_password IS NOT NULL AND wordpress_app_password != ''),
        'has_gemini_key', (gemini_api_key IS NOT NULL AND gemini_api_key != ''),
        'has_openai_key', (openai_api_key IS NOT NULL AND openai_api_key != ''),
        'has_groq_key', (groq_api_key IS NOT NULL AND groq_api_key != '')
    ) INTO res
    FROM user_settings
    WHERE user_id = uid;

    RETURN COALESCE(res, jsonb_build_object(
        'has_wp_password', false,
        'has_gemini_key', false,
        'has_openai_key', false,
        'has_groq_key', false
    ));
END;
$$;