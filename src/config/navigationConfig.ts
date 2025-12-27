import {
  LayoutDashboard,
  Users,
  Truck,
  FileText,
  FolderOpen,
  CreditCard,
  BookOpen,
  Landmark,
  BarChart3,
  Boxes,
  MoveUpRight,
  FileEdit,
  ClipboardList,
  Package,
  Receipt,
  FileCheck,
  LucideIcon,
} from 'lucide-react';

// Role type matching the app_role enum in the database
export type NavigationRole = 'admin' | 'manager' | 'accountant' | 'cashier';

export interface NavigationModule {
  id: string;
  name: string;
  href?: string;
  icon: LucideIcon;
  // If empty array or undefined, all roles can access
  allowedRoles?: NavigationRole[];
  // Roles that see the module as locked (disabled with lock icon)
  lockedForRoles?: NavigationRole[];
  children?: NavigationModule[];
}

// Main navigation configuration
export const navigationConfig: NavigationModule[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    id: 'clients',
    name: 'Clients',
    href: '/clients',
    icon: Users,
  },
  {
    id: 'fournisseurs',
    name: 'Fournisseurs',
    href: '/suppliers',
    icon: Truck,
  },
  {
    id: 'factures',
    name: 'Factures',
    icon: FileText,
    children: [
      {
        id: 'devis',
        name: 'Devis',
        href: '/invoices/devis',
        icon: FileEdit,
      },
      {
        id: 'bon-commande',
        name: 'Bon de commande',
        href: '/invoices/bon-commande',
        icon: ClipboardList,
      },
      {
        id: 'bon-livraison',
        name: 'Bon de livraison',
        href: '/invoices/bon-livraison',
        icon: Package,
      },
      {
        id: 'facture-credit',
        name: 'Facture à crédit',
        href: '/invoices/credit',
        icon: Receipt,
      },
      {
        id: 'facture-recu',
        name: 'Facture payée / Reçu',
        href: '/invoices/recu',
        icon: FileCheck,
      },
    ],
  },
  {
    id: 'documents',
    name: 'Documents',
    href: '/documents',
    icon: FolderOpen,
  },
  {
    id: 'paiements',
    name: 'Paiements',
    href: '/payments',
    icon: CreditCard,
  },
  {
    id: 'journal',
    name: 'Journal',
    href: '/journal',
    icon: BookOpen,
    lockedForRoles: ['cashier'],
  },
  {
    id: 'comptes',
    name: 'Comptes',
    href: '/accounts',
    icon: Landmark,
    lockedForRoles: ['cashier'],
  },
  {
    id: 'rapports',
    name: 'Rapports',
    href: '/reports',
    icon: BarChart3,
    lockedForRoles: ['cashier'],
  },
  {
    id: 'stock',
    name: 'Stock',
    icon: Boxes,
    children: [
      {
        id: 'produits',
        name: 'Produits',
        href: '/stock/produits',
        icon: Boxes,
      },
      {
        id: 'mouvements',
        name: 'Mouvements',
        href: '/stock/mouvements',
        icon: MoveUpRight,
      },
    ],
  },
  {
    id: 'administration',
    name: 'Administration',
    icon: Users,
    lockedForRoles: ['cashier'],
    children: [
      {
        id: 'utilisateurs',
        name: 'Utilisateurs',
        href: '/settings/utilisateurs',
        icon: Users,
      },
    ],
  },
];

// Get all routes that should be protected for cashier role
export function getLockedRoutes(role: NavigationRole): string[] {
  const routes: string[] = [];
  
  function collectRoutes(modules: NavigationModule[]) {
    for (const module of modules) {
      if (module.lockedForRoles?.includes(role)) {
        if (module.href) {
          routes.push(module.href);
        }
        // If parent is locked, all children are locked too
        if (module.children) {
          for (const child of module.children) {
            if (child.href) {
              routes.push(child.href);
            }
          }
        }
      } else if (module.children) {
        collectRoutes(module.children);
      }
    }
  }
  
  collectRoutes(navigationConfig);
  return routes;
}
