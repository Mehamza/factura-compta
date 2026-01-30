import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

function formatDays(daysLeft: number) {
  if (daysLeft <= 0) return "Aujourd'hui";
  if (daysLeft === 1) return '1 jour';
  return `${daysLeft} jours`;
}

export function TrialBanner() {
  const { activeCompanyAccess, globalRole } = useAuth();

  const info = useMemo(() => {
    const a = activeCompanyAccess;
    if (!a) return null;
    if (a.paidActive) return null;
    if (!a.inTrial) return null;
    return a;
  }, [activeCompanyAccess]);

  if (globalRole === 'SUPER_ADMIN') return null;
  if (!info) return null;

  return (
    <div className="w-full border-b bg-amber-50 text-amber-900">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          <span>
            Période d’essai: <strong>{formatDays(info.trialDaysLeft)}</strong> restants.
          </span>
        </div>
        <Button variant="outline" size="sm" className="border-amber-300 bg-white/60 hover:bg-white">
          Passer au plan payant
        </Button>
      </div>
    </div>
  );
}
