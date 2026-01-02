import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CompanySettings {
  id: string;
  legal_name: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  company_country: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  matricule_fiscale: string | null;
  activity: string | null;
  company_vat_number: string | null;
  company_tax_id: string | null;
  company_trade_register: string | null;
  default_currency: string | null;
  default_vat_rate: number | null;
  signature_url: string | null;
  stamp_url: string | null;
  invoice_prefix: string | null;
  invoice_format: string | null;
  invoice_next_number: number | null;
  invoice_number_padding: number | null;
  vat_rates: any | null;
  bank_accounts: { bank: string; rib: string }[] | null;
  type: string;
  is_configured: boolean;
  // Aliases for backward compatibility with old naming convention
  company_name?: string | null;
  company_address?: string | null;
  company_city?: string | null;
  company_postal_code?: string | null;
  company_phone?: string | null;
  company_email?: string | null;
  company_logo_url?: string | null;
}

/**
 * Hook to fetch company settings for the active company.
 * Now queries the companies table directly (after merging company_settings into companies).
 */
export function useCompanySettings() {
  const { user, activeCompanyId } = useAuth();
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompanySettings = useCallback(async () => {
    if (!user || !activeCompanyId) {
      setCompanySettings(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .eq('id', activeCompanyId)
      .maybeSingle();

    if (data && !error) {
      // Create object with both new and old naming for backward compatibility
      setCompanySettings({
        ...data,
        // Backward compatibility aliases
        company_name: data.legal_name || (data as any).name,
        company_address: data.address,
        company_city: data.city,
        company_postal_code: data.postal_code,
        company_phone: data.phone,
        company_email: data.email,
        company_logo_url: data.logo_url,
        bank_accounts: (data as any).bank_accounts || [],
      });
    } else {
      setCompanySettings(null);
    }
    
    setLoading(false);
  }, [user, activeCompanyId]);

  useEffect(() => {
    fetchCompanySettings();
  }, [fetchCompanySettings]);

  return { companySettings, loading, refetch: fetchCompanySettings };
}
