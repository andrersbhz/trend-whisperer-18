-- Table to track online users and their locations
CREATE TABLE IF NOT EXISTS public.online_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT, -- Can be a session ID or actual user ID
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  longitude FLOAT8 NOT NULL,
  latitude FLOAT8 NOT NULL,
  country TEXT,
  state TEXT,
  city TEXT
);

-- Index for performance on time-based queries
CREATE INDEX IF NOT EXISTS idx_online_users_last_seen ON public.online_users (last_seen);

-- Enable RLS
ALTER TABLE public.online_users ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert/update their status (anon and authenticated)
-- In a real app, you might want more restrictions, but for a global map we need the data
GRANT INSERT, UPDATE, SELECT ON public.online_users TO anon, authenticated;
GRANT ALL ON public.online_users TO service_role;

-- Policy to allow inserting and updating
CREATE POLICY "Allow anon and auth to manage their own status" 
ON public.online_users 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Function to update online status
CREATE OR REPLACE FUNCTION public.update_online_status(
  p_user_id TEXT,
  p_longitude FLOAT8,
  p_latitude FLOAT8,
  p_country TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.online_users (user_id, longitude, latitude, country, state, city, last_seen)
  VALUES (p_user_id, p_longitude, p_latitude, p_country, p_state, p_city, now())
  ON CONFLICT (id) DO UPDATE SET
    last_seen = now(),
    longitude = p_longitude,
    latitude = p_latitude,
    country = COALESCE(p_country, public.online_users.country),
    state = COALESCE(p_state, public.online_users.state),
    city = COALESCE(p_city, public.online_users.city);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get online locations (unique users in the last 5 minutes)
CREATE OR REPLACE FUNCTION public.get_online_locations(p_minutes INT DEFAULT 5)
RETURNS TABLE (
  id UUID,
  longitude FLOAT8,
  latitude FLOAT8,
  country TEXT,
  state TEXT,
  city TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ON (user_id)
    u.id, u.longitude, u.latitude, u.country, u.state, u.city
  FROM public.online_users u
  WHERE u.last_seen > (now() - (p_minutes || ' minutes')::interval)
  ORDER BY user_id, last_seen DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
