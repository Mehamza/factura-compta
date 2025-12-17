import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route } from "react-router-dom";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { SuperAdminRoute } from "@/components/layout/ProtectedRoute";
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
import SettingsUsers from "./pages/SettingsUsers";
import NotFound from "./pages/NotFound";
import Payments from "./pages/Payments";
import Journal from "./pages/Journal";
import Accounts from "./pages/Accounts";
import Reports from "./pages/Reports";
import StockProducts from "./pages/StockProducts";
import StockMovements from "./pages/StockMovements";
import AdminIndex from "./pages/AdminIndex";
import Pricing from "./pages/Pricing";
import AdminPlans from "./pages/AdminPlans";

const queryClient = new QueryClient();

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><Index /></motion.div></ProtectedRoute>} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/clients" element={<ProtectedRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><Clients /></motion.div></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><Suppliers /></motion.div></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><Invoices /></motion.div></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><Documents /></motion.div></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><Settings /></motion.div></ProtectedRoute>} />
      <Route path="/settings/utilisateurs" element={<ProtectedRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><SettingsUsers /></motion.div></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><Payments /></motion.div></ProtectedRoute>} />
      <Route path="/journal" element={<ProtectedRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><Journal /></motion.div></ProtectedRoute>} />
      <Route path="/accounts" element={<ProtectedRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><Accounts /></motion.div></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><Reports /></motion.div></ProtectedRoute>} />
      <Route path="/stock/produits" element={<ProtectedRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><StockProducts /></motion.div></ProtectedRoute>} />
      <Route path="/stock/mouvements" element={<ProtectedRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><StockMovements /></motion.div></ProtectedRoute>} />
      <Route path="/tarif" element={<motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><Pricing /></motion.div>} />
      <Route path="/hamzafacturation" element={<ProtectedRoute><SuperAdminRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><AdminIndex /></motion.div></SuperAdminRoute></ProtectedRoute>} />
      <Route path="/hamzafacturation/plans" element={<ProtectedRoute><SuperAdminRoute><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}><AdminPlans /></motion.div></SuperAdminRoute></ProtectedRoute>} />
      <Route path="*" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}><NotFound /></motion.div>} />
    </Route>
  ),
  {
    future: {
      v7_relativeSplatPath: true,
    },
  },
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <MotionConfig reducedMotion="user">
          <AnimatePresence mode="wait">
            <RouterProvider router={router} />
          </AnimatePresence>
        </MotionConfig>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
