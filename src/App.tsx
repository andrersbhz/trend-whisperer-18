import { useEffect, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import Preloader from "@/components/Preloader";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { getInstantLang, refreshGeoLangInBackground } from "@/lib/geo-language";

/** Lazy com 1 retry — evita tela branca quando um chunk falha por rede/deploy. */
const lazyRetry = (factory: () => Promise<any>) =>
  lazy(() =>
    factory().catch(
      () => new Promise((resolve) => setTimeout(resolve, 800)).then(factory)
    )
  );

// Critical public route — keep eager so first paint is fast
import BlogHome from "@/pages/BlogHome";

// Lazy: admin/dashboard surface (heavy: recharts, etc.)
const DashboardLayout = lazyRetry(() => import("@/components/DashboardLayout"));
const Auth = lazyRetry(() => import("@/pages/Auth"));
const Dashboard = lazyRetry(() => import("@/pages/Dashboard"));
const ArticlesPage = lazyRetry(() => import("@/pages/ArticlesPage"));
const TrendsPage = lazyRetry(() => import("@/pages/TrendsPage"));
const SchedulePage = lazyRetry(() => import("@/pages/SchedulePage"));
const SettingsPage = lazyRetry(() => import("@/pages/SettingsPage"));
const AnalyticsPage = lazyRetry(() => import("@/pages/AnalyticsPage"));
const SocialRobotPage = lazyRetry(() => import("@/pages/SocialRobotPage"));
const GooglePage = lazyRetry(() => import("@/pages/GooglePage"));
const MetaPage = lazyRetry(() => import("@/pages/MetaPage"));
const InstagramPage = lazyRetry(() => import("@/pages/InstagramPage"));
const AuthorsPage = lazyRetry(() => import("@/pages/AuthorsPage"));
const MapPage = lazyRetry(() => import("@/pages/MapPage"));

// Lazy: public secondary pages
const BlogArticle = lazyRetry(() => import("@/pages/BlogArticle"));
const CategoryPage = lazyRetry(() => import("@/pages/CategoryPage"));
const TermsPage = lazyRetry(() => import("@/pages/TermsPage"));
const AboutPage = lazyRetry(() => import("@/pages/AboutPage"));
const ContactPage = lazyRetry(() => import("@/pages/ContactPage"));
const PrivacyPage = lazyRetry(() => import("@/pages/PrivacyPage"));
const EditorialPage = lazyRetry(() => import("@/pages/EditorialPage"));
const AdvertisePage = lazyRetry(() => import("@/pages/AdvertisePage"));
const NewsletterPage = lazyRetry(() => import("@/pages/NewsletterPage"));
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
  if (!user) return <Navigate to="/auth" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
};

const AuthRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <Preloader message="Carregando..." />;
  if (user) return <Navigate to="/admin" replace />;
  return <Auth />;
};

const RootRoute = () => {
  const { user, loading } = useAuth();

  // Atualiza o cache de geolocalização em segundo plano (nunca bloqueia).
  useEffect(() => {
    refreshGeoLangInBackground();
  }, []);

  if (loading) return <Preloader message="Carregando..." />;
  if (user) return <Navigate to="/admin" replace />;
  // Redirecionamento SÍNCRONO e instantâneo — sem espera por rede.
  return <Navigate to={`/${getInstantLang()}`} replace />;
};

const CategoryPageWrapper = () => {
  const { categoryId } = useParams();
  return <CategoryPage categoryId={categoryId || ''} />;
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
                {/* Redirect root based on auth status */}
                <Route path="/" element={<RootRoute />} />

                {/* Public Blog Routes */}
                <Route path="/:lang" element={<BlogHome />} />
                <Route path="/:lang/category/:categoryId" element={<CategoryPageWrapper />} />
                <Route path="/:lang/article/:articleId" element={<BlogArticle />} />
                <Route path="/:lang/termos" element={<TermsPage />} />
                <Route path="/:lang/sobre" element={<AboutPage />} />
                <Route path="/:lang/contato" element={<ContactPage />} />
                <Route path="/:lang/privacidade" element={<PrivacyPage />} />
                <Route path="/:lang/principios-editoriais" element={<EditorialPage />} />
                <Route path="/:lang/anuncie" element={<AdvertisePage />} />
                <Route path="/:lang/newsletter" element={<NewsletterPage />} />

                {/* Admin Dashboard Routes (Protected) */}
                <Route path="/auth" element={<AuthRoute />} />
                <Route path="/admin" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/articles" element={<ProtectedRoute><ArticlesPage /></ProtectedRoute>} />
                <Route path="/trends" element={<ProtectedRoute><TrendsPage /></ProtectedRoute>} />
                <Route path="/schedule" element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
                <Route path="/robot" element={<ProtectedRoute><SocialRobotPage /></ProtectedRoute>} />
                <Route path="/google" element={<ProtectedRoute><GooglePage /></ProtectedRoute>} />
                <Route path="/meta" element={<ProtectedRoute><MetaPage /></ProtectedRoute>} />
                <Route path="/instagram" element={<ProtectedRoute><InstagramPage /></ProtectedRoute>} />
                <Route path="/authors" element={<ProtectedRoute><AuthorsPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />

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
