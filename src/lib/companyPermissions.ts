export type CompanyPermissions = {
  allow: string[];
};

export function normalizeCompanyPermissions(input: unknown): CompanyPermissions {
  const allow = (input as any)?.allow;
  if (Array.isArray(allow)) {
    return { allow: allow.map((v) => String(v)) };
  }
  return { allow: ['*'] };
}

export function canAccessFromPermissions(
  permissions: CompanyPermissions | null | undefined,
  moduleId: string,
  subModuleId?: string
): boolean {
  // Always allow dashboard so users aren't stranded.
  if (moduleId === 'dashboard') return true;

  const allow = permissions?.allow ?? ['*'];
  if (allow.includes('*')) return true;

  if (!subModuleId) {
    return allow.includes(moduleId) || allow.some((k) => k.startsWith(moduleId + '.'));
  }

  return allow.includes(moduleId) || allow.includes(`${moduleId}.${subModuleId}`);
}

export function hasAnyAccessInModule(
  permissions: CompanyPermissions | null | undefined,
  moduleId: string
): boolean {
  const allow = permissions?.allow ?? ['*'];
  if (allow.includes('*')) return true;
  return allow.includes(moduleId) || allow.some((k) => k.startsWith(moduleId + '.'));
}
