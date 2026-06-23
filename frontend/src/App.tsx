import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/layout/AppShell";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Session from "./pages/Session";
import LibraryPage from "./pages/LibraryPage";

import TutorDashboard from "./pages/TutorDashboard";
import StudentSessionHistory from "./pages/StudentSessionHistory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/tutor" element={<TutorDashboard />} />
            <Route path="/tutor/student/:studentId/history" element={<StudentSessionHistory />} />

            {/* App shell routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell><Index /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/session"
              element={
                <ProtectedRoute>
                  <AppShell><Session /></AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/library"
              element={
                <ProtectedRoute>
                  <AppShell><LibraryPage /></AppShell>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
