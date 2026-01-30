import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type CompanyAccess = {
  trialEndsAt: string;
  trialDaysLeft: number;
  inTrial: boolean;
  paidActive: boolean;
  restricted: boolean;
  unpaidAllow: string[];
};

function computeDaysLeft(trialEndsAtIso: string) {
  const msLeft = new Date(trialEndsAtIso).getTime() - Date.now();
  if (msLeft <= 0) return 0;
  return Math.ceil(msLeft / (1000 * 60 * 60 * 24));
}

export function useCompanyAccess(activeCompanyId: string | null) {
  const [access, setAccess] = useState<CompanyAccess | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeCompanyId) {
      setAccess(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('company_access' as never)
          .select('trial_ends_at,is_paid,paid_until,lifetime,restricted,unpaid_permissions')
          .eq('company_id', activeCompanyId)
          .maybeSingle();

        if (cancelled) return;
        if (error || !data?.trial_ends_at) {
          setAccess(null);
          return;
        }

        const paidActive = Boolean(data.is_paid) && (Boolean(data.lifetime) || (data.paid_until && new Date(data.paid_until).getTime() > Date.now()));
        const inTrial = !paidActive && Date.now() < new Date(data.trial_ends_at).getTime();
        const restricted = Boolean(data.restricted) || (!paidActive && !inTrial);

        const allowRaw = data?.unpaid_permissions?.allow;
        const unpaidAllow = Array.isArray(allowRaw)
          ? allowRaw.map((x: unknown) => String(x))
          : ['dashboard'];

        setAccess({
          trialEndsAt: String(data.trial_ends_at),
          trialDaysLeft: computeDaysLeft(String(data.trial_ends_at)),
          inTrial,
          paidActive,
          restricted,
          unpaidAllow,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId]);

  return useMemo(() => ({ access, loading }), [access, loading]);
}
