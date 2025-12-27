import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  FileText,
  LogOut,
  Menu,
  X,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UserCog,
  Lock,
  Users,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ImpersonationBanner } from './ImpersonationBanner';
import { navigationConfig, NavigationModule, NavigationRole } from '@/config/navigationConfig';
import { isModuleLocked } from '@/lib/navigationPermissions';

// Super admin navigation (separate from main config)
const superAdminNavigation = [
  { name: 'Espace Super Admin', href: '/hamzafacturation', icon: Shield },
  { name: 'Plans', href: '/hamzafacturation/plans', icon: Users },
  { name: 'Utilisateurs globaux', href: '/hamzafacturation/utilisateurs', icon: UserCog },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, profile, role, globalRole, signOut, isImpersonating, impersonatedUser, stopImpersonation } = useAuth();
  const isSuperAdmin = globalRole === 'SUPER_ADMIN';
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [exitingImpersonation, setExitingImpersonation] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});

  const navigationRole = role as NavigationRole | null | undefined;

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleExitImpersonation = async () => {
    setExitingImpersonation(true);
    try {
      await stopImpersonation();
      navigate('/hamzafacturation/utilisateurs');
    } finally {
      setExitingImpersonation(false);
    }
  };

  const toggleDropdown = (id: string) => {
    setOpenDropdowns(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Check if any child route is active
  const isChildActive = (children: NavigationModule[] | undefined) => {
    if (!children) return false;
    return children.some(child => child.href && location.pathname === child.href);
  };

  // Regular nav item (no children)
  const NavItem = ({ item, onClick, indent = false }: { 
    item: { name: string; href: string; icon: React.ElementType }; 
    onClick?: () => void;
    indent?: boolean;
  }) => {
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
          collapsed && "justify-center px-2",
          indent && !collapsed && "pl-9"
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

  // Locked nav item (disabled with lock icon)
  const NavItemLocked = ({ item }: { item: NavigationModule }) => {
    const Icon = item.icon;
    
    const lockedContent = (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium opacity-50 cursor-not-allowed",
          "text-muted-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1">{item.name}</span>
            <Lock className="h-3 w-3" />
          </>
        )}
      </div>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{lockedContent}</TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {item.name} (Accès restreint)
          </TooltipContent>
        </Tooltip>
      );
    }

    return lockedContent;
  };

  // Dropdown nav item (with children)
  const NavItemDropdown = ({ item, onClick }: { 
    item: NavigationModule; 
    onClick?: () => void;
  }) => {
    const Icon = item.icon;
    const isOpen = openDropdowns[item.id] || false;
    const hasActiveChild = isChildActive(item.children);

    // In collapsed mode, show only icon with tooltip listing children
    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center justify-center px-2 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                hasActiveChild
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              onClick={() => toggleDropdown(item.id)}
            >
              <Icon className="h-4 w-4 shrink-0" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            <div className="space-y-1">
              <p className="font-semibold">{item.name}</p>
              {item.children?.map(child => (
                <Link
                  key={child.id}
                  to={child.href!}
                  className="block text-sm hover:text-primary"
                  onClick={onClick}
                >
                  {child.name}
                </Link>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Collapsible open={isOpen} onOpenChange={() => toggleDropdown(item.id)}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full",
              hasActiveChild
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{item.name}</span>
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform duration-200",
              isOpen && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-1 mt-1">
          {item.children?.map(child => (
            <NavItem 
              key={child.id} 
              item={{ name: child.name, href: child.href!, icon: child.icon }} 
              onClick={onClick}
              indent
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Render a module based on its type and role
  const renderModule = (module: NavigationModule, onClick?: () => void) => {
    // Check if module is locked for this role
    if (isModuleLocked(module, navigationRole)) {
      return <NavItemLocked key={module.id} item={module} />;
    }

    // If has children, render as dropdown
    if (module.children) {
      return <NavItemDropdown key={module.id} item={module} onClick={onClick} />;
    }

    // Regular item
    if (module.href) {
      return (
        <NavItem 
          key={module.id} 
          item={{ name: module.name, href: module.href, icon: module.icon }} 
          onClick={onClick}
        />
      );
    }

    return null;
  };

  return (
    <TooltipProvider>
      {/* Impersonation Banner - Fixed at top when impersonating */}
      {isImpersonating && impersonatedUser && (
        <ImpersonationBanner
          targetEmail={impersonatedUser.email}
          targetName={impersonatedUser.profile?.full_name}
          onExit={handleExitImpersonation}
        />
      )}
      
      <div className={cn("min-h-screen bg-background", isImpersonating && "pt-10")}>
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
              {isSuperAdmin ? (
                <>
                  <div className="my-2 border-t" />
                  {!collapsed && (
                    <p className="px-3 py-1 text-xs font-semibold text-muted-foreground uppercase">Administration</p>
                  )}
                  {superAdminNavigation.map((item) => (
                    <NavItem key={item.name} item={item} onClick={() => setSidebarOpen(false)} />
                  ))}
                </>
              ) : (
                <>
                  {navigationConfig.map(module => renderModule(module, () => setSidebarOpen(false)))}
                </>
              )}
            </nav>

            {/* Footer */}
            <div className="p-2 border-t bg-card">
              {/* Hide Settings for Super Admin - they manage platform, not their own company */}
              {!isSuperAdmin && (
                <NavItem 
                  item={{ name: 'Paramètres', href: '/settings', icon: Settings }} 
                  onClick={() => setSidebarOpen(false)} 
                />
              )}

              {!collapsed && (
                <div className="flex items-center gap-3 my-3 px-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-primary">
                      {(profile?.full_name || user?.user_metadata?.full_name || user?.email || '').split('').filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary font-medium truncate uppercase">
                      {profile?.full_name || user?.user_metadata?.full_name || user?.email}
                    </p>
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

          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
