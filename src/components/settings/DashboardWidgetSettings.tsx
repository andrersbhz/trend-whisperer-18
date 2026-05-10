import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Layout } from "lucide-react";

interface DashboardWidgets {
  stats: boolean;
  meta: boolean;
  robot: boolean;
  trends: boolean;
  categories: boolean;
  audit: boolean;
  alternate_stats: boolean;
}

interface DashboardWidgetSettingsProps {
  widgets: DashboardWidgets;
  onChange: (widgets: DashboardWidgets) => void;
}

const DashboardWidgetSettings = ({ widgets, onChange }: DashboardWidgetSettingsProps) => {
  const toggleWidget = (key: keyof DashboardWidgets) => {
    onChange({
      ...widgets,
      [key]: !widgets[key],
    });
  };

  const widgetLabels: Record<keyof DashboardWidgets, string> = {
    stats: "Estatísticas Gerais (Principais)",
    meta: "Páginas do Facebook (Meta)",
    robot: "Robô Social Humano",
    trends: "Google Trends Preview",
    categories: "Métricas por Categoria",
    audit: "Logs de Auditoria",
    alternate_stats: "Métricas Alternativas (Posts/Agendamentos)",
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Layout className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Widgets do Dashboard</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Selecione quais painéis você deseja visualizar na página inicial.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(widgetLabels) as Array<keyof DashboardWidgets>).map((key) => (
          <div key={key} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
            <Label htmlFor={`widget-${key}`} className="flex-1 cursor-pointer font-medium text-sm">
              {widgetLabels[key]}
            </Label>
            <Switch
              id={`widget-${key}`}
              checked={widgets[key]}
              onCheckedChange={() => toggleWidget(key)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default DashboardWidgetSettings;
