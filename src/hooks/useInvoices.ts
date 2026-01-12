import { useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import type { DocumentKind } from '@/config/documentTypes';
import { getDocumentTypeConfig } from '@/config/documentTypes';
import { calculateTotals, type DiscountConfig } from '@/components/invoices/shared/types';

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
  payment_status?: string;
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
  source_invoice_id?: string | null;
  discount_amount?: number | null;
  discount_type?: 'percent' | 'fixed' | null;
  discount_value?: number | null;
  created_at: string;
  document_kind: string;
  clients?: any;
  suppliers?: any;
};

export type InvoiceItemRow = {
  id?: string;
  invoice_id: string;
  company_id: string;
  product_id?: string | null;
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
        source_invoice_id: (payload as any).source_invoice_id ?? null,
        document_kind: kind,
        // Persister les informations de remise
        discount_type: (payload as any).discount_type ?? 'percent',
        discount_value: (payload as any).discount_value ?? 0,
        discount_amount: (payload as any).discount_amount ?? 0,
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
          source_invoice_id: (payload as any).source_invoice_id,
          // Persister les informations de remise
          discount_type: (payload as any).discount_type,
          discount_value: (payload as any).discount_value,
          discount_amount: (payload as any).discount_amount,
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

      if (!cfg.canConvertTo.includes(targetKind)) {
        throw new Error(`Conversion non autorisée vers ${targetCfg.label}`);
      }

      const { invoice: source, items: sourceItems, error: sourceErr } = await getById(sourceInvoiceId);
      if (sourceErr) throw sourceErr;
      if (!source) throw new Error('Source document not found');

      if (!user?.id || !activeCompanyId) throw new Error('Not authenticated or no active company');

      const reference = source.invoice_number;

      const isTargetCreditNote = targetKind === 'facture_avoir' || targetKind === 'avoir_achat';

      let computedTotals:
        | {
            subtotal: number;
            taxAmount: number;
            totalFodec: number;
            total: number;
            discountAmount: number;
          }
        | null = null;

      if (!isTargetCreditNote) {
        const discountValue = Number(source.discount_value ?? 0);
        const discountType = (source.discount_type ?? 'percent') as DiscountConfig['type'];
        const discount: DiscountConfig | undefined =
          discountValue > 0 ? { type: discountType, value: discountValue } : undefined;

        const totals = calculateTotals(
          (sourceItems as any) || [],
          Boolean(source.stamp_included),
          discount,
        );
        computedTotals = {
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          totalFodec: totals.totalFodec,
          total: totals.total,
          discountAmount: totals.discountAmount,
        };
      }

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
        subtotal: isTargetCreditNote
          ? -Math.abs(Number(source.subtotal ?? 0))
          : (computedTotals?.subtotal ?? source.subtotal),
        tax_rate: source.tax_rate ?? 0,
        tax_amount: isTargetCreditNote
          ? -Math.abs(Number(source.tax_amount ?? 0))
          : (computedTotals?.taxAmount ?? source.tax_amount),
        fodec_amount: isTargetCreditNote
          ? -Math.abs(Number(source.fodec_amount ?? 0))
          : (computedTotals?.totalFodec ?? (source.fodec_amount ?? 0)),
        total: isTargetCreditNote
          ? -Math.abs(Number(source.total ?? 0))
          : (computedTotals?.total ?? source.total),
        notes: source.notes,
        currency: source.currency,
        template_type: source.template_type,
        stamp_included: isTargetCreditNote ? false : source.stamp_included,
        stamp_amount: isTargetCreditNote ? 0 : source.stamp_amount,
        validity_date: source.validity_date,
        reference_devis: reference,
        created_by_user_id: user.id,
        document_kind: targetKind,
        source_invoice_id: isTargetCreditNote ? source.id : null,
        // Copy discount/remise fields for consistency in UI/PDF
        discount_type: source.discount_type ?? 'percent',
        discount_value: source.discount_value ?? 0,
        discount_amount: isTargetCreditNote
          ? 0
          : (computedTotals?.discountAmount ?? (source.discount_amount ?? 0)),
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
          unit_price: isTargetCreditNote ? -Math.abs(Number(item.unit_price ?? 0)) : item.unit_price,
          vat_rate: item.vat_rate,
          vat_amount: isTargetCreditNote ? -Math.abs(Number(item.vat_amount ?? 0)) : item.vat_amount,
          fodec_applicable: item.fodec_applicable,
          fodec_rate: item.fodec_rate,
          fodec_amount: isTargetCreditNote ? -Math.abs(Number(item.fodec_amount ?? 0)) : item.fodec_amount,
          total: isTargetCreditNote ? -Math.abs(Number(item.total ?? 0)) : item.total,
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
    [activeCompanyId, cfg.canConvertTo, companySettings, getById, user?.id],
  );

  const handleStockMovement = useCallback(
    async (invoiceId: string, movementType: 'entry' | 'exit') => {
      if (!user?.id || !activeCompanyId) throw new Error('Not authenticated');

      const { invoice, items } = await getById(invoiceId);
      if (!invoice || items.length === 0) return;

      // Vérifier si des mouvements ont déjà été créés pour ce document (idempotence)
      const { data: existingMovements } = await supabase
        .from('stock_movements')
        .select('id')
        .eq('reference_type', invoice.document_kind)
        .eq('reference_id', invoiceId)
        .limit(1);

      if (existingMovements && existingMovements.length > 0) {
        console.log('Stock movements already exist for this document, skipping');
        return;
      }

      // Get products by reference (sku) ou product_id si disponible
      const refs = items.map(i => i.reference).filter(Boolean);
      const productIds = items.map(i => (i as any).product_id).filter(Boolean);
      
      if (refs.length === 0 && productIds.length === 0) return;

      // Charger les produits par SKU ou ID
      let products: any[] = [];
      if (productIds.length > 0) {
        const { data } = await supabase
          .from('products')
          .select('id, sku, quantity')
          .eq('company_id', activeCompanyId)
          .in('id', productIds);
        products = data || [];
      } else if (refs.length > 0) {
        const { data } = await supabase
          .from('products')
          .select('id, sku, quantity')
          .eq('company_id', activeCompanyId)
          .in('sku', refs);
        products = data || [];
      }

      if (products.length === 0) return;

      const productMapById = new Map(products.map(p => [p.id, p]));
      const productMapBySku = new Map(products.map(p => [p.sku, p]));

      for (const item of items) {
        // Chercher le produit par ID d'abord, puis par SKU
        let product = productMapById.get((item as any).product_id);
        if (!product) product = productMapBySku.get(item.reference);
        if (!product) continue;

        const currentQty = Number(product.quantity ?? 0);
        const itemQty = Math.abs(Number(item.quantity ?? 0)); // Abs car les avoirs ont des qtés négatives
        const newQty = movementType === 'entry' 
          ? currentQty + itemQty 
          : currentQty - itemQty;

        // Validation stock pour les sorties (sauf pour les avoirs qui restaurent le stock)
        if (movementType === 'exit' && newQty < 0) {
          console.warn(`Stock insuffisant pour ${product.sku}: ${currentQty} disponible, ${itemQty} demandé`);
          // On continue quand même mais on met 0 comme minimum
        }

        // Update product quantity
        await supabase
          .from('products')
          .update({ quantity: Math.max(0, newQty) })
          .eq('id', product.id);

        // Insert stock movement avec traçabilité
        await supabase.from('stock_movements').insert({
          user_id: user.id,
          company_id: activeCompanyId,
          product_id: product.id,
          movement_type: movementType,
          quantity: itemQty,
          note: `Document ${invoice.invoice_number}`,
          reference_type: invoice.document_kind,
          reference_id: invoiceId,
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
