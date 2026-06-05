import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/components/theme-provider';
import {
  LayoutDashboard,
  FileText,
  Settings,
  TrendingUp,
  Clock,
  LogOut,
  Newspaper,
  Menu,
  X,
  Sparkles,
  Loader2,
  Bot,
  Activity,
  Globe,
  Download,
  Search,
  Facebook,
  User,
  Sun,
  Moon,
} from 'lucide-react';
import { getPerformanceLogs, exportLogsToCSV } from '@/lib/performance';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/backend';
import SpaceBackground from './SpaceBackground';

import a3Logo from '@/assets/a3-logo.jpg';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: FileText, label: 'Artigos', path: '/articles' },
  { icon: User, label: 'Autores', path: '/authors' },
  { icon: Search, label: 'Google', path: '/google' },
  { icon: Facebook, label: 'Meta', path: '/meta' },
  { icon: TrendingUp, label: 'Tendências', path: '/trends' },
  { icon: Bot, label: 'Robô Social', path: '/robot' },
  { icon: Activity, label: 'Analytics', path: '/analytics' },
  { icon: Globe, label: 'Mapa Live', path: '/map' },
  { icon: Clock, label: 'Agendamentos', path: '/schedule' },
  { icon: Newspaper, label: 'Ver Blog', path: '/pt-br' },
  { icon: Settings, label: 'Configurações', path: '/settings' },
];

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const { toast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [logCount, setLogCount] = useState(0);

  useEffect(() => {
    const handleLogAdded = () => setLogCount(prev => prev + 1);
    window.addEventListener('performance-log-added', handleLogAdded);
    return () => window.removeEventListener('performance-log-added', handleLogAdded);
  }, []);

  const handleGlobalGenerate = async () => {
    if (!user || generating) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-articles', {
        body: { userId: user.id },
      });
      
      if (error) throw error;
      
      toast({
        title: data?.success ? 'Artigos gerados!' : 'Atenção',
        description: data?.message || 'A geração de artigos foi iniciada com sucesso.',
        variant: data?.success ? 'default' : 'destructive',
      });
      
      // Trigger a refresh if we are on the articles page
      if (location.pathname === '/articles') {
        window.dispatchEvent(new CustomEvent('refresh-articles'));
      }
    } catch (error) {
      toast({ 
        title: 'Erro ao gerar artigos', 
        description: getErrorMessage(error), 
        variant: 'destructive' 
      });
    } finally {
      setGenerating(false);
    }
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile sidebar open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const currentLabel = navItems.find((i) => i.path === location.pathname || (i.path === '/admin' && location.pathname === '/admin'))?.label || 'Dashboard';
  const userInitial = (user?.email?.[0] || 'U').toUpperCase();

  return (
    <div className="min-h-screen flex relative">
      <SpaceBackground />
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/70 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed lg:sticky top-0 inset-y-0 left-0 z-50 w-72 lg:w-64 h-screen glass flex flex-col transition-transform duration-300 ease-in-out border-r border-primary/20 shadow-[10px_0_30px_-15px_rgba(0,0,0,0.5)]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        aria-label="Navegação principal"
      >
        {/* Brand */}
        <div className="p-5 flex items-center justify-between border-b border-border/40">
          <Link to="/admin" className="flex items-center gap-3 group">
            <div className="h-10 w-10 rounded-full overflow-hidden border-2 border-[hsl(200_100%_60%)] shadow-[0_0_15px_hsl(200_100%_60%/0.7)] group-hover:scale-105 transition-transform shrink-0">
              <img src={a3Logo} alt="A3 PostWP" className="h-full w-full object-cover" />
            </div>
            <span className="font-extrabold text-base tracking-tighter uppercase italic text-foreground font-montserrat">A3 <span className="text-[hsl(200_100%_60%)]">PostWP</span></span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary/50 transition-colors"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'group flex items-center gap-3 px-3 py-2.5 rounded-none text-xs font-bold transition-all duration-300 uppercase tracking-widest',
                  active
                    ? 'bg-primary/10 text-primary border-l-2 border-primary shadow-[inset_10px_0_15px_-10px_rgba(0,150,255,0.2)]'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground hover:translate-x-0.5'
                )}
              >
                <item.icon className={cn('h-[18px] w-[18px] transition-transform', active && 'scale-110')} />
                <span className="flex-1">{item.label}</span>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />}
              </Link>
            );
          })}
        </nav>

        {/* User & Logout */}
        <div className="p-3 border-t border-border/40 space-y-2">
          {user && (
            <div className="flex items-center gap-3 px-2 py-2 rounded-none bg-secondary/50 border border-primary/20">
              <div className="h-9 w-9 rounded-none bg-primary flex items-center justify-center text-primary-foreground font-black text-sm shrink-0 shadow-neon-blue">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{user.email}</p>
                <p className="text-[10px] text-muted-foreground">Conta ativa</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors rounded-none text-xs uppercase tracking-widest font-bold"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 mr-3" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 glass border-b border-border/60 px-4 lg:px-8 h-14 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden -ml-1 p-2 rounded-md hover:bg-secondary/50 text-foreground transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h2 className="font-semibold text-foreground truncate">{currentLabel}</h2>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 transition-all" />
              ) : (
                <Moon className="h-4 w-4 transition-all" />
              )}
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                  <Activity className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 glass-card p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h4 className="font-bold text-xs uppercase tracking-widest text-primary">Monitor de Performance</h4>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-muted-foreground hover:text-primary"
                      onClick={() => exportLogsToCSV()}
                      title="Exportar CSV"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">

                    {getPerformanceLogs().length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic">Aguardando métricas...</p>
                    ) : (
                      getPerformanceLogs().slice().reverse().map((log, i) => (
                        <div key={i} className="flex justify-between items-center gap-2 text-[10px] bg-white/5 p-2 rounded-sm">
                          <span className="truncate font-medium">{log.label}</span>
                          <span className={cn(
                            "font-bold tabular-nums shrink-0",
                            log.duration > 1000 ? "text-destructive" : log.duration > 500 ? "text-warning" : "text-success"
                          )}>
                            {log.duration}ms
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button
              onClick={handleGlobalGenerate}
              disabled={generating}
              size="sm"
              className="gradient-primary h-8 gap-2 shadow-neon-lilac hover:scale-[1.02] transition-transform text-[10px] font-black px-3 sm:px-4 rounded-none uppercase tracking-tighter"
            >
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span>{generating ? 'Gerando...' : 'Ligar Robô'}</span>
            </Button>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-none bg-success/5 border border-success/30">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-dot" />
              <span className="text-[11px] font-medium text-success">Online</span>
            </div>
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8 animate-fade-in flex-1">
          <div className="page-container">{children}</div>
        </div>
        
      </main>
    </div>
  );
};

export default DashboardLayout;
