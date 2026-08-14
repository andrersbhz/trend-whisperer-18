import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Users, FileText, ShoppingCart, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export default function AdminSystemPage() {
  const { isAdmin, loading } = useAuth();
  const [usersCount, setUsersCount] = useState(0);
  const [articlesCount, setArticlesCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  const fetchAdminData = async () => {
    // Note: To list all users from auth.users, we would normally need an edge function 
    // because auth.users is not directly accessible via PostgREST.
    // For now, we'll aggregate from public tables to show activity.
    
    const { count: artCount } = await supabase.from('articles').select('*', { count: 'exact', head: true });
    setArticlesCount(artCount || 0);

    const { count: sCount } = await supabase.from('sales' as any).select('*', { count: 'exact', head: true });
    setSalesCount(sCount || 0);

    // Mock/placeholder for user management until Edge Function is ready
    setUsersCount(1); // At least the current admin
  };

  if (loading) return <div className="p-8 text-center">Carregando...</div>;
  if (!isAdmin) return <Navigate to="/admin" replace />;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground">Painel de Controle Total</h1>
          <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest mt-1">Administração do Sistema A3</p>
        </div>
        <Badge className="bg-primary/20 text-primary border-primary/30 py-1 px-3">
          <ShieldCheck className="h-3 w-3 mr-2" /> Modo Administrador
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass-card neon-border-blue">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest">Usuários Ativos</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{usersCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">Total na base</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card neon-border-lilac">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest">Total de Artigos</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{articlesCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">Gerados por IA</p>
          </CardContent>
        </Card>

        <Card className="glass-card neon-border-green">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-widest">Vendas Totais</CardTitle>
            <ShoppingCart className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{salesCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold">Conversões</p>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg uppercase tracking-tighter flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" /> 
            Configurações Críticas do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-secondary/20 border border-white/5 rounded-lg space-y-2">
              <h3 className="font-bold text-sm uppercase">Manutenção Global</h3>
              <p className="text-xs text-muted-foreground">Desativar geração de artigos para todos os usuários em caso de erro na API.</p>
              <Badge variant="outline" className="text-warning border-warning/30">Em Breve</Badge>
            </div>
            <div className="p-4 bg-secondary/20 border border-white/5 rounded-lg space-y-2">
              <h3 className="font-bold text-sm uppercase">Gerenciamento de Roles</h3>
              <p className="text-xs text-muted-foreground">Promover usuários a moderadores ou administradores.</p>
              <Badge variant="outline" className="text-warning border-warning/30">Em Breve</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
