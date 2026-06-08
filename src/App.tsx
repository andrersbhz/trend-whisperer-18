import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import DashboardLayout from "@/components/DashboardLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import ArticlesPage from "@/pages/ArticlesPage";
import TrendsPage from "@/pages/TrendsPage";
import SchedulePage from "@/pages/SchedulePage";
import SettingsPage from "@/pages/SettingsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";
import SocialRobotPage from "@/pages/SocialRobotPage";
import GooglePage from "@/pages/GooglePage";
import MetaPage from "@/pages/MetaPage";
import BlogHome from "@/pages/BlogHome";
import BlogArticle from "@/pages/BlogArticle";
import AuthorsPage from "@/pages/AuthorsPage";
import TermsPage from "@/pages/TermsPage";
import CategoryPage from "@/pages/CategoryPage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import PrivacyPage from "@/pages/PrivacyPage";
import EditorialPage from "@/pages/EditorialPage";
import AdvertisePage from "@/pages/AdvertisePage";
import NewsletterPage from "@/pages/NewsletterPage";
import NotFound from "./pages/NotFound";
import MapPage from "@/pages/MapPage";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <DashboardLayout>{children}</DashboardLayout>;
};

const AuthRoute = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/admin" replace />;
  return <Auth />;
};

const RootRoute = () => {
  const { user, loading } = useAuth();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (user) return;
    let cancelled = false;
    import('@/lib/geo-language').then(({ detectLanguage }) => {
      detectLanguage().then((lang) => {
        if (!cancelled) setTarget(`/${lang}`);
      });
    });
    return () => { cancelled = true; };
  }, [user]);

  if (loading) return null;
  if (user) return <Navigate to="/admin" replace />;
  if (!target) return null;
  return <Navigate to={target} replace />;
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
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <ThemeProvider defaultTheme="dark" storageKey="a3-dashboard-theme">
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <PresenceTracker />
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
            <Route path="/authors" element={<ProtectedRoute><AuthorsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
