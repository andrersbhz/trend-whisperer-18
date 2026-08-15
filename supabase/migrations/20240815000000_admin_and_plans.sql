-- Create an enum for subscription plans if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_plan') THEN
        CREATE TYPE public.subscription_plan AS ENUM ('basico', 'avancado', 'enterprise');
    END IF;
END $$;

-- Add subscription_plan and blog_limit to profiles (or use a separate table if preferred, but profiles is simpler for now)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_plan public.subscription_plan DEFAULT 'basico',
ADD COLUMN IF NOT EXISTS blog_limit INTEGER DEFAULT 1;

-- Update blog_limit based on plan requirements
UPDATE public.profiles SET blog_limit = 1 WHERE subscription_plan = 'basico';
UPDATE public.profiles SET blog_limit = 10 WHERE subscription_plan = 'avancado';
UPDATE public.profiles SET blog_limit = 50 WHERE subscription_plan = 'enterprise';

-- Ensure the admin user exists and has the admin role
-- We need to check for andrers.bhz@gmail.com in auth.users
-- This part is usually handled via an Edge Function or manual insert since we can't easily query auth.users here,
-- but we can ensure the public.user_roles entry is there if the ID is known.
-- As a safeguard, we'll create a function that the admin can call or that runs on login.

-- Grant permissions for admin to see all profiles and blogs
CREATE OR REPLACE FUNCTION public.get_all_users_admin()
RETURNS TABLE (
    id UUID,
    email TEXT,
    subscription_plan public.subscription_plan,
    blog_limit INTEGER,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;
    
    RETURN QUERY 
    SELECT p.id, u.email::TEXT, p.subscription_plan, p.blog_limit, u.created_at
    FROM public.profiles p
    JOIN auth.users u ON p.id = u.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_admin() TO authenticated;
