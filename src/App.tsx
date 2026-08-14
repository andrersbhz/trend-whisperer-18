import { useEffect, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import Preloader from "@/components/Preloader";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { refreshGeoLangInBackground } from "@/lib/geo-language";

/** Lazy com 1 retry — evita tela branca quando um chunk falha por rede/deploy. */
const lazyRetry = (factory: () => Promise<any>) =>
  lazy(() =>
    factory().catch(
      () => new Promise((resolve) => setTimeout(resolve, 800)).then(factory)
    )
  );

// Lazy: admin/dashboard surface (heavy: recharts, etc.)
const DashboardLayout = lazyRetry(() => import("@/components/DashboardLayout"));
const Auth = lazyRetry(() => import("@/pages/Auth"));
const Dashboard = lazyRetry(() => import("@/pages/Dashboard"));
const ArticlesPage = lazyRetry(() => import("@/pages/ArticlesPage"));
const TrendsPage = lazyRetry(() => import("@/pages/TrendsPage"));
const TrendDetailPage = lazyRetry(() => import("@/pages/TrendDetailPage"));
const SchedulePage = lazyRetry(() => import("@/pages/SchedulePage"));
const SettingsPage = lazyRetry(() => import("@/pages/SettingsPage"));
const AnalyticsPage = lazyRetry(() => import("@/pages/AnalyticsPage"));
const SocialRobotPage = lazyRetry(() => import("@/pages/SocialRobotPage"));
const SocialPublisherPage = lazyRetry(() => import("@/pages/SocialPublisherPage"));
const GooglePage = lazyRetry(() => import("@/pages/GooglePage"));
const MetaPage = lazyRetry(() => import("@/pages/MetaPage"));
const InstagramPage = lazyRetry(() => import("@/pages/InstagramPage"));

const MapPage = lazyRetry(() => import("@/pages/MapPage"));
const ProfilePage = lazyRetry(() => import("@/pages/ProfilePage"));
const ImageStudioPage = lazyRetry(() => import("@/pages/ImageStudioPage"));
const SalesPage = lazyRetry(() => import("@/pages/SalesPage"));
const BrandingPage = lazyRetry(() => import("@/pages/BrandingPage"));
const PaymentMethodsPage = lazyRetry(() => import("@/pages/PaymentMethodsPage"));
const AdminSalesPage = lazyRetry(() => import("@/pages/AdminSalesPage"));
const LicenseActivatePage = lazyRetry(() => import("@/pages/LicenseActivatePage"));
const CheckoutReturnPage = lazyRetry(() => import("@/pages/CheckoutReturnPage"));
const AdminSystemPage = lazyRetry(() => import("@/pages/AdminSystemPage"));

// NEXA Insight (Etapa 1 — fundação multiempresa)
const NexaLogin = lazyRetry(() => import("@/nexa/pages/NexaLogin"));
const NexaOnboarding = lazyRetry(() => import("@/nexa/pages/NexaOnboarding"));
const NexaDashboard = lazyRetry(() => import("@/nexa/pages/NexaDashboard"));
const NexaTeams = lazyRetry(() => import("@/nexa/pages/NexaTeams"));
const NexaAgents = lazyRetry(() => import("@/nexa/pages/NexaAgents"));
const NexaSettings = lazyRetry(() => import("@/nexa/pages/NexaSettings"));
const NexaAudit = lazyRetry(() => import("@/nexa/pages/NexaAudit"));
const NexaAdmin = lazyRetry(() => import("@/nexa/pages/NexaAdmin"));
const NexaPlaceholder = lazyRetry(() => import("@/nexa/pages/NexaPlaceholder"));
const ProtectedNexaRoute = lazyRetry(() => import("@/nexa/components/ProtectedNexaRoute"));

const NotFound = lazyRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!user) return <Navigate to="/auth" replace state={{ from: window.location.pathname }} />;
  return <DashboardLayout>{children}</DashboardLayout>;
};

const AuthRoute = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/admin', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) return <Preloader message="Carregando..." />;
  return <Auth />;
};


