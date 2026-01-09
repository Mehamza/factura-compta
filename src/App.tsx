import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route } from "react-router-dom";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { SuperAdminRoute } from "@/components/layout/ProtectedRoute";
import { ModuleProtectedRoute } from "@/components/layout/ModuleProtectedRoute";
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import Clients from "./pages/Clients";
import Suppliers from "./pages/Suppliers";
import Invoices from "./pages/Invoices";
import Purchases from "./pages/Purchases";
// Sales documents
import SalesDevis from "./pages/documents/SalesDevis";
import SalesDevisNew from "./pages/documents/SalesDevisNew";
import SalesDevisView from "./pages/documents/SalesDevisView";
import SalesDevisEdit from "./pages/documents/SalesDevisEdit";
import SalesBonCommande from "./pages/documents/SalesBonCommande";
import SalesBonCommandeNew from "./pages/documents/SalesBonCommandeNew";
import SalesBonCommandeView from "./pages/documents/SalesBonCommandeView";
import SalesBonCommandeEdit from "./pages/documents/SalesBonCommandeEdit";
import SalesBonLivraison from "./pages/documents/SalesBonLivraison";
import SalesBonLivraisonNew from "./pages/documents/SalesBonLivraisonNew";
import SalesBonLivraisonView from "./pages/documents/SalesBonLivraisonView";
import SalesBonLivraisonEdit from "./pages/documents/SalesBonLivraisonEdit";
import SalesFactureCredit from "./pages/documents/SalesFactureCredit";
import SalesFactureCreditNew from "./pages/documents/SalesFactureCreditNew";
import SalesFactureCreditView from "./pages/documents/SalesFactureCreditView";
import SalesFactureCreditEdit from "./pages/documents/SalesFactureCreditEdit";
import SalesFacturePayee from "./pages/documents/SalesFacturePayee";
import SalesFacturePayeeNew from "./pages/documents/SalesFacturePayeeNew";
import SalesFacturePayeeView from "./pages/documents/SalesFacturePayeeView";
import SalesFacturePayeeEdit from "./pages/documents/SalesFacturePayeeEdit";
import SalesFactureAvoir from "./pages/documents/SalesFactureAvoir";
import SalesFactureAvoirNew from "./pages/documents/SalesFactureAvoirNew";
import SalesFactureAvoirView from "./pages/documents/SalesFactureAvoirView";
import SalesFactureAvoirEdit from "./pages/documents/SalesFactureAvoirEdit";
// Purchase documents
import PurchaseBonCommande from "./pages/documents/PurchaseBonCommande";
import PurchaseBonCommandeNew from "./pages/documents/PurchaseBonCommandeNew";
import PurchaseBonCommandeView from "./pages/documents/PurchaseBonCommandeView";
import PurchaseBonCommandeEdit from "./pages/documents/PurchaseBonCommandeEdit";
import PurchaseBonLivraison from "./pages/documents/PurchaseBonLivraison";
import PurchaseBonLivraisonNew from "./pages/documents/PurchaseBonLivraisonNew";
import PurchaseBonLivraisonView from "./pages/documents/PurchaseBonLivraisonView";
import PurchaseBonLivraisonEdit from "./pages/documents/PurchaseBonLivraisonEdit";
import PurchaseFactureCredit from "./pages/documents/PurchaseFactureCredit";
import PurchaseFactureCreditNew from "./pages/documents/PurchaseFactureCreditNew";
import PurchaseFactureCreditView from "./pages/documents/PurchaseFactureCreditView";
import PurchaseFactureCreditEdit from "./pages/documents/PurchaseFactureCreditEdit";
import PurchaseAvoir from "./pages/documents/PurchaseAvoir";
import PurchaseAvoirNew from "./pages/documents/PurchaseAvoirNew";
import PurchaseAvoirView from "./pages/documents/PurchaseAvoirView";
import PurchaseAvoirEdit from "./pages/documents/PurchaseAvoirEdit";
// Other pages
import Documents from "./pages/Documents";
import Users from "./pages/Users";
import Settings from "./pages/Settings";
import SettingsUsers from "./pages/SettingsUsers";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import Payments from "./pages/Payments";
import Journal from "./pages/Journal";
import Accounts from "./pages/Accounts";
import Reports from "./pages/Reports";
import StockProducts from "./pages/StockProducts";
import StockMovements from "./pages/StockMovements";
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import AdminUsers from "./pages/AdminUsers";
import AdminPlans from "./pages/AdminPlans";
import Tarif from "./pages/Tarif"; 
import Contact from "./pages/Contact";
import PublicLayout from "@/components/layout/PublicLayout";

