import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Newspaper, Sparkles, Loader2 } from 'lucide-react';
import { lovable } from '@/integrations/lovable/index';
import { Separator } from '@/components/ui/separator';
import SpaceBackground from '@/components/SpaceBackground';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
        navigate('/admin', { replace: true });
      } else {
        await signUp(email, password);
        toast({ title: 'Conta criada!', description: 'Verifique seu email para confirmar.' });
        setIsLogin(true);
        return;
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      console.log('[Auth] Starting Google sign in with origin:', window.location.origin);
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      
      console.log('[Auth] Google sign in result:', result);
      
      if (result.error) {
        toast({ title: 'Erro', description: (result.error as Error).message, variant: 'destructive' });
        return;
      }
      
      if (result.redirected) {
        console.log('[Auth] Redirecting to external provider...');
        return;
      }
      
      console.log('[Auth] Sign in successful without redirect, navigating home');
      navigate('/admin', { replace: true });
    } catch (error: any) {
      console.error('[Auth] Google sign in exception:', error);
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <SpaceBackground />

      <div className="w-full max-w-md animate-fade-in relative z-10">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="gradient-primary p-2.5 rounded-xl shadow-neon-lilac animate-glow">
            <Newspaper className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold neon-text-lilac">NEURAL VORTEX</h1>
        </div>

        <Card className="glass-card shadow-elevated">
          <CardHeader className="text-center">
            <CardTitle className="text-xl text-foreground">{isLogin ? 'Entrar' : 'Criar conta'}</CardTitle>
            <CardDescription>
              {isLogin ? 'Acesse seu painel de automação' : 'Comece a automatizar seu blog'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              type="button"
              variant="outline"
              className="w-full border-border hover:bg-secondary/50"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              Entrar com Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-secondary/30 border-border focus:border-primary"
              />
              <PasswordInput
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-secondary/30 border-border focus:border-primary"
              />
              <Button type="submit" className="w-full gradient-primary text-primary-foreground shadow-neon-lilac" disabled={loading}>
                <Sparkles className="h-4 w-4 mr-2" />
                {loading ? 'Aguarde...' : isLogin ? 'Entrar' : 'Criar conta'}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {isLogin ? 'Não tem conta? Criar agora' : 'Já tem conta? Entrar'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
