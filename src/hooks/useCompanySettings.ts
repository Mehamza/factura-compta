import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CompanySettings {
  company_name: string | null;
  company_address: string | null;
  company_city: string | null;
  company_postal_code: string | null;
  company_country: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_vat_number: string | null;
  company_tax_id: string | null;
  company_trade_register: string | null;
  company_logo_url: string | null;
  activity: string | null;
  default_currency: string | null;
  default_vat_rate: number | null;
  signature_url: string | null;
  stamp_url: string | null;
}

/**
 * Hook to fetch company settings for the active company.
 * Works for both company owners and employees by finding the company admin's settings.
 */
export function useCompanySettings() {
  const { user, activeCompanyId } = useAuth();
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompanySettings = async () => {
      if (!user) {
        setCompanySettings(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      // If we have an activeCompanyId, find the company admin to get their settings
      if (activeCompanyId) {
        // Find the company_admin user for this company
        const { data: adminData } = await supabase
          .from('company_users')
          .select('user_id')
          .eq('company_id', activeCompanyId)
          .eq('role', 'company_admin')
          .maybeSingle();

        if (adminData?.user_id) {
          // Fetch settings for the company admin
          const { data } = await supabase
            .from('company_settings')
            .select('*')
            .eq('user_id', adminData.user_id)
            .maybeSingle();

          if (data) {
            setCompanySettings(data);
            setLoading(false);
            return;
          }
        }
      }

      // Fallback: try to get settings for the current user (for owners)
      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      setCompanySettings(data);
      setLoading(false);
    };

    fetchCompanySettings();
  }, [user, activeCompanyId]);

  return { companySettings, loading, refetch: () => {} };
}
