import { navigationConfig, type NavigationModule } from '@/config/navigationConfig';

export type RoutePermission = { moduleId: string; subModuleId?: string };

function findPermissionForPath(modules: NavigationModule[], path: string, parent?: NavigationModule): RoutePermission | null {
  for (const m of modules) {
    if (m.href && m.href === path) {
      return parent ? { moduleId: parent.id, subModuleId: m.id } : { moduleId: m.id };
    }
    if (m.children) {
      const hit = findPermissionForPath(m.children, path, m);
      if (hit) return hit;
    }
  }
  return null;
}

export function getRoutePermission(path: string): RoutePermission | null {
  return findPermissionForPath(navigationConfig, path);
}
