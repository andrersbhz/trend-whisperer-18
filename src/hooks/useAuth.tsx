import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const finishAuthLoading = async (nextSession: Session | null) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      
      if (nextSession?.user) {
        try {
          const { data } = await supabase.from('user_roles').select('role').eq('user_id', nextSession.user.id).eq('role', 'admin').maybeSingle();
          setIsAdmin(!!data);
        } catch (err) {
          console.error('[useAuth] Admin check error:', err);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      
      setLoading(false);
    };

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[useAuth] Auth state changed:', _event, !!session);
      if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED' || _event === 'INITIAL_SESSION') {
        await finishAuthLoading(session);
      } else if (_event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        setIsAdmin(false);
        setLoading(false);
      }
    });

    // Manual override to skip waiting
    const handleSkipWait = () => {
      console.log('[useAuth] Manual skip wait triggered');
      setLoading(false);
    };
    window.addEventListener('auth-skip-wait', handleSkipWait);

    // Timeout safety - if initialization hangs, force loading false
    const timeoutId = window.setTimeout(async () => {
      if (loading) {
        console.warn('[useAuth] Auth timeout reached, forcing loading state to false');
        if (isMounted) {
          setLoading(false);
        }
      }
    }, 5000); // Reduced to 5s for even faster recovery

    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('[useAuth] Session error:', error);
          if (isMounted) await finishAuthLoading(null);
          return;
        }

        if (isMounted) {
          if (data.session) {
            console.log('[useAuth] Session found on init');
            await finishAuthLoading(data.session);
          } else {
            console.log('[useAuth] No session on init');
            await finishAuthLoading(null);
          }
        }
      } catch (err) {
        console.error('[useAuth] Init error:', err);
        if (isMounted) await finishAuthLoading(null);
      } finally {
        if (isMounted) window.clearTimeout(timeoutId);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      window.removeEventListener('auth-skip-wait', handleSkipWait);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Return a safe default instead of throwing to prevent blank screens
    // during HMR or rendering edge cases
    console.warn('useAuth called outside AuthProvider — returning default state');
    return {
      user: null,
      session: null,
      loading: false,
      isAdmin: false,
      signIn: async () => { throw new Error('AuthProvider not mounted'); },
      signUp: async () => { throw new Error('AuthProvider not mounted'); },
      signOut: async () => { throw new Error('AuthProvider not mounted'); },
    };
  }
  return context;
};