const queryClient = new QueryClient();

// Animation wrapper for page transitions
const PageTransition = ({ children }: { children: React.ReactNode }) => (
  <motion.div 
    initial={{ opacity: 0, y: 8 }} 
    animate={{ opacity: 1, y: 0 }} 
    exit={{ opacity: 0, y: -8 }} 
    transition={{ duration: 0.2, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      {/* Public routes */}
      <Route path="/" element={<PublicLayout><LandingPage /></PublicLayout>} />
      <Route path="/auth" element={<PublicLayout><Auth /></PublicLayout>} />
      <Route path="/tarif" element={<PublicLayout><PageTransition><Tarif /></PageTransition></PublicLayout>} />
      <Route path="/contact" element={<PublicLayout><PageTransition><Contact /></PageTransition></PublicLayout>} />
      <Route path="/blog" element={<PublicLayout><div>Blog page coming soon</div></PublicLayout>} />
      
      {/* Protected routes - accessible by all roles */}
      <Route path="/dashboard" element={<ProtectedRoute><PageTransition><Index /></PageTransition></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><PageTransition><Clients /></PageTransition></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><PageTransition><Suppliers /></PageTransition></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><PageTransition><Documents /></PageTransition></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><PageTransition><Settings /></PageTransition></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute><PageTransition><Account /></PageTransition></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><PageTransition><Payments /></PageTransition></ProtectedRoute>} />
      
      {/* Sales invoice routes */}
      <Route path="/invoices" element={<ProtectedRoute><PageTransition><Invoices /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/devis" element={<ProtectedRoute><PageTransition><SalesDevis /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/devis/new" element={<ProtectedRoute><PageTransition><SalesDevisNew /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/devis/:id" element={<ProtectedRoute><PageTransition><SalesDevisView /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/devis/:id/edit" element={<ProtectedRoute><PageTransition><SalesDevisEdit /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-commande" element={<ProtectedRoute><PageTransition><SalesBonCommande /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-commande/new" element={<ProtectedRoute><PageTransition><SalesBonCommandeNew /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-commande/:id" element={<ProtectedRoute><PageTransition><SalesBonCommandeView /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-commande/:id/edit" element={<ProtectedRoute><PageTransition><SalesBonCommandeEdit /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-livraison" element={<ProtectedRoute><PageTransition><SalesBonLivraison /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-livraison/new" element={<ProtectedRoute><PageTransition><SalesBonLivraisonNew /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-livraison/:id" element={<ProtectedRoute><PageTransition><SalesBonLivraisonView /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-livraison/:id/edit" element={<ProtectedRoute><PageTransition><SalesBonLivraisonEdit /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/credit" element={<ProtectedRoute><PageTransition><SalesFactureCredit /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/credit/new" element={<ProtectedRoute><PageTransition><SalesFactureCreditNew /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/credit/:id" element={<ProtectedRoute><PageTransition><SalesFactureCreditView /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/credit/:id/edit" element={<ProtectedRoute><PageTransition><SalesFactureCreditEdit /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/recu" element={<ProtectedRoute><PageTransition><SalesFacturePayee /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/recu/new" element={<ProtectedRoute><PageTransition><SalesFacturePayeeNew /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/recu/:id" element={<ProtectedRoute><PageTransition><SalesFacturePayeeView /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/recu/:id/edit" element={<ProtectedRoute><PageTransition><SalesFacturePayeeEdit /></PageTransition></ProtectedRoute>} />

      <Route path="/invoices/avoir" element={<ProtectedRoute><PageTransition><SalesFactureAvoir /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/avoir/new" element={<ProtectedRoute><PageTransition><SalesFactureAvoirNew /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/avoir/:id" element={<ProtectedRoute><PageTransition><SalesFactureAvoirView /></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/avoir/:id/edit" element={<ProtectedRoute><PageTransition><SalesFactureAvoirEdit /></PageTransition></ProtectedRoute>} />
      
      {/* Purchase invoice routes */}
      <Route path="/purchases" element={<ProtectedRoute><PageTransition><Purchases /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-commande" element={<ProtectedRoute><PageTransition><PurchaseBonCommande /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-commande/new" element={<ProtectedRoute><PageTransition><PurchaseBonCommandeNew /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-commande/:id" element={<ProtectedRoute><PageTransition><PurchaseBonCommandeView /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-commande/:id/edit" element={<ProtectedRoute><PageTransition><PurchaseBonCommandeEdit /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-livraison" element={<ProtectedRoute><PageTransition><PurchaseBonLivraison /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-livraison/new" element={<ProtectedRoute><PageTransition><PurchaseBonLivraisonNew /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-livraison/:id" element={<ProtectedRoute><PageTransition><PurchaseBonLivraisonView /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-livraison/:id/edit" element={<ProtectedRoute><PageTransition><PurchaseBonLivraisonEdit /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/credit" element={<ProtectedRoute><PageTransition><PurchaseFactureCredit /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/credit/new" element={<ProtectedRoute><PageTransition><PurchaseFactureCreditNew /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/credit/:id" element={<ProtectedRoute><PageTransition><PurchaseFactureCreditView /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/credit/:id/edit" element={<ProtectedRoute><PageTransition><PurchaseFactureCreditEdit /></PageTransition></ProtectedRoute>} />

      <Route path="/purchases/avoir" element={<ProtectedRoute><PageTransition><PurchaseAvoir /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/avoir/new" element={<ProtectedRoute><PageTransition><PurchaseAvoirNew /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/avoir/:id" element={<ProtectedRoute><PageTransition><PurchaseAvoirView /></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/avoir/:id/edit" element={<ProtectedRoute><PageTransition><PurchaseAvoirEdit /></PageTransition></ProtectedRoute>} />
      
      {/* Stock routes */}
      <Route path="/stock/produits" element={<ProtectedRoute><PageTransition><StockProducts /></PageTransition></ProtectedRoute>} />
      <Route path="/stock/mouvements" element={<ProtectedRoute><PageTransition><StockMovements /></PageTransition></ProtectedRoute>} />
      
      {/* Protected routes - locked for cashier role */}
      <Route path="/journal" element={<ProtectedRoute><ModuleProtectedRoute><PageTransition><Journal /></PageTransition></ModuleProtectedRoute></ProtectedRoute>} />
      <Route path="/accounts" element={<ProtectedRoute><ModuleProtectedRoute><PageTransition><Accounts /></PageTransition></ModuleProtectedRoute></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ModuleProtectedRoute><PageTransition><Reports /></PageTransition></ModuleProtectedRoute></ProtectedRoute>} />
      <Route path="/settings/utilisateurs" element={<ProtectedRoute><ModuleProtectedRoute><PageTransition><SettingsUsers /></PageTransition></ModuleProtectedRoute></ProtectedRoute>} />
      
      {/* Super admin routes */}
      <Route
        path="/hamzafacturation"
        element={
          <ProtectedRoute>
            <SuperAdminRoute>
              <PageTransition>
                <SuperAdminDashboard />
              </PageTransition>
            </SuperAdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/hamzafacturation/plans"
        element={
          <ProtectedRoute>
            <SuperAdminRoute>
              <PageTransition>
                <AdminPlans />
              </PageTransition>
            </SuperAdminRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/hamzafacturation/utilisateurs"
        element={
          <ProtectedRoute>
            <SuperAdminRoute>
              <PageTransition>
                <AdminUsers />
              </PageTransition>
            </SuperAdminRoute>
          </ProtectedRoute>
        }
      />
      {/* 404 */}
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
