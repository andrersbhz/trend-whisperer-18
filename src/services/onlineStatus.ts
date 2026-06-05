import { supabase } from "@/integrations/supabase/client";

/**
 * Interface for online users stored in the database
 */
export interface OnlineUser {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  country: string;
  state?: string;
  city?: string;
}

/**
 * Fetches the current online users from Supabase.
 * Filters for users active in the last 5 minutes.
 */
export const fetchOnlineUsers = async (): Promise<OnlineUser[]> => {
  try {
    const { data, error } = await supabase.rpc('get_online_locations', { p_minutes: 5 });
    
    if (error) {
      console.error('Error fetching online locations:', error);
      return [];
    }

    return (data || []).map((user: any) => ({
      id: user.id,
      coordinates: [user.longitude, user.latitude],
      country: user.country || 'Unknown',
      state: user.state,
      city: user.city
    }));
  } catch (err) {
    console.error('Unexpected error fetching online users:', err);
    return [];
  }
};

/**
 * Updates the current user's online status.
 * Uses IP-based geolocation or browser geolocation if available.
 */
export const updateCurrentOnlineStatus = async () => {
  try {
    // We'll use a public API to get the user's IP-based location for simplicity
    // and because it's more "real" than hardcoded data.
    const response = await fetch('https://ipapi.co/json/');
    const geoData = await response.json();

    if (geoData.error) {
      console.warn('IP Geolocation error:', geoData.reason);
      return;
    }

    const { latitude, longitude, country_name, region, city } = geoData;

    // Use a unique session ID stored in localStorage or generated now
    let sessionId = localStorage.getItem('vortex_session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('vortex_session_id', sessionId);
    }

    await supabase.rpc('update_online_status', {
      p_user_id: sessionId,
      p_longitude: longitude,
      p_latitude: latitude,
      p_country: country_name,
      p_state: region,
      p_city: city
    });
  } catch (err) {
    console.error('Error updating online status:', err);
  }
};
