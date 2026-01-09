import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Welcome from "./pages/Welcome";
import Dashboard from "./pages/Dashboard";
import Admissions from "./pages/Admissions";
import Students from "./pages/Students";
import Payments from "./pages/Payments";
import Admin from "./pages/Admin";
import PendingSync from "./pages/PendingSync";
import NotFound from "./pages/NotFound";

// Admin Pages
import AdminLogin from "./pages/admin/Login";
import AdminRegister from "./pages/admin/Register";

// Receptionist Pages
import ReceptionistLogin from "./pages/receptionist/Login";
import ReceptionistRegister from "./pages/receptionist/Register";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Redirect old routes to role selection */}
            <Route path="/login" element={<Navigate to="/welcome" replace />} />
            <Route path="/register" element={<Navigate to="/welcome" replace />} />

            {/* Welcome Page */}
            <Route path="/welcome" element={<Welcome />} />

            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/register" element={<AdminRegister />} />

            {/* Receptionist Routes */}
            <Route path="/receptionist/login" element={<ReceptionistLogin />} />
            <Route path="/receptionist/register" element={<ReceptionistRegister />} />

            {/* Main App Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admissions"
              element={
                <ProtectedRoute>
                  <Admissions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/students"
              element={
                <ProtectedRoute>
                  <Students />
                </ProtectedRoute>
              }
            />
            <Route
              path="/payments"
              element={
                <ProtectedRoute>
                  <Payments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pending-sync"
              element={
                <ProtectedRoute>
                  <PendingSync />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
