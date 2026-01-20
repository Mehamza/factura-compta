import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, createRoutesFromElements, RouterProvider, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { SuperAdminRoute } from "@/components/layout/ProtectedRoute";
import { ModuleProtectedRoute } from "@/components/layout/ModuleProtectedRoute";
import { SpeedInsights } from "@vercel/speed-insights/react";
import PublicLayout from "@/components/layout/PublicLayout";

const queryClient = new QueryClient();

const Index = lazy(() => import("./pages/Index"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Clients = lazy(() => import("./pages/Clients"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Invoices = lazy(() => import("./pages/Invoices"));
const Purchases = lazy(() => import("./pages/Purchases"));

// Sales documents
const SalesDevis = lazy(() => import("./pages/documents/SalesDevis"));
const SalesDevisNew = lazy(() => import("./pages/documents/SalesDevisNew"));
const SalesDevisView = lazy(() => import("./pages/documents/SalesDevisView"));
const SalesDevisEdit = lazy(() => import("./pages/documents/SalesDevisEdit"));
const SalesBonCommande = lazy(() => import("./pages/documents/SalesBonCommande"));
const SalesBonCommandeNew = lazy(() => import("./pages/documents/SalesBonCommandeNew"));
const SalesBonCommandeView = lazy(() => import("./pages/documents/SalesBonCommandeView"));
const SalesBonCommandeEdit = lazy(() => import("./pages/documents/SalesBonCommandeEdit"));
const SalesBonLivraison = lazy(() => import("./pages/documents/SalesBonLivraison"));
const SalesBonLivraisonNew = lazy(() => import("./pages/documents/SalesBonLivraisonNew"));
const SalesBonLivraisonView = lazy(() => import("./pages/documents/SalesBonLivraisonView"));
const SalesBonLivraisonEdit = lazy(() => import("./pages/documents/SalesBonLivraisonEdit"));

// Facture unifiée (remplace facture_credit + facture_payee)
const SalesFacture = lazy(() => import("./pages/documents/SalesFacture"));
const SalesFactureNew = lazy(() => import("./pages/documents/SalesFactureNew"));
const SalesFactureView = lazy(() => import("./pages/documents/SalesFactureView"));
const SalesFactureEdit = lazy(() => import("./pages/documents/SalesFactureEdit"));

// Avoirs
const SalesFactureAvoir = lazy(() => import("./pages/documents/SalesFactureAvoir"));
const SalesFactureAvoirNew = lazy(() => import("./pages/documents/SalesFactureAvoirNew"));
const SalesFactureAvoirView = lazy(() => import("./pages/documents/SalesFactureAvoirView"));
const SalesFactureAvoirEdit = lazy(() => import("./pages/documents/SalesFactureAvoirEdit"));

// Purchase documents
const PurchaseBonCommande = lazy(() => import("./pages/documents/PurchaseBonCommande"));
const PurchaseBonCommandeNew = lazy(() => import("./pages/documents/PurchaseBonCommandeNew"));
const PurchaseBonCommandeView = lazy(() => import("./pages/documents/PurchaseBonCommandeView"));
const PurchaseBonCommandeEdit = lazy(() => import("./pages/documents/PurchaseBonCommandeEdit"));
const PurchaseBonLivraison = lazy(() => import("./pages/documents/PurchaseBonLivraison"));
const PurchaseBonLivraisonNew = lazy(() => import("./pages/documents/PurchaseBonLivraisonNew"));
const PurchaseBonLivraisonView = lazy(() => import("./pages/documents/PurchaseBonLivraisonView"));
const PurchaseBonLivraisonEdit = lazy(() => import("./pages/documents/PurchaseBonLivraisonEdit"));

// Facture d'achat unifiée (remplace facture_credit_achat)
const PurchaseFacture = lazy(() => import("./pages/documents/PurchaseFacture"));
const PurchaseFactureNew = lazy(() => import("./pages/documents/PurchaseFactureNew"));
const PurchaseFactureView = lazy(() => import("./pages/documents/PurchaseFactureView"));
const PurchaseFactureEdit = lazy(() => import("./pages/documents/PurchaseFactureEdit"));

// Avoirs achats
const PurchaseAvoir = lazy(() => import("./pages/documents/PurchaseAvoir"));
const PurchaseAvoirNew = lazy(() => import("./pages/documents/PurchaseAvoirNew"));
const PurchaseAvoirView = lazy(() => import("./pages/documents/PurchaseAvoirView"));
const PurchaseAvoirEdit = lazy(() => import("./pages/documents/PurchaseAvoirEdit"));

// Other pages
const Documents = lazy(() => import("./pages/Documents"));
const Users = lazy(() => import("./pages/Users"));
const Settings = lazy(() => import("./pages/Settings"));
const SettingsUsers = lazy(() => import("./pages/SettingsUsers"));
const Account = lazy(() => import("./pages/Account"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Payments = lazy(() => import("./pages/Payments"));
const Journal = lazy(() => import("./pages/Journal"));
const Accounts = lazy(() => import("./pages/Accounts"));
const AccountsBalance = lazy(() => import("./pages/AccountsBalance"));
const Reports = lazy(() => import("./pages/Reports"));
const StockProducts = lazy(() => import("./pages/StockProducts"));
const StockMovements = lazy(() => import("./pages/StockMovements"));
const StockTransfer = lazy(() => import("./pages/StockTransfer"));
const StockEntry = lazy(() => import("./pages/StockEntry"));
const Warehouses = lazy(() => import("./pages/Warehouses"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminPlans = lazy(() => import("./pages/AdminPlans"));
const Tarif = lazy(() => import("./pages/Tarif"));
const Contact = lazy(() => import("./pages/Contact"));



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
      <Route path="/" element={<PublicLayout><Suspense fallback={null}><LandingPage /></Suspense></PublicLayout>} />
      <Route path="/auth" element={<PublicLayout><Suspense fallback={null}><Auth /></Suspense></PublicLayout>} />
      <Route path="/auth/callback" element={<PublicLayout><Suspense fallback={null}><AuthCallback /></Suspense></PublicLayout>} />
      <Route path="/tarif" element={<PublicLayout><PageTransition><Suspense fallback={null}><Tarif /></Suspense></PageTransition></PublicLayout>} />
      <Route path="/contact" element={<PublicLayout><PageTransition><Suspense fallback={null}><Contact /></Suspense></PageTransition></PublicLayout>} />
      <Route path="/blog" element={<PublicLayout><div>Blog page coming soon</div></PublicLayout>} />
      
      {/* Protected routes - accessible by all roles */}
      <Route path="/dashboard" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><Index /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><Clients /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/suppliers" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><Suppliers /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><Documents /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><Settings /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><Account /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><Payments /></Suspense></PageTransition></ProtectedRoute>} />
      
      {/* Sales invoice routes */}
      <Route path="/invoices" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><Invoices /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/devis" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesDevis /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/devis/new" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesDevisNew /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/devis/:id" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesDevisView /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/devis/:id/edit" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesDevisEdit /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-commande" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesBonCommande /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-commande/new" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesBonCommandeNew /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-commande/:id" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesBonCommandeView /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-commande/:id/edit" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesBonCommandeEdit /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-livraison" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesBonLivraison /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-livraison/new" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesBonLivraisonNew /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-livraison/:id" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesBonLivraisonView /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/bon-livraison/:id/edit" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesBonLivraisonEdit /></Suspense></PageTransition></ProtectedRoute>} />
      
      {/* Factures unifiées (nouvelle route) */}
      <Route path="/invoices/facture" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesFacture /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/facture/new" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesFactureNew /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/facture/:id" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesFactureView /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/facture/:id/edit" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesFactureEdit /></Suspense></PageTransition></ProtectedRoute>} />
      
      {/* Redirections legacy pour rétro-compatibilité */}
      <Route path="/invoices/credit" element={<Navigate to="/invoices/facture" replace />} />
      <Route path="/invoices/credit/*" element={<Navigate to="/invoices/facture" replace />} />
      <Route path="/invoices/recu" element={<Navigate to="/invoices/facture" replace />} />
      <Route path="/invoices/recu/*" element={<Navigate to="/invoices/facture" replace />} />

      {/* Avoirs */}
      <Route path="/invoices/avoir" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesFactureAvoir /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/avoir/new" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesFactureAvoirNew /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/avoir/:id" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesFactureAvoirView /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/invoices/avoir/:id/edit" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><SalesFactureAvoirEdit /></Suspense></PageTransition></ProtectedRoute>} />
      
      {/* Purchase invoice routes */}
      <Route path="/purchases" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><Purchases /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-commande" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseBonCommande /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-commande/new" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseBonCommandeNew /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-commande/:id" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseBonCommandeView /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-commande/:id/edit" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseBonCommandeEdit /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-livraison" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseBonLivraison /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-livraison/new" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseBonLivraisonNew /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-livraison/:id" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseBonLivraisonView /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/bon-livraison/:id/edit" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseBonLivraisonEdit /></Suspense></PageTransition></ProtectedRoute>} />
      
      {/* Factures d'achat unifiées (nouvelle route) */}
      <Route path="/purchases/facture" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseFacture /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/facture/new" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseFactureNew /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/facture/:id" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseFactureView /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/facture/:id/edit" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseFactureEdit /></Suspense></PageTransition></ProtectedRoute>} />

      {/* Redirection legacy */}
      <Route path="/purchases/credit" element={<Navigate to="/purchases/facture" replace />} />
      <Route path="/purchases/credit/*" element={<Navigate to="/purchases/facture" replace />} />

      {/* Avoirs achats */}
      <Route path="/purchases/avoir" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseAvoir /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/avoir/new" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseAvoirNew /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/avoir/:id" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseAvoirView /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/purchases/avoir/:id/edit" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><PurchaseAvoirEdit /></Suspense></PageTransition></ProtectedRoute>} />
      
      {/* Stock routes */}
      <Route path="/stock/produits" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><StockProducts /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/stock/mouvements" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><StockMovements /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/stock/entrepots" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><Warehouses /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/stock/bon-transfert" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><StockTransfer /></Suspense></PageTransition></ProtectedRoute>} />
      <Route path="/stock/bon-entree" element={<ProtectedRoute><PageTransition><Suspense fallback={null}><StockEntry /></Suspense></PageTransition></ProtectedRoute>} />
      
      {/* Protected routes - locked for cashier role */}
      <Route path="/journal" element={<ProtectedRoute><ModuleProtectedRoute><PageTransition><Suspense fallback={null}><Journal /></Suspense></PageTransition></ModuleProtectedRoute></ProtectedRoute>} />
      <Route path="/accounts" element={<ProtectedRoute><ModuleProtectedRoute><PageTransition><Suspense fallback={null}><Accounts /></Suspense></PageTransition></ModuleProtectedRoute></ProtectedRoute>} />
      <Route path="/accounts/balance" element={<ProtectedRoute><ModuleProtectedRoute><PageTransition><Suspense fallback={null}><AccountsBalance /></Suspense></PageTransition></ModuleProtectedRoute></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><ModuleProtectedRoute><PageTransition><Suspense fallback={null}><Reports /></Suspense></PageTransition></ModuleProtectedRoute></ProtectedRoute>} />
      <Route path="/settings/utilisateurs" element={<ProtectedRoute><ModuleProtectedRoute><PageTransition><Suspense fallback={null}><SettingsUsers /></Suspense></PageTransition></ModuleProtectedRoute></ProtectedRoute>} />
      
      {/* Super admin routes */}
      <Route
        path="/hamzafacturation"
        element={
          <ProtectedRoute>
            <SuperAdminRoute>
              <PageTransition>
                <Suspense fallback={null}><SuperAdminDashboard /></Suspense>
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
                <Suspense fallback={null}><AdminPlans /></Suspense>
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
                <Suspense fallback={null}><AdminUsers /></Suspense>
              </PageTransition>
            </SuperAdminRoute>
          </ProtectedRoute>
        }
      />
      {/* 404 */}
      <Route path="*" element={<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}><Suspense fallback={null}><NotFound /></Suspense></motion.div>} />
    </Route>
  ),
  {
    future: {
      v7_relativeSplatPath: true,
    },
  },
);

const App = () => (
  <>
    <SpeedInsights/>
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
  </>
);

export default App;
