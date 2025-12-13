import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  Truck,
  FileText,
  LogOut,
  Menu,
  X,
  Shield,
  Settings,
  FolderOpen,
  CreditCard,
  BookOpen,
  Landmark,
  BarChart3,
  Boxes,
  MoveUpRight,
  ChevronDown,
} from 'lucide-react';
// Collapsible removed for reliability; static sections used

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Fournisseurs', href: '/suppliers', icon: Truck },
  { name: 'Factures', href: '/invoices', icon: FileText },
  { name: 'Documents', href: '/documents', icon: FolderOpen },
  { name: 'Paiements', href: '/payments', icon: CreditCard },
  { name: 'Journal', href: '/journal', icon: BookOpen },
  { name: 'Comptes', href: '/accounts', icon: Landmark },
  { name: 'Rapports', href: '/reports', icon: BarChart3 },
  { name: 'Produits', href: '/stock/produits', icon: Boxes },
  { name: 'Mouvements', href: '/stock/mouvements', icon: MoveUpRight },
];

const adminNavigation = [
  { name: 'Utilisateurs', href: '/users', icon: Shield },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Collapsible state removed

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar wrapper: header + scrollable nav + footer */}
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between px-6 border-b">
            <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
                <FileText className="h-6 w-6 text-primary" />
                <span>Facture Pro</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
            {/* Scrollable menu; add bottom padding so footer doesn't overlap */}
            <nav className="flex-1 flex flex-col gap-1 p-4 overflow-y-auto pb-24">
              {navigation
                .filter(n => !n.href.startsWith('/stock/'))
                .map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  );
                })}
          {/* Section: Stock */}
          <div className="my-2 border-t" />
          <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">Stock</p>
          {navigation
            .filter(n => n.href.startsWith('/stock/'))
            .map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}

          {role === 'admin' && (
            <>
              <div className="my-2 border-t" />
              <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">Administration</p>
              {adminNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </>
          )}
        </nav>
        {/* Footer area (static inside flow to avoid overlapping items) */}
        <div className="p-4 border-t bg-card">

          <Link
            to="/settings"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors mb-2",
              location.pathname === "/settings"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Settings className="h-4 w-4" />
            Paramètres
          </Link>

          <div className="flex items-center gap-3 mb-3 px-3">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {user?.email?.[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
          </div>
         
          <Button
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-3" />
            Déconnexion
          </Button>
        </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-4 bg-background px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="font-semibold">Facture Pro</span>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
