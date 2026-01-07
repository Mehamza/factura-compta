import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import type { DocumentKind } from '@/config/documentTypes';
import { getDocumentTypeConfig } from '@/config/documentTypes';

export type InvoiceRow = {
  id: string;
  company_id: string;
  user_id: string;
  client_id: string | null;
  supplier_id: string | null;
  invoice_number: string;
  purchase_number?: string | null;
  issue_date: string;
  due_date: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  currency: string | null;
  template_type: string | null;
  stamp_included: boolean;
  stamp_amount: number;
  validity_date: string | null;
  reference_devis: string | null;
  created_at: string;
  document_kind?: string | null;
  document_type?: string | null;
};

export const useInvoices = (kind: DocumentKind) => {
  const { user, activeCompanyId } = useAuth();
  const { companySettings } = useCompanySettings();
  const cfg = useMemo(() => getDocumentTypeConfig(kind), [kind]);

  const generateNumber = useCallback(() => {
    const now = new Date();
    const year = String(now.getFullYear());

    // Keep existing company settings for invoices, but override prefix by kind.
    const next = (companySettings as any)?.invoice_next_number ?? 1;
    const pad = (companySettings as any)?.invoice_number_padding ?? 4;
    const fmt = (companySettings as any)?.invoice_format ?? '{prefix}-{year}-{number}';

    const numStr = String(next).padStart(pad, '0');
    return String(fmt)
      .replace('{prefix}', cfg.prefix)
      .replace('{year}', year)
      .replace('{number}', numStr);
  }, [cfg.prefix, companySettings]);

  const list = useCallback(async () => {
    if (!activeCompanyId) return { data: [] as InvoiceRow[], error: null as any };

    const query = supabase
      .from('invoices')
      .select('*, clients(*), suppliers(*)')
      .eq('company_id', activeCompanyId)
      .eq('document_kind', kind)
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    return { data: (data || []) as any as InvoiceRow[], error };
  }, [activeCompanyId, kind]);

  const create = useCallback(
    async (payload: Partial<InvoiceRow>) => {
      if (!user?.id || !activeCompanyId) throw new Error('Not authenticated or no active company');

      const invoice_number = payload.invoice_number || generateNumber();
      const insertPayload: any = {
        user_id: user.id,
        company_id: activeCompanyId,
        invoice_number,
        issue_date: payload.issue_date,
        due_date: payload.due_date,
        status: payload.status ?? cfg.defaultStatus,
        subtotal: payload.subtotal ?? 0,
        tax_rate: (payload as any).tax_rate ?? 0,
        tax_amount: payload.tax_amount ?? 0,
        total: payload.total ?? 0,
        notes: payload.notes ?? null,
        currency: payload.currency ?? (companySettings as any)?.default_currency ?? 'TND',
        template_type: payload.template_type ?? 'classic',
        stamp_included: payload.stamp_included ?? false,
        stamp_amount: payload.stamp_amount ?? 0,
        created_by_user_id: user.id,
        client_id: payload.client_id ?? null,
        supplier_id: payload.supplier_id ?? null,
        validity_date: payload.validity_date ?? null,
        reference_devis: payload.reference_devis ?? null,
        document_kind: kind,
        // Keep compatibility with existing purchases filter if DB still uses document_type
        document_type: cfg.module === 'achats' ? 'purchase' : (payload as any).document_type,
      };

      const { data, error } = await supabase
        .from('invoices')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      // Best-effort increment of company invoice_next_number
      try {
        const currentNext = (companySettings as any)?.invoice_next_number ?? 1;
        await supabase
          .from('companies')
          .update({ invoice_next_number: Number(currentNext) + 1 })
          .eq('id', activeCompanyId);
      } catch {
        // non-blocking
      }

      return data as any as InvoiceRow;
    },
    [activeCompanyId, cfg.defaultStatus, cfg.module, companySettings, generateNumber, kind, user?.id],
  );

  const convert = useCallback(
    async (sourceInvoiceId: string, targetKind: DocumentKind) => {
      const targetCfg = getDocumentTypeConfig(targetKind);

      const { data: source, error: sourceErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', sourceInvoiceId)
        .maybeSingle();
      if (sourceErr) throw sourceErr;
      if (!source) throw new Error('Source document not found');

      if (!user?.id || !activeCompanyId) throw new Error('Not authenticated or no active company');

      // Minimal conversion: copy header-level fields and link via reference_devis
      const reference = (source as any).invoice_number;

      const now = new Date();
      const year = String(now.getFullYear());
      const next = (companySettings as any)?.invoice_next_number ?? 1;
      const pad = (companySettings as any)?.invoice_number_padding ?? 4;
      const fmt = (companySettings as any)?.invoice_format ?? '{prefix}-{year}-{number}';
      const numStr = String(next).padStart(pad, '0');
      const newNumber = String(fmt)
        .replace('{prefix}', targetCfg.prefix)
        .replace('{year}', year)
        .replace('{number}', numStr);

      const insertPayload: any = {
        user_id: user.id,
        company_id: activeCompanyId,
        invoice_number: newNumber,
        client_id: (source as any).client_id,
        supplier_id: (source as any).supplier_id,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: (source as any).due_date,
        status: targetCfg.defaultStatus,
        subtotal: (source as any).subtotal,
        tax_rate: (source as any).tax_rate ?? 0,
        tax_amount: (source as any).tax_amount,
        total: (source as any).total,
        notes: (source as any).notes,
        currency: (source as any).currency,
        template_type: (source as any).template_type,
        stamp_included: (source as any).stamp_included,
        stamp_amount: (source as any).stamp_amount,
        validity_date: (source as any).validity_date,
        reference_devis: reference,
        created_by_user_id: user.id,
        document_kind: targetKind,
        document_type: targetCfg.module === 'achats' ? 'purchase' : (source as any).document_type,
      };

      const { data: created, error: insErr } = await supabase
        .from('invoices')
        .insert(insertPayload)
        .select()
        .single();
      if (insErr) throw insErr;

      // Best-effort increment of company invoice_next_number
      try {
        await supabase
          .from('companies')
          .update({ invoice_next_number: Number(next) + 1 })
          .eq('id', activeCompanyId);
      } catch {
        // non-blocking
      }

      return created as any as InvoiceRow;
    },
    [activeCompanyId, cfg, companySettings, user?.id],
  );

  return {
    kind,
    config: cfg,
    generateNumber,
    list,
    create,
    convert,
  };
};
