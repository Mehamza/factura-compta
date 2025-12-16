import { supabase } from '@/integrations/supabase/client';

export type PlanPermissions = Record<string, any>;

export async function fetchPlanPermissions(userId?: string): Promise<PlanPermissions> {
  if (!userId) return {};
  
  // Try to call get_effective_permissions if it exists
  try {
    const { data, error } = await supabase.rpc('get_effective_permissions' as any, { p_user_id: userId });
    if (error) return {};
    return (data as any) || {};
  } catch {
    return {};
  }
}

export function canFeature(perms: PlanPermissions, key: string): boolean {
  const v = perms[key];
  if (!v) return false;
  if (typeof v === 'object' && 'enabled' in v) return !!v.enabled;
  return Boolean(v);
}

export function getNumeric(perms: PlanPermissions, key: string, def = 0): number {
  const v = perms[key];
  if (!v) return def;
  if (typeof v === 'object' && 'value' in v) return Number(v.value) || def;
  return Number(v) || def;
}
