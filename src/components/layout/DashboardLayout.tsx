import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySettings } from '@/hooks/useCompanySettings';
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
  ChevronDown,
  UserCog,
  Lock,
  Users,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ImpersonationBanner } from './ImpersonationBanner';
import { navigationConfig, NavigationModule } from '@/config/navigationConfig';
import { hasAnyAccessInModule } from '@/lib/companyPermissions';

// Super admin navigation (separate from main config)
const superAdminNavigation = [
  { name: 'Super Admin Dashboard', href: '/hamzafacturation', icon: Shield },
  { name: 'Plans', href: '/hamzafacturation/plans', icon: Users },
  { name: 'Utilisateurs globaux', href: '/hamzafacturation/utilisateurs', icon: UserCog },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, profile, globalRole, activeCompanyId, activeCompanyPermissions, canAccess, signOut, isImpersonating, impersonatedUser, stopImpersonation, loading: authLoading } = useAuth();
  const isSuperAdmin = globalRole === 'SUPER_ADMIN';
  const { companySettings, loading: companySettingsLoading } = useCompanySettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [exitingImpersonation, setExitingImpersonation] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>({});

  // Force the initial setup wizard for unconfigured companies.
  // The wizard itself is rendered from the Settings page; we redirect there from any protected page.
  useEffect(() => {
    // Never block super-admin area with company setup.
    if (isSuperAdmin && location.pathname.startsWith('/hamzafacturation')) return;
    // Wait for auth to finish resolving activeCompanyId/user.
    if (authLoading) return;
    if (!user) return;
    if (companySettingsLoading) return;

    // If the user has no company yet, force them into Settings (wizard will create it).
    if (!activeCompanyId && location.pathname !== '/settings') {
      navigate('/settings', { replace: true });
      return;
    }
    if (companySettings && companySettings.is_configured === false && location.pathname !== '/settings') {
      navigate('/settings', { replace: true });
    }
  }, [activeCompanyId, authLoading, companySettings, companySettingsLoading, isSuperAdmin, location.pathname, navigate, user]);

  // Get user initials for avatar
  const getUserInitials = () => {
    const name = profile?.full_name || user?.user_metadata?.full_name || user?.email || '';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

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

  // Auto-open dropdowns that contain the active route.
  // Do not auto-close them; closing is a user action.
  // If the user explicitly closed a dropdown, keep it closed even if a child is active.
  useEffect(() => {
    if (isSuperAdmin) return;

    const idsToOpen: string[] = [];
    const visit = (modules: NavigationModule[]) => {
      for (const m of modules) {
        if (m.children && isChildActive(m.children)) {
          idsToOpen.push(m.id);
        }
        if (m.children) visit(m.children);
      }
    };

    visit(navigationConfig);
    if (idsToOpen.length === 0) return;

    setOpenDropdowns((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of idsToOpen) {
        if (prev[id] === undefined) {
          next[id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [isSuperAdmin, location.pathname]);

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
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
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

  // Dropdown nav item (with children)
  const NavItemDropdown = ({ item, onClick }: { 
    item: NavigationModule; 
    onClick?: () => void;
  }) => {
    const Icon = item.icon;
    const hasActiveChild = isChildActive(item.children);
    const isOpen = openDropdowns[item.id] ?? hasActiveChild;

    // In collapsed mode, show only icon with tooltip listing children
    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center justify-center px-2 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                hasActiveChild
                  ? "bg-primary/20 text-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
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
      <Collapsible
        open={isOpen}
        onOpenChange={(open) => setOpenDropdowns((prev) => ({ ...prev, [item.id]: open }))}
      >
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full",
              hasActiveChild
                ? "bg-primary/20 text-primary"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
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

  // Render a module based on its type and permissions
  const renderModule = (module: NavigationModule, onClick?: () => void) => {
    // If has children, render as dropdown
    if (module.children) {
      // Show module only if user has access to the module itself or any child.
      if (!hasAnyAccessInModule(activeCompanyPermissions, module.id)) return null;
      const filteredChildren = module.children.filter((c) => canAccess(module.id, c.id));
      if (filteredChildren.length === 0) return null;

      return (
        <NavItemDropdown
          key={module.id}
          item={{ ...module, children: filteredChildren }}
          onClick={onClick}
        />
      );
    }

    // Regular item
    if (module.href) {
      if (!canAccess(module.id)) return null;
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
            "fixed inset-y-0 left-0 z-50 bg-[#324052] text-sidebar-foreground border-r border-sidebar-border transform transition-transform duration-300 ease-in-out lg:translate-x-0 will-change-transform",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            collapsed ? "w-16" : "w-64"
          )}
          aria-hidden={!sidebarOpen}
        >
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className={cn(
              "flex h-14 items-center border-b border-border/50 px-3",
              collapsed ? "justify-center" : "justify-between px-4"
            )}>
              {!collapsed && (
                <Link to="/" className="flex items-center gap-2 font-semibold text-lg text-sidebar-foreground">
                  {/* <FileText className="h-5 w-5 text-primary" /> */}
                  <img src="/logo2.png" alt="SmartFin Logo" className="h-6 w-6" />
                  <span>SmartFin</span>
                </Link>
              )}
              {collapsed && (
                <Link to="/" className="flex items-center justify-center">
                  {/* <FileText className="h-5 w-5 text-primary" /> */}
                  <img src="/logo2.png" alt="SmartFin Logo" className="h-6 w-6" />
                </Link>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden transition-transform duration-200 ease-out active:scale-95 text-sidebar-foreground hover:bg-sidebar-accent/50"
                onClick={() => setSidebarOpen(false)}
                aria-label="Fermer le menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 flex flex-col gap-1 p-2 overflow-y-auto sidebar-nav">
              {isSuperAdmin ? (
                <>
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


            {/* Collapse Toggle - Desktop only */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'absolute -right-3 top-16 h-6 w-6 rounded-full border bg-background shadow-sm hidden lg:flex',
                'text-foreground',
                'transition-transform duration-300 ease-in-out will-change-transform',
                'hover:scale-110 active:scale-95',
              )}
              onClick={() => setCollapsed(!collapsed)}
            >
              <ChevronLeft
                className={cn(
                  'h-3 w-3 transition-transform duration-300 ease-in-out',
                  collapsed && 'rotate-180',
                )}
              />
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <div className={cn(
          "transition-all duration-300",
          collapsed ? "lg:pl-16" : "lg:pl-64"
        )}>
          {/* Top Header Navbar - Desktop and Mobile */}
          <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-14 items-center justify-between px-4">
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                aria-label="Ouvrir le menu"
                className="lg:hidden transition-transform duration-200 ease-out active:scale-95"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              {/* Logo for mobile */}
              <span className="font-semibold lg:hidden">SmartFin</span>
              
              {/* Spacer for desktop */}
              <div className="hidden lg:block" />
              
              {/* User Avatar Dropdown - Right side */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9 border-2 border-primary/20">
                      <AvatarImage src="" alt={profile?.full_name || user?.email || ''} />
                      <AvatarFallback className="bg-primary/20 text-primary font-medium">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card" align="end" forceMount>
                  {!isSuperAdmin && (
                    <>
                      <DropdownMenuItem asChild className="cursor-pointer">
                        <Link to="/settings" className="flex items-center gap-3 text-foreground">
                          <Settings className="h-4 w-4" />
                          <span>Paramètres</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-border" />
                    </>
                  )}
                  <DropdownMenuItem asChild className="cursor-pointer">
                    <Link to="/account" className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium text-primary uppercase truncate">
                        {profile?.full_name || user?.user_metadata?.full_name || user?.email}
                      </span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem 
                    onClick={handleSignOut}
                    className="cursor-pointer text-foreground"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    <span>Déconnexion</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="p-6">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
