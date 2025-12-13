import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import Clients from "./pages/Clients";
import Suppliers from "./pages/Suppliers";
import Invoices from "./pages/Invoices";
import Documents from "./pages/Documents";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Payments from "./pages/Payments";
import Journal from "./pages/Journal";
import Accounts from "./pages/Accounts";
import Reports from "./pages/Reports";
import StockProducts from "./pages/StockProducts";
import StockMovements from "./pages/StockMovements";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout><Index /></DashboardLayout></ProtectedRoute>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/clients" element={<ProtectedRoute><DashboardLayout><Clients /></DashboardLayout></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute><DashboardLayout><Suppliers /></DashboardLayout></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><DashboardLayout><Invoices /></DashboardLayout></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><DashboardLayout><Documents /></DashboardLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><DashboardLayout><Settings /></DashboardLayout></ProtectedRoute>} />
            <Route path="/mohamedhamzaallagui" element={<ProtectedRoute><DashboardLayout><Users /></DashboardLayout></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><DashboardLayout><Payments /></DashboardLayout></ProtectedRoute>} />
            <Route path="/journal" element={<ProtectedRoute><DashboardLayout><Journal /></DashboardLayout></ProtectedRoute>} />
            <Route path="/accounts" element={<ProtectedRoute><DashboardLayout><Accounts /></DashboardLayout></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><DashboardLayout><Reports /></DashboardLayout></ProtectedRoute>} />
            <Route path="/stock/produits" element={<ProtectedRoute><DashboardLayout><StockProducts /></DashboardLayout></ProtectedRoute>} />
            <Route path="/stock/mouvements" element={<ProtectedRoute><DashboardLayout><StockMovements /></DashboardLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
