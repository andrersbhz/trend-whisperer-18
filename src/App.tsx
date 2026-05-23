import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
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
import NotFound from "./pages/NotFound";

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
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Redirect root to default language blog */}
            <Route path="/" element={<Navigate to="/pt-br" replace />} />
            
            {/* Public Blog Routes */}
            <Route path="/:lang" element={<BlogHome />} />
            <Route path="/:lang/category/:categoryId" element={<BlogHome />} />
            <Route path="/:lang/article/:articleId" element={<BlogHome />} />

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
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
