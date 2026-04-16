import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: FileText, label: 'Artigos', path: '/articles' },
  { icon: TrendingUp, label: 'Tendências', path: '/trends' },
  { icon: Clock, label: 'Agendamentos', path: '/schedule' },
  { icon: BarChart3, label: 'Analytics', path: '/analytics' },
  { icon: Settings, label: 'Configurações', path: '/settings' },
];

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-50 w-64 glass flex flex-col transition-transform duration-200',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="gradient-primary p-2 rounded-lg shadow-neon-lilac">
              <Newspaper className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg neon-text-lilac">AutoBlog AI</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                  active
                    ? 'bg-primary/10 text-primary neon-border-lilac'
                    : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                )}
              >
                <item.icon className="h-4.5 w-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 mr-3" />
            Sair
          </Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 glass border-b border-border px-4 lg:px-6 h-14 flex items-center">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-3">
            <Menu className="h-5 w-5 text-foreground" />
          </button>
          <h2 className="font-semibold text-foreground">
            {navItems.find((i) => i.path === location.pathname)?.label || 'Dashboard'}
          </h2>
        </header>
        <div className="p-6 lg:p-8 animate-fade-in">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
