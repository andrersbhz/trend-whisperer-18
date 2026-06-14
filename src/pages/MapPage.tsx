import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import WorldMap from "@/components/WorldMap";
import { Globe, Users, TrendingUp, ArrowUpRight, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface CountryStat {
  country: string;
  count: number;
  percentage: number;
}

const MapPage = () => {
  const [topCountries, setTopCountries] = useState<CountryStat[]>([]);
  const [totalOnline, setTotalOnline] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase.rpc('get_online_locations', { p_minutes: 60 });
      if (cancelled || error || !data) return;
      const tally = new Map<string, number>();
      (data as Array<{ country: string | null }>).forEach((r) => {
        const c = r.country || 'Desconhecido';
        tally.set(c, (tally.get(c) ?? 0) + 1);
      });
      const total = Array.from(tally.values()).reduce((a, b) => a + b, 0);
      const sorted = Array.from(tally.entries())
        .map(([country, count]) => ({ country, count, percentage: total > 0 ? Math.round((count / total) * 100) : 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      setTopCountries(sorted);
      setTotalOnline(total);
    };
    load();
    const interval = window.setInterval(load, 20_000);
    const channel = supabase
      .channel('map_top_countries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'online_users' }, () => load())
      .subscribe();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <DashboardLayout>

      <div className="space-y-6 lg:space-y-8 pb-10">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/20 flex items-center justify-center rounded-sm border border-primary/30 shadow-neon-lilac">
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter text-foreground leading-none">Mapa em Tempo Real</h1>
              <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-muted-foreground mt-1.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Monitoramento Global de Visitantes
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <WorldMap />
          </div>
          
          <div className="space-y-6">
            <Card className="glass-card neon-border-blue animate-float-up">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Users className="h-3 w-3 text-primary" /> Atividade Atual
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-foreground tabular-nums">143</span>
                  <span className="text-[10px] font-bold text-success flex items-center gap-0.5">
                    <ArrowUpRight className="h-3 w-3" /> +12%
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Sessões ativas no momento</p>
              </CardContent>
            </Card>

            <Card className="glass-card neon-border-pink animate-float-up" style={{ animationDelay: '0.1s' }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-accent" /> Principais Regiões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { country: 'Brasil', percentage: 65, color: 'bg-primary' },
                    { country: 'EUA', percentage: 15, color: 'bg-accent' },
                    { country: 'Portugal', percentage: 8, color: 'bg-success' },
                    { country: 'Outros', percentage: 12, color: 'bg-muted' },
                  ].map((region) => (
                    <div key={region.country} className="space-y-1">
                      <div className="flex justify-between text-[10px] font-bold uppercase">
                        <span>{region.country}</span>
                        <span>{region.percentage}%</span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${region.color} shadow-neon-blue`} 
                          style={{ width: `${region.percentage}%` }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="glass-card p-4 border border-white/5 space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary">Dica do Sistema</h4>
              <p className="text-[11px] text-muted-foreground leading-relaxed italic">
                "A maior concentração de acessos ocorre entre 18h e 21h (Brasília). Agende seus artigos para este período para maximizar o alcance."
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MapPage;
