import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let hasResolvedInitialSession = false;

    const finishAuthLoading = (nextSession: Session | null) => {
      if (!isMounted) return;
      hasResolvedInitialSession = true;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    };

    const timeoutId = window.setTimeout(() => {
      if (!hasResolvedInitialSession) {
        console.warn('[useAuth] Auth timeout reached, forcing loading state to false');
        finishAuthLoading(null);
      }
    }, 3500);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (import.meta.env.DEV) console.log('[useAuth] Auth state changed:', _event);
      finishAuthLoading(session);
    });

    const initializeAuth = async () => {
      try {
        // Optimized check: getSession is faster than full user load initially
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[useAuth] Session error:', error);
          await supabase.auth.signOut({ scope: 'local' });
          finishAuthLoading(null);
          return;
        }

        if (data.session) {
          finishAuthLoading(data.session);
        } else {
          // If no session found quickly, don't wait forever
          finishAuthLoading(null);
        }
      } catch (err) {
        console.error('[useAuth] Init error:', err);
        finishAuthLoading(null);
      } finally {
        window.clearTimeout(timeoutId);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
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
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
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
      signIn: async () => { throw new Error('AuthProvider not mounted'); },
      signUp: async () => { throw new Error('AuthProvider not mounted'); },
      signOut: async () => { throw new Error('AuthProvider not mounted'); },
    };
  }
  return context;
};