const RootRoute = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    refreshGeoLangInBackground();
  }, []);

  useEffect(() => {
    if (!loading && user) {
      navigate('/admin', { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) return <Preloader message="Carregando..." />;
  return <SalesPage />;
};


const PresenceTracker = () => {
  useOnlinePresence();
  return null;
};

const App = () => (
  <AppErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <ThemeProvider defaultTheme="dark" storageKey="a3-dashboard-theme">
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <PresenceTracker />
            <Suspense fallback={<Preloader message="Carregando..." />}>
              <Routes>
                <Route path="/" element={<RootRoute />} />
                <Route path="/vendas" element={<SalesPage />} />
                <Route path="/pricing" element={<SalesPage />} />

                <Route path="/auth" element={<AuthRoute />} />
                <Route path="/admin" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/articles" element={<ProtectedRoute><ArticlesPage /></ProtectedRoute>} />
                <Route path="/trends" element={<ProtectedRoute><TrendsPage /></ProtectedRoute>} />
                <Route path="/trends/:trendId" element={<ProtectedRoute><TrendDetailPage /></ProtectedRoute>} />
                <Route path="/schedule" element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/robot" element={<ProtectedRoute><SocialRobotPage /></ProtectedRoute>} />
                <Route path="/social" element={<ProtectedRoute><SocialPublisherPage /></ProtectedRoute>} />
                <Route path="/google" element={<ProtectedRoute><GooglePage /></ProtectedRoute>} />
                <Route path="/meta" element={<ProtectedRoute><MetaPage /></ProtectedRoute>} />
                <Route path="/instagram" element={<ProtectedRoute><InstagramPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/image-studio" element={<ProtectedRoute><ImageStudioPage /></ProtectedRoute>} />
                <Route path="/branding" element={<ProtectedRoute><BrandingPage /></ProtectedRoute>} />
                <Route path="/payment-methods" element={<ProtectedRoute><PaymentMethodsPage /></ProtectedRoute>} />
                <Route path="/admin-sales" element={<ProtectedRoute><AdminSalesPage /></ProtectedRoute>} />
                <Route path="/license" element={<LicenseActivatePage />} />
                <Route path="/ativar" element={<LicenseActivatePage />} />
                <Route path="/checkout/return" element={<CheckoutReturnPage />} />
                <Route path="/admin/system" element={<ProtectedRoute><AdminSystemPage /></ProtectedRoute>} />

                <Route path="/nexa" element={<Navigate to="/nexa/dashboard" replace />} />
                <Route path="/nexa/login" element={<NexaLogin />} />
                <Route path="/nexa/onboarding" element={<ProtectedNexaRoute><NexaOnboarding /></ProtectedNexaRoute>} />
                <Route path="/nexa/dashboard" element={<ProtectedNexaRoute><NexaDashboard /></ProtectedNexaRoute>} />
                <Route path="/nexa/teams" element={<ProtectedNexaRoute><NexaTeams /></ProtectedNexaRoute>} />
                <Route path="/nexa/agents" element={<ProtectedNexaRoute><NexaAgents /></ProtectedNexaRoute>} />
                <Route path="/nexa/settings" element={<ProtectedNexaRoute><NexaSettings /></ProtectedNexaRoute>} />
                <Route path="/nexa/audit" element={<ProtectedNexaRoute roles={["org_admin","auditor"]}><NexaAudit /></ProtectedNexaRoute>} />
                <Route path="/nexa/admin" element={<ProtectedNexaRoute roles={["super_admin"]}><NexaAdmin /></ProtectedNexaRoute>} />
                <Route path="/nexa/interactions" element={<ProtectedNexaRoute><NexaPlaceholder title="Atendimentos" stage="Etapa 2" description="Upload de áudio/texto, central de interações, processamento assíncrono e player sincronizado com a transcrição." /></ProtectedNexaRoute>} />
                <Route path="/nexa/customers" element={<ProtectedNexaRoute><NexaPlaceholder title="Clientes" stage="Etapa 2" description="Cadastro de clientes, histórico de contatos e visão consolidada por canal." /></ProtectedNexaRoute>} />
                <Route path="/nexa/quality" element={<ProtectedNexaRoute><NexaPlaceholder title="Qualidade" stage="Etapa 3" description="Revisão humana de transcrições e análises da IA, comparação entre avaliação automática e manual." /></ProtectedNexaRoute>} />
                <Route path="/nexa/scorecards" element={<ProtectedNexaRoute><NexaPlaceholder title="Scorecards" stage="Etapa 3" description="Construtor de critérios, pesos, falhas críticas e versionamento de scorecards por equipe ou canal." /></ProtectedNexaRoute>} />
                <Route path="/nexa/health-score" element={<ProtectedNexaRoute><NexaPlaceholder title="Health Score" stage="Etapa 4" description="Indicador de saúde de cada cliente com histórico, fatores positivos e negativos." /></ProtectedNexaRoute>} />
                <Route path="/nexa/alerts" element={<ProtectedNexaRoute><NexaPlaceholder title="Alertas" stage="Etapa 4" description="Motor de regras por empresa, equipe, atendente e severidade." /></ProtectedNexaRoute>} />
                <Route path="/nexa/insights" element={<ProtectedNexaRoute><NexaPlaceholder title="Assistente Insight" stage="Etapa 5" description="Pesquisa semântica em linguagem natural, escopo limitado à sua empresa, com fontes citadas." /></ProtectedNexaRoute>} />
                <Route path="/nexa/coaching" element={<ProtectedNexaRoute><NexaPlaceholder title="Coaching" stage="Etapa 4" description="Feedbacks, planos de melhoria, biblioteca de boas práticas." /></ProtectedNexaRoute>} />
                <Route path="/nexa/knowledge" element={<ProtectedNexaRoute><NexaPlaceholder title="Base de conhecimento" stage="Etapa 5" description="Upload de scripts, manuais e políticas. Embeddings e controle de permissões." /></ProtectedNexaRoute>} />
                <Route path="/nexa/reports" element={<ProtectedNexaRoute><NexaPlaceholder title="Relatórios" stage="Etapa 4" description="Relatórios executivos, por equipe, por atendente, por cliente e exportações." /></ProtectedNexaRoute>} />
                <Route path="/nexa/integrations" element={<ProtectedNexaRoute><NexaPlaceholder title="Integrações" stage="Etapa 6" description="WhatsApp, e-mail, telefonia SIP, CRM, ERP e webhooks autenticados." /></ProtectedNexaRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </HelmetProvider>
  </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
