// Centralized role and permission guards
export type AppRole = 'admin' | 'manager' | 'accountant' | 'cashier' | null | undefined;

export const ROLE_LABELS: Record<Exclude<AppRole, null | undefined>, string> = {
  admin: 'Admin',
  manager: 'Gérant',
  accountant: 'Comptable',
  cashier: 'Caissier',
};

// Stock: who can add/edit products
export function canManageProducts(role: AppRole): boolean {
  return role === 'admin' || role === 'manager' || role === 'accountant';
}

// Stock: who can delete products (if you want tighter control)
export function canDeleteProducts(role: AppRole): boolean {
  return role === 'admin' || role === 'manager';
}

// Stock movements: who can create movements
export function canCreateMovements(role: AppRole): boolean {
  // Admin, Manager, Accountant can create adjustments; Cashier only via sales (handled separately)
  return role === 'admin' || role === 'manager' || role === 'accountant';
}

// Cashier: can decrement stock via sales only
export function canDecrementViaSales(role: AppRole): boolean {
  return role === 'cashier';
}

// Generic no-permission message (French)
export const NO_PERMISSION_MSG = "Vous n’avez pas l’autorisation d’effectuer cette action.";

// Settings: who can access and manage users & roles
export function canManageUsers(role: AppRole): boolean {
  return role === 'admin' || role === 'manager';
}

// Can assign a target role (Gérant cannot assign/supprimer Admin)
export function canAssignRole(actor: AppRole, targetRole: Exclude<AppRole, null | undefined>): boolean {
  if (actor === 'admin') return true;
  if (actor === 'manager') return targetRole !== 'admin';
  return false;
}

export function canDeleteUser(actor: AppRole, targetRole: Exclude<AppRole, null | undefined>): boolean {
  if (actor === 'admin') return true;
  if (actor === 'manager') return targetRole !== 'admin';
  return false;
}

export const NO_ACCESS_MSG = "Vous n’avez pas l’autorisation d’accéder à cette section.";
