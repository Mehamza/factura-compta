import { useState } from 'react';
import { format, formatDistanceToNow, addDays, addWeeks, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Building2, Mail, Calendar, CreditCard, AlertTriangle, Clock, Ban, CheckCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface CompanyDetails {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  active: boolean;
  created_at: string;
  disabled_until: string | null;
  disabled_reason: string | null;
  disabled_at: string | null;
  plan_name: string | null;
  owner_email: string | null;
  users_count: number;
}

interface CompanyManagementModalProps {
  company: CompanyDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: () => void;
}

type DeactivationDuration = '1_day' | '3_days' | '1_week' | '2_weeks' | '1_month' | 'permanent';

const durationOptions: { value: DeactivationDuration; label: string }[] = [
  { value: '1_day', label: '1 jour' },
  { value: '3_days', label: '3 jours' },
  { value: '1_week', label: '1 semaine' },
  { value: '2_weeks', label: '2 semaines' },
  { value: '1_month', label: '1 mois' },
  { value: 'permanent', label: 'Permanent' },
];

function getDisabledUntilDate(duration: DeactivationDuration): Date | null {
  const now = new Date();
  switch (duration) {
    case '1_day': return addDays(now, 1);
    case '3_days': return addDays(now, 3);
    case '1_week': return addWeeks(now, 1);
    case '2_weeks': return addWeeks(now, 2);
    case '1_month': return addMonths(now, 1);
    case 'permanent': return null;
  }
}

export function CompanyManagementModal({ 
  company, 
  open, 
  onOpenChange, 
  onStatusChange 
}: CompanyManagementModalProps) {
  const { toast } = useToast();
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [showActivateConfirm, setShowActivateConfirm] = useState(false);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [deactivationDuration, setDeactivationDuration] = useState<DeactivationDuration>('1_week');
  const [loading, setLoading] = useState(false);

  if (!company) return null;

  const isTemporarilyDisabled = !company.active && company.disabled_until;
  const isPermanentlyDisabled = !company.active && !company.disabled_until;

  const handleDeactivate = async () => {
    if (!deactivationReason.trim()) {
      toast({ 
        variant: 'destructive', 
        title: 'Erreur', 
        description: 'Veuillez fournir une raison pour la désactivation.' 
      });
      return;
    }

    setLoading(true);
    try {
      const disabledUntil = getDisabledUntilDate(deactivationDuration);
      const action = disabledUntil ? 'deactivate_temporary' : 'deactivate_permanent';
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // Update company status
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          active: false,
          disabled_until: disabledUntil?.toISOString() || null,
          disabled_reason: deactivationReason,
          disabled_at: new Date().toISOString(),
          disabled_by: user.id,
        })
        .eq('id', company.id);

      if (updateError) throw updateError;

      // Log the action
      const { error: logError } = await supabase
        .from('company_status_logs')
        .insert({
          company_id: company.id,
          action,
          reason: deactivationReason,
          disabled_until: disabledUntil?.toISOString() || null,
          performed_by: user.id,
          metadata: { duration: deactivationDuration },
        });

      if (logError) console.error('Error logging status change:', logError);

      toast({
        title: 'Entreprise désactivée',
        description: disabledUntil 
          ? `L'entreprise sera réactivée automatiquement le ${format(disabledUntil, 'dd/MM/yyyy à HH:mm', { locale: fr })}`
          : 'L\'entreprise a été désactivée de manière permanente.',
      });

      setShowDeactivateConfirm(false);
      setDeactivationReason('');
      setDeactivationDuration('1_week');
      onOpenChange(false);
      onStatusChange();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // Update company status
      const { error: updateError } = await supabase
        .from('companies')
        .update({
          active: true,
          disabled_until: null,
          disabled_reason: null,
          disabled_at: null,
          disabled_by: null,
        })
        .eq('id', company.id);

      if (updateError) throw updateError;

      // Log the action
      const { error: logError } = await supabase
        .from('company_status_logs')
        .insert({
          company_id: company.id,
          action: 'activate',
          reason: 'Réactivation manuelle par Super Admin',
          performed_by: user.id,
        });

      if (logError) console.error('Error logging status change:', logError);

      toast({ title: 'Entreprise activée', description: 'L\'entreprise est maintenant active.' });
      setShowActivateConfirm(false);
      onOpenChange(false);
      onStatusChange();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {company.name}
            </DialogTitle>
            <DialogDescription>Détails et gestion du compte entreprise</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Company Details */}
            <div className="grid gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email entreprise:</span>
                <span>{company.email || 'Non renseigné'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Email propriétaire:</span>
                <span>{company.owner_email || 'Non renseigné'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Créée le:</span>
                <span>{format(new Date(company.created_at), 'dd MMMM yyyy', { locale: fr })}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Plan:</span>
                {company.plan_name ? (
                  <Badge>{company.plan_name}</Badge>
                ) : (
                  <span className="text-muted-foreground">Aucun plan</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Utilisateurs:</span>
                <Badge variant="outline">{company.users_count}</Badge>
              </div>
            </div>

            <Separator />

            {/* Status Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Statut actuel</span>
                {company.active ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Actif
                  </Badge>
                ) : isTemporarilyDisabled ? (
                  <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                    <Clock className="h-3 w-3 mr-1" />
                    Désactivé temporairement
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <Ban className="h-3 w-3 mr-1" />
                    Désactivé
                  </Badge>
                )}
              </div>

              {/* Show deactivation details if disabled */}
              {!company.active && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
                  {company.disabled_reason && (
                    <div className="text-sm">
                      <span className="font-medium text-destructive">Raison: </span>
                      <span>{company.disabled_reason}</span>
                    </div>
                  )}
                  {company.disabled_at && (
                    <div className="text-sm text-muted-foreground">
                      Désactivé le {format(new Date(company.disabled_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                    </div>
                  )}
                  {isTemporarilyDisabled && company.disabled_until && (
                    <div className="text-sm">
                      <span className="font-medium text-amber-600">Réactivation automatique: </span>
                      <span>
                        {format(new Date(company.disabled_until), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                        {' '}({formatDistanceToNow(new Date(company.disabled_until), { locale: fr, addSuffix: true })})
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {company.active ? (
              <Button
                variant="destructive"
                onClick={() => setShowDeactivateConfirm(true)}
              >
                <Ban className="h-4 w-4 mr-2" />
                Désactiver l'entreprise
              </Button>
            ) : (
              <Button
                onClick={() => setShowActivateConfirm(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Réactiver l'entreprise
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivation Confirmation Dialog */}
      <AlertDialog open={showDeactivateConfirm} onOpenChange={setShowDeactivateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Désactiver "{company.name}"
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action bloquera l'accès à l'application pour tous les utilisateurs de cette entreprise.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Durée de désactivation</Label>
              <Select
                value={deactivationDuration}
                onValueChange={(v) => setDeactivationDuration(v as DeactivationDuration)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durationOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Raison de la désactivation *</Label>
              <Textarea
                id="reason"
                placeholder="Expliquez la raison de cette désactivation..."
                value={deactivationReason}
                onChange={(e) => setDeactivationReason(e.target.value)}
                rows={3}
              />
            </div>

            {deactivationDuration !== 'permanent' && (
              <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <Clock className="h-4 w-4 inline mr-2" />
                L'entreprise sera automatiquement réactivée 
                {' '}{format(getDisabledUntilDate(deactivationDuration)!, 'le dd/MM/yyyy à HH:mm', { locale: fr })}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={loading || !deactivationReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Désactivation...' : 'Confirmer la désactivation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activation Confirmation Dialog */}
      <AlertDialog open={showActivateConfirm} onOpenChange={setShowActivateConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Réactiver "{company.name}"</AlertDialogTitle>
            <AlertDialogDescription>
              Les utilisateurs de cette entreprise pourront à nouveau accéder à l'application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleActivate}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? 'Réactivation...' : 'Confirmer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
