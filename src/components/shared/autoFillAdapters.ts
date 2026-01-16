import { supabase } from '@/integrations/supabase/client';

export type AutoFillEntityKey = 'product' | 'client' | 'supplier';

export type AutoFillMode = 'input' | 'combobox';

export type AutoFillAdapter<T> = {
  entity: AutoFillEntityKey;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getSubLabel?: (item: T) => string | undefined;
  isOptionDisabled?: (item: T) => boolean;
  getById?: (params: { companyId: string; id: string }) => Promise<T | null>;
  search: (params: { companyId: string; query: string; limit: number }) => Promise<T[]>;
  create: (params: { companyId: string; userId: string; name: string }) => Promise<T>;
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isDuplicateName(existingName: string | null | undefined, typedName: string): boolean {
  if (!existingName) return false;
  return normalizeName(existingName) === normalizeName(typedName);
}

export function getDefaultAutoFillAdapter(entity: AutoFillEntityKey): AutoFillAdapter<any> {
  switch (entity) {
    case 'client':
      return {
        entity,
        getId: (c: any) => c.id,
        getLabel: (c: any) => c.name ?? '',
        getSubLabel: (c: any) => c.email ?? undefined,
        getById: async ({ companyId, id }) => {
          const { data, error } = await supabase
            .from('clients')
            .select('*')
            .eq('company_id', companyId)
            .eq('id', id)
            .maybeSingle();
          if (error) throw error;
          return data ?? null;
        },
        search: async ({ companyId, query, limit }) => {
          const q = query.trim();
          let request = supabase
            .from('clients')
            .select('*')
            .eq('company_id', companyId)
            .order('name')
            .limit(limit);

          if (q) {
            const safe = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
            request = request.or(`name.ilike.%${safe}%,email.ilike.%${safe}%`);
          }

          const { data, error } = await request;
          if (error) throw error;
          return data ?? [];
        },
        create: async ({ companyId, userId, name }) => {
          const trimmed = name.trim();
          if (!trimmed) throw new Error('Nom requis');

          // Prevent duplicates (case-insensitive) by checking existing rows first.
          const { data: existing, error: existErr } = await supabase
            .from('clients')
            .select('id, name, email')
            .eq('company_id', companyId)
            .ilike('name', trimmed)
            .limit(5);

          if (existErr) throw existErr;
          const dup = (existing ?? []).find((c: any) => isDuplicateName(c.name, trimmed));
          if (dup) return dup;

          const { data: created, error } = await supabase
            .from('clients')
            .insert({ company_id: companyId, user_id: userId, name: trimmed })
            .select('*')
            .single();

          if (error) throw error;
          return created;
        },
      };

    case 'supplier':
      return {
        entity,
        getId: (s: any) => s.id,
        getLabel: (s: any) => s.name ?? '',
        getSubLabel: (s: any) => s.email ?? undefined,
        getById: async ({ companyId, id }) => {
          const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('company_id', companyId)
            .eq('id', id)
            .maybeSingle();
          if (error) throw error;
          return data ?? null;
        },
        search: async ({ companyId, query, limit }) => {
          const q = query.trim();
          let request = supabase
            .from('suppliers')
            .select('*')
            .eq('company_id', companyId)
            .order('name')
            .limit(limit);

          if (q) {
            const safe = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
            request = request.or(`name.ilike.%${safe}%,email.ilike.%${safe}%`);
          }

          const { data, error } = await request;
          if (error) throw error;
          return data ?? [];
        },
        create: async ({ companyId, userId, name }) => {
          const trimmed = name.trim();
          if (!trimmed) throw new Error('Nom requis');

          const { data: existing, error: existErr } = await supabase
            .from('suppliers')
            .select('id, name, email')
            .eq('company_id', companyId)
            .ilike('name', trimmed)
            .limit(5);

          if (existErr) throw existErr;
          const dup = (existing ?? []).find((s: any) => isDuplicateName(s.name, trimmed));
          if (dup) return dup;

          const { data: created, error } = await supabase
            .from('suppliers')
            .insert({ company_id: companyId, user_id: userId, name: trimmed })
            .select('*')
            .single();

          if (error) throw error;
          return created;
        },
      };

    case 'product':
    default:
      return {
        entity: 'product',
        getId: (p: any) => p.id,
        getLabel: (p: any) => p.name ?? '',
        getSubLabel: (p: any) => p.sku ?? undefined,
        isOptionDisabled: (p: any) => false,
        getById: async ({ companyId, id }) => {
          const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('company_id', companyId)
            .eq('id', id)
            .maybeSingle();
          if (error) throw error;
          return data ?? null;
        },
        search: async ({ companyId, query, limit }) => {
          const q = query.trim();
          let request = supabase
            .from('products')
            .select('*')
            .eq('company_id', companyId)
            .order('name')
            .limit(limit);

          if (q) {
            const safe = q.replace(/%/g, '\\%').replace(/_/g, '\\_');
            request = request.or(`name.ilike.%${safe}%,sku.ilike.%${safe}%`);
          }

          const { data, error } = await request;
          if (error) throw error;
          return data ?? [];
        },
        create: async ({ companyId, userId, name }) => {
          const trimmed = name.trim();
          if (!trimmed) throw new Error('Nom requis');

          const { data: existing, error: existErr } = await supabase
            .from('products')
            .select('id, name, sku')
            .eq('company_id', companyId)
            .ilike('name', trimmed)
            .limit(5);

          if (existErr) throw existErr;
          const dup = (existing ?? []).find((p: any) => isDuplicateName(p.name, trimmed));
          if (dup) return dup;

          // Minimal creation: name + required numeric fields with safe defaults.
          const payload: any = {
            company_id: companyId,
            user_id: userId,
            name: trimmed,
            quantity: 0,
            min_stock: 0,
            unit_price: 0,
            sale_price: null,
            purchase_price: null,
            sku: null,
            unit: null,
            description: null,
          };

          const { data: created, error } = await supabase
            .from('products')
            .insert(payload)
            .select('*')
            .single();

          if (error) throw error;
          return created;
        },
      };
  }
}
