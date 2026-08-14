import { useState, useEffect, createContext, useContext, useCallback } from 'react';
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

  const finishAuthLoading = useCallback(async (nextSession: Session | null) => {
    console.log('[useAuth] Finishing auth loading with session:', !!nextSession);
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
    
    // Pequeno delay para garantir que o Preloader chegue a 100% visualmente
    setTimeout(() => {
      setLoading(false);
    }, 800);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let authInitialized = false;

    const initializeAuth = async () => {
      if (authInitialized) return;
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (isMounted) {
          authInitialized = true;
          await finishAuthLoading(currentSession);
        }
      } catch (err: any) {
        console.error('[useAuth] Init error:', err);
        // Se for erro de lock, não desistimos imediatamente
        if (err.message?.includes('lock') || err.message?.includes('stole')) {
           console.warn('[useAuth] Lock error during init, waiting for event...');
           return; 
        }
        if (isMounted) await finishAuthLoading(null);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('[useAuth] Auth state changed:', _event, !!session);
      
      // Se já inicializamos e é apenas um refresh, atualizamos sem travar
      if (authInitialized && (_event === 'TOKEN_REFRESHED' || _event === 'INITIAL_SESSION')) {
        if (isMounted) {
          setSession(session);
          setUser(session?.user ?? null);
        }
        return;
      }

      if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED' || _event === 'INITIAL_SESSION') {
        if (isMounted) {
          authInitialized = true;
          await finishAuthLoading(session);
        }
      } else if (_event === 'SIGNED_OUT') {
        if (isMounted) {
          setUser(null);
          setSession(null);
          setIsAdmin(false);
          setLoading(false);
        }
      }
    });

    initializeAuth();

    const timeoutId = window.setTimeout(() => {
      if (isMounted && loading) {
        console.warn('[useAuth] Safety timeout: forcing loading false');
        setLoading(false);
      }
    }, 5000);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [finishAuthLoading]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
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
    return {
      user: null,
      session: null,
      loading: true, // Se o contexto não existe, ainda estamos inicializando o provider
      isAdmin: false,
      signIn: async () => {},
      signUp: async () => {},
      signOut: async () => {},
    };
  }
  return context;
};