import { ReactNode, useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
];

const stockNavigation = [
  { name: 'Produits', href: '/stock/produits', icon: Boxes },
  { name: 'Mouvements', href: '/stock/mouvements', icon: MoveUpRight },
];

const adminNavigation = [
  { name: 'Espace Admin', href: '/hamzafacturation', icon: Shield },
  { name: 'Utilisateurs', href: '/settings/utilisateurs', icon: Users },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const NavItem = ({ item, onClick }: { item: { name: string; href: string; icon: React.ElementType }; onClick?: () => void }) => {
    const isActive = location.pathname === item.href;
    const Icon = item.icon;
    
    const linkContent = (
      <Link
        to={item.href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span>{item.name}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.name}
          </TooltipContent>
        </Tooltip>
      );
    }

    return linkContent;
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Mobile sidebar backdrop with smooth fade */}
        <div
          className={cn(
            "fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ease-in-out",
            sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        >
          <div className="w-full h-full bg-background/80 backdrop-blur-sm" />
        </div>

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 bg-card border-r transform transition-transform duration-300 ease-in-out lg:translate-x-0 will-change-transform",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            collapsed ? "w-16" : "w-64"
          )}
          aria-hidden={!sidebarOpen}
        >
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className={cn(
              "flex h-14 items-center border-b px-3",
              collapsed ? "justify-center" : "justify-between px-4"
            )}>
              {!collapsed && (
                <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  <span>Facture Pro</span>
                </Link>
              )}
              {collapsed && (
                <Link to="/" className="flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </Link>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden transition-transform duration-200 ease-out active:scale-95"
                onClick={() => setSidebarOpen(false)}
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto">
              {navigation.map((item) => (
                <NavItem key={item.name} item={item} onClick={() => setSidebarOpen(false)} />
              ))}

              {/* Stock Section */}
              <div className="my-2 border-t" />
              {!collapsed && (
                <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">Stock</p>
              )}
              {stockNavigation.map((item) => (
                <NavItem key={item.name} item={item} onClick={() => setSidebarOpen(false)} />
              ))}

              {/* Admin Section */}
              {role === 'admin' && (
                <>
                  <div className="my-2 border-t" />
                  {!collapsed && (
                    <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">Administration</p>
                  )}
                  {adminNavigation.map((item) => (
                    <NavItem key={item.name} item={item} onClick={() => setSidebarOpen(false)} />
                  ))}
                </>
              )}
            </nav>

            {/* Footer */}
            <div className="p-2 border-t bg-card">
              <NavItem 
                item={{ name: 'Paramètres', href: '/settings', icon: Settings }} 
                onClick={() => setSidebarOpen(false)} 
              />

              {!collapsed && (
                <div className="flex items-center gap-3 my-3 px-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-primary">
                      {user?.email?.[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user?.email}</p>
                  </div>
                </div>
              )}

              {collapsed ? (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-full text-muted-foreground"
                      onClick={handleSignOut}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Déconnexion</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full justify-start text-muted-foreground"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4 mr-3" />
                  Déconnexion
                </Button>
              )}
            </div>

            {/* Collapse Toggle - Desktop only */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute -right-3 top-16 h-6 w-6 rounded-full border bg-background shadow-sm hidden lg:flex"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <div className={cn(
          "transition-all duration-300",
          collapsed ? "lg:pl-16" : "lg:pl-64"
        )}>
          {/* Mobile header */}
          <header className="sticky top-0 z-30 flex h-12 items-center gap-4 bg-background border-b px-4 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
              className="transition-transform duration-200 ease-out active:scale-95"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-semibold">Facture Pro</span>
          </header>

          <main className="p-6">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
