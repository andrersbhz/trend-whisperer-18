import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Preloader from "@/components/Preloader";

const DashboardLayout = lazy(() => import("@/components/DashboardLayout"));
const Auth = lazy(() => import("@/pages/Auth"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const ArticlesPage = lazy(() => import("@/pages/ArticlesPage"));
const TrendsPage = lazy(() => import("@/pages/TrendsPage"));
const SchedulePage = lazy(() => import("@/pages/SchedulePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const AnalyticsPage = lazy(() => import("@/pages/AnalyticsPage"));
const SocialRobotPage = lazy(() => import("@/pages/SocialRobotPage"));
const GooglePage = lazy(() => import("@/pages/GooglePage"));
const MetaPage = lazy(() => import("@/pages/MetaPage"));
const BlogHome = lazy(() => import("@/pages/BlogHome"));
const BlogArticle = lazy(() => import("@/pages/BlogArticle"));
const AuthorsPage = lazy(() => import("@/pages/AuthorsPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const CategoryPage = lazy(() => import("@/pages/CategoryPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MapPage = lazy(() => import("@/pages/MapPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const RouteFallback = () => <Preloader message="carregando painel" />;

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/auth" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
};

const AuthRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (user) return <Navigate to="/admin" replace />;
  return <Auth />;
};

const RootRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (user) return <Navigate to="/admin" replace />;
  return <Navigate to="/pt-br" replace />;
};

const CategoryPageWrapper = () => {
  const { categoryId } = useParams();
  return <CategoryPage categoryId={categoryId || ''} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <ThemeProvider defaultTheme="dark" storageKey="a3-dashboard-theme">
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Redirect root based on auth status */}
              <Route path="/" element={<RootRoute />} />
              
              {/* Public Blog Routes */}
              <Route path="/:lang" element={<BlogHome />} />
              <Route path="/:lang/category/:categoryId" element={<CategoryPageWrapper />} />
              <Route path="/:lang/article/:articleId" element={<BlogArticle />} />
              <Route path="/:lang/termos" element={<TermsPage />} />

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
);

export default App;
