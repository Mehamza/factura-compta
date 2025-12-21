import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImpersonationBannerProps {
  targetEmail: string;
  targetName?: string;
  onExit: () => void;
}

/**
 * Banner displayed when Super Admin is impersonating another user.
 * Shows a warning with the impersonated user's info and an exit button.
 */
export function ImpersonationBanner({ targetEmail, targetName, onExit }: ImpersonationBannerProps) {
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-amber-500 text-amber-950 py-2 px-4 flex items-center justify-center gap-3 shadow-md">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">
        Mode impersonation : Vous êtes connecté en tant que{' '}
        <strong>{targetName || targetEmail}</strong>
        {targetName && <span className="text-amber-800 ml-1">({targetEmail})</span>}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={onExit}
        className="ml-2 h-7 bg-amber-600 hover:bg-amber-700 text-amber-50 hover:text-white"
      >
        <X className="h-3 w-3 mr-1" />
        Quitter
      </Button>
    </div>
  );
}
