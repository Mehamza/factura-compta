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
  tax_rate: number;
  tax_amount: number;
  fodec_amount: number;
  total: number;
  notes: string | null;
  currency: string | null;
  template_type: string | null;
  stamp_included: boolean;
  stamp_amount: number;
  validity_date: string | null;
  reference_devis: string | null;
  created_at: string;
  document_kind: string;
  clients?: any;
  suppliers?: any;
};

export type InvoiceItemRow = {
  id?: string;
  invoice_id: string;
  company_id: string;
  reference: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  vat_amount: number;
  fodec_applicable: boolean;
  fodec_rate: number;
  fodec_amount: number;
  total: number;
};

export const useInvoices = (kind: DocumentKind) => {
  const { user, activeCompanyId } = useAuth();
  const { companySettings } = useCompanySettings();
  const cfg = useMemo(() => getDocumentTypeConfig(kind), [kind]);

  const generateNumber = useCallback(() => {
    const now = new Date();
    const year = String(now.getFullYear());
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
    return { data: (data || []) as InvoiceRow[], error };
  }, [activeCompanyId, kind]);

  const getById = useCallback(async (id: string) => {
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*, clients(*), suppliers(*)')
      .eq('id', id)
      .maybeSingle();

    if (invoiceError) return { invoice: null, items: [], error: invoiceError };

    const { data: items, error: itemsError } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', id);

    return { 
      invoice: invoice as InvoiceRow | null, 
      items: (items || []) as InvoiceItemRow[], 
      error: itemsError 
    };
  }, []);

  const create = useCallback(
    async (payload: Partial<InvoiceRow>, items?: Omit<InvoiceItemRow, 'id' | 'invoice_id' | 'company_id'>[]) => {
      if (!user?.id || !activeCompanyId) throw new Error('Not authenticated or no active company');

      const invoice_number = payload.invoice_number || generateNumber();
      const insertPayload: any = {
        user_id: user.id,
        company_id: activeCompanyId,
        invoice_number,
        issue_date: payload.issue_date || new Date().toISOString().slice(0, 10),
        due_date: payload.due_date || new Date().toISOString().slice(0, 10),
        status: payload.status ?? cfg.defaultStatus,
        subtotal: payload.subtotal ?? 0,
        tax_rate: payload.tax_rate ?? 0,
        tax_amount: payload.tax_amount ?? 0,
        fodec_amount: payload.fodec_amount ?? 0,
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
      };

      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      // Insert invoice items if provided
      if (items && items.length > 0) {
        const itemsToInsert = items.map(item => ({
          ...item,
          invoice_id: invoice.id,
          company_id: activeCompanyId,
        }));
        
        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsToInsert);
        
        if (itemsError) throw itemsError;
      }

      // Increment company invoice_next_number
      try {
        const currentNext = (companySettings as any)?.invoice_next_number ?? 1;
        await supabase
          .from('companies')
          .update({ invoice_next_number: Number(currentNext) + 1 })
          .eq('id', activeCompanyId);
      } catch {
        // non-blocking
      }

      return invoice as InvoiceRow;
    },
    [activeCompanyId, cfg.defaultStatus, companySettings, generateNumber, kind, user?.id],
  );

  const update = useCallback(
    async (id: string, payload: Partial<InvoiceRow>, items?: Omit<InvoiceItemRow, 'id' | 'invoice_id' | 'company_id'>[]) => {
      if (!activeCompanyId) throw new Error('No active company');

      const { data: invoice, error } = await supabase
        .from('invoices')
        .update({
          client_id: payload.client_id,
          supplier_id: payload.supplier_id,
          issue_date: payload.issue_date,
          due_date: payload.due_date,
          status: payload.status,
          subtotal: payload.subtotal,
          tax_rate: payload.tax_rate,
          tax_amount: payload.tax_amount,
          fodec_amount: payload.fodec_amount,
          total: payload.total,
          notes: payload.notes,
          currency: payload.currency,
          template_type: payload.template_type,
          stamp_included: payload.stamp_included,
          stamp_amount: payload.stamp_amount,
          validity_date: payload.validity_date,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Replace items if provided
      if (items) {
        await supabase.from('invoice_items').delete().eq('invoice_id', id);
        
        if (items.length > 0) {
          const itemsToInsert = items.map(item => ({
            ...item,
            invoice_id: id,
            company_id: activeCompanyId,
          }));
          
          const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(itemsToInsert);
          
          if (itemsError) throw itemsError;
        }
      }

      return invoice as InvoiceRow;
    },
    [activeCompanyId],
  );

  const remove = useCallback(async (id: string) => {
    // Items are deleted via cascade
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
  }, []);

  const convert = useCallback(
    async (sourceInvoiceId: string, targetKind: DocumentKind) => {
      const targetCfg = getDocumentTypeConfig(targetKind);

      const { invoice: source, items: sourceItems, error: sourceErr } = await getById(sourceInvoiceId);
      if (sourceErr) throw sourceErr;
      if (!source) throw new Error('Source document not found');

      if (!user?.id || !activeCompanyId) throw new Error('Not authenticated or no active company');

      const reference = source.invoice_number;

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
        client_id: source.client_id,
        supplier_id: source.supplier_id,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: source.due_date,
        status: targetCfg.defaultStatus,
        subtotal: source.subtotal,
        tax_rate: source.tax_rate ?? 0,
        tax_amount: source.tax_amount,
        fodec_amount: source.fodec_amount ?? 0,
        total: source.total,
        notes: source.notes,
        currency: source.currency,
        template_type: source.template_type,
        stamp_included: source.stamp_included,
        stamp_amount: source.stamp_amount,
        validity_date: source.validity_date,
        reference_devis: reference,
        created_by_user_id: user.id,
        document_kind: targetKind,
      };

      const { data: created, error: insErr } = await supabase
        .from('invoices')
        .insert(insertPayload)
        .select()
        .single();
      if (insErr) throw insErr;

      // Copy items
      if (sourceItems.length > 0) {
        const itemsToInsert = sourceItems.map(item => ({
          invoice_id: created.id,
          company_id: activeCompanyId,
          reference: item.reference,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          vat_rate: item.vat_rate,
          vat_amount: item.vat_amount,
          fodec_applicable: item.fodec_applicable,
          fodec_rate: item.fodec_rate,
          fodec_amount: item.fodec_amount,
          total: item.total,
        }));
        
        await supabase.from('invoice_items').insert(itemsToInsert);
      }

      // Increment next number
      try {
        await supabase
          .from('companies')
          .update({ invoice_next_number: Number(next) + 1 })
          .eq('id', activeCompanyId);
      } catch {
        // non-blocking
      }

      return created as InvoiceRow;
    },
    [activeCompanyId, companySettings, getById, user?.id],
  );

  const handleStockMovement = useCallback(
    async (invoiceId: string, movementType: 'entry' | 'exit') => {
      if (!user?.id || !activeCompanyId) throw new Error('Not authenticated');

      const { invoice, items } = await getById(invoiceId);
      if (!invoice || items.length === 0) return;

      // Get products by reference (sku)
      const refs = items.map(i => i.reference).filter(Boolean);
      if (refs.length === 0) return;

      const { data: products } = await supabase
        .from('products')
        .select('id, sku, quantity')
        .eq('company_id', activeCompanyId)
        .in('sku', refs);

      if (!products || products.length === 0) return;

      const productMap = new Map(products.map(p => [p.sku, p]));

      for (const item of items) {
        const product = productMap.get(item.reference);
        if (!product) continue;

        const currentQty = Number(product.quantity ?? 0);
        const itemQty = Number(item.quantity ?? 0);
        const newQty = movementType === 'entry' 
          ? currentQty + itemQty 
          : currentQty - itemQty;

        // Update product quantity
        await supabase
          .from('products')
          .update({ quantity: Math.max(0, newQty) })
          .eq('id', product.id);

        // Insert stock movement
        await supabase.from('stock_movements').insert({
          user_id: user.id,
          company_id: activeCompanyId,
          product_id: product.id,
          movement_type: movementType,
          quantity: itemQty,
          note: `Document ${invoice.invoice_number}`,
        });
      }
    },
    [activeCompanyId, getById, user?.id],
  );

  return {
    kind,
    config: cfg,
    generateNumber,
    list,
    getById,
    create,
    update,
    remove,
    convert,
    handleStockMovement,
  };
};
