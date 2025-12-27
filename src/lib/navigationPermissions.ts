import { NavigationModule, NavigationRole, getLockedRoutes } from '@/config/navigationConfig';

/**
 * Check if a module is locked for a specific role
 */
export function isModuleLocked(module: NavigationModule, role: NavigationRole | null | undefined): boolean {
  if (!role) return false;
  return module.lockedForRoles?.includes(role) ?? false;
}

/**
 * Check if a module is accessible for a role
 * A module is accessible if it's not locked and (has no allowedRoles OR role is in allowedRoles)
 */
export function canAccessModule(module: NavigationModule, role: NavigationRole | null | undefined): boolean {
  if (!role) return true; // If no role, allow access (will be handled by auth)
  
  // Check if locked
  if (isModuleLocked(module, role)) {
    return false;
  }
  
  // Check allowed roles (if specified)
  if (module.allowedRoles && module.allowedRoles.length > 0) {
    return module.allowedRoles.includes(role);
  }
  
  return true;
}

/**
 * Check if a route is accessible for a role
 */
export function canAccessRoute(route: string, role: NavigationRole | null | undefined): boolean {
  if (!role) return true;
  
  const lockedRoutes = getLockedRoutes(role);
  return !lockedRoutes.includes(route);
}

/**
 * Get all locked routes for a role
 */
export function getLockedRoutesForRole(role: NavigationRole | null | undefined): string[] {
  if (!role) return [];
  return getLockedRoutes(role);
}
