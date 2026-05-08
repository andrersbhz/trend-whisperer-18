-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Create table for Facebook OAuth states if it doesn't exist
CREATE TABLE IF NOT EXISTS public.facebook_oauth_states (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    state TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '1 hour')
);

-- Enable RLS
ALTER TABLE public.facebook_oauth_states ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (needed for Edge Functions)
-- No user-level policies needed as this is managed by service_role in the function
