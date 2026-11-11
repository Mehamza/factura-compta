import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileText, Loader2, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type Plan = {
  id: string;
  name: string;
  price_year: number;
  duration: string;
};

type PaymentRequest = {
  id: string;
  plan_id: string;
  payment_method: string;
  payment_note: string | null;
  payment_reference: string | null;
  status: string;
  review_note: string | null;
  created_at: string;
};

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const maxProofSize = 10 * 1024 * 1024;

const requestStatusLabels: Record<string, string> = {
  pending: 'En attente de vérification',
  approved: 'Approuvée',
  rejected: 'Refusée',
};

const paymentMethodLabels: Record<string, string> = {
  cash_deposit: 'Versement espèces',
  bank_transfer: 'Virement bancaire',
};

export default function Subscription() {
  const { activeCompanyId, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState(searchParams.get('plan') || '');
  const [paymentMethod, setPaymentMethod] = useState<'cash_deposit' | 'bank_transfer'>('bank_transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPageData = useCallback(async () => {
    if (!activeCompanyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    const [plansResult, requestsResult] = await Promise.all([
      supabase
        .from('plans')
        .select('id,name,price_year,duration')
        .eq('active', true)
        .order('display_order'),
      supabase
        .from('subscription_payment_requests')
        .select('id,plan_id,payment_method,payment_note,payment_reference,status,review_note,created_at')
        .eq('company_id', activeCompanyId)
        .order('created_at', { ascending: false }),
    ]);

    if (plansResult.error || requestsResult.error) {
      setLoadError(plansResult.error?.message || requestsResult.error?.message || 'Impossible de charger les abonnements.');
    } else {
      setPlans(plansResult.data || []);
      setRequests(requestsResult.data || []);
      if (!selectedPlanId && plansResult.data?.[0]) {
        setSelectedPlanId(plansResult.data[0].id);
      }
    }
    setLoading(false);
  }, [activeCompanyId, selectedPlanId]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  const pendingRequestExists = requests.some((request) => request.status === 'pending');
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);
  const isFreePlanSelected = Number(selectedPlan?.price_year) === 0;

  const activateFreePlan = async () => {
    if (!activeCompanyId || !user || !selectedPlanId) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('activate_free_company_plan', {
        p_company_id: activeCompanyId,
        p_plan_id: selectedPlanId,
      });

      if (error) throw error;

      window.dispatchEvent(new Event('company-access-updated'));
      toast({ title: 'Plan Gratuit activé', description: 'Votre entreprise peut commencer à utiliser son plan Gratuit.' });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Le plan Gratuit n’a pas pu être activé.';
      toast({ variant: 'destructive', title: 'Activation impossible', description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeCompanyId || !user) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Aucune entreprise active n’est sélectionnée.' });
      return;
    }
    if (!selectedPlanId || !proof) {
      toast({ variant: 'destructive', title: 'Informations manquantes', description: 'Choisissez un plan et ajoutez votre preuve de paiement.' });
      return;
    }
    if (!allowedTypes.has(proof.type) || proof.size > maxProofSize) {
      toast({ variant: 'destructive', title: 'Fichier non accepté', description: 'Ajoutez un PDF ou une image (JPG, PNG, WebP) de 10 Mo maximum.' });
      return;
    }

    setSubmitting(true);
    const extension = proof.type === 'application/pdf'
      ? 'pdf'
      : proof.type === 'image/jpeg'
        ? 'jpg'
        : proof.type === 'image/png'
          ? 'png'
          : 'webp';
    const proofPath = `${activeCompanyId}/${user.id}/${crypto.randomUUID()}.${extension}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('subscription-proofs')
        .upload(proofPath, proof, { contentType: proof.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: requestError } = await supabase
        .from('subscription_payment_requests')
        .insert({
          company_id: activeCompanyId,
          requested_by: user.id,
          plan_id: selectedPlanId,
          payment_method: paymentMethod,
          payment_note: paymentNote.trim() || null,
          payment_reference: paymentReference.trim() || null,
          proof_path: proofPath,
        });

      if (requestError) {
        await supabase.storage.from('subscription-proofs').remove([proofPath]);
        throw requestError;
      }

      toast({
        title: 'Demande envoyée',
        description: 'Votre demande sera activée après vérification par l’administration.',
      });
      setProof(null);
      setPaymentReference('');
      setPaymentNote('');
      await loadPageData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'La demande n’a pas pu être envoyée.';
      toast({ variant: 'destructive', title: 'Erreur', description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const planName = (id: string) => plans.find((plan) => plan.id === id)?.name || 'Plan inactif';

  if (!activeCompanyId) {
    return <div className="p-6 text-muted-foreground">Sélectionnez ou configurez une entreprise avant de demander un abonnement.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold">Abonnement</h1>
        <p className="mt-2 text-muted-foreground">
          Activez le plan Gratuit immédiatement ou envoyez la preuve de paiement du plan Pro.
        </p>
      </div>

      {loadError && (
        <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive" role="alert">
          {loadError}
          <Button className="ml-3" size="sm" variant="outline" onClick={() => void loadPageData()}>
            Réessayer
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{isFreePlanSelected ? 'Activer le plan Gratuit' : 'Demander le plan Pro'}</CardTitle>
          <CardDescription>
            {isFreePlanSelected
              ? 'Le plan Gratuit est activé immédiatement pour votre entreprise.'
              : 'Payez par versement ou virement, puis joignez votre preuve (PDF, JPG, PNG ou WebP, 10 Mo maximum). Hamza activera le plan après vérification.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun plan actif n’est disponible actuellement.</p>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="subscription-plan">Plan demandé</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId} disabled={pendingRequestExists}>
                  <SelectTrigger id="subscription-plan"><SelectValue placeholder="Sélectionner un plan" /></SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} — {Number(plan.price_year).toLocaleString('fr-FR')} TND{plan.price_year > 0 ? ` / ${plan.duration}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isFreePlanSelected ? (
                pendingRequestExists ? (
                  <p className="rounded-md bg-muted p-3 text-sm">
                    Une demande Pro est en cours de vérification. Attendez la décision de Hamza avant de changer de plan.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="rounded-md bg-muted p-3 text-sm">
                      Gratuit : 15 factures par mois et 1 utilisateur.
                    </p>
                    <Button type="button" onClick={() => void activateFreePlan()} disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Activer Gratuit
                    </Button>
                  </div>
                )
              ) : (
                <form className="space-y-5" onSubmit={submitRequest}>
                  <div className="space-y-2">
                    <Label htmlFor="payment-method">Mode de paiement</Label>
                    <Select value={paymentMethod} onValueChange={(value: 'cash_deposit' | 'bank_transfer') => setPaymentMethod(value)} disabled={pendingRequestExists}>
                      <SelectTrigger id="payment-method"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash_deposit">Versement espèces</SelectItem>
                        <SelectItem value="bank_transfer">Virement bancaire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-reference">Référence du paiement (facultatif)</Label>
                    <Input
                      id="payment-reference"
                      value={paymentReference}
                      onChange={(event) => setPaymentReference(event.target.value)}
                      disabled={pendingRequestExists}
                      maxLength={120}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-note">Note (facultatif)</Label>
                    <Textarea
                      id="payment-note"
                      value={paymentNote}
                      onChange={(event) => setPaymentNote(event.target.value)}
                      disabled={pendingRequestExists}
                      maxLength={500}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment-proof">Preuve de paiement</Label>
                    <Input
                      id="payment-proof"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                      onChange={(event) => setProof(event.target.files?.[0] || null)}
                      disabled={pendingRequestExists}
                      required={!pendingRequestExists}
                    />
                    {proof && <p className="text-sm text-muted-foreground">{proof.name}</p>}
                  </div>

                  {pendingRequestExists ? (
                    <p className="rounded-md bg-muted p-3 text-sm">
                      Une demande est déjà en cours de vérification. Vous pourrez envoyer une autre demande après sa décision.
                    </p>
                  ) : (
                    <Button type="submit" disabled={submitting}>
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Envoyer la demande à Hamza
                    </Button>
                  )}
                </form>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historique des demandes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune demande envoyée.</p>
          ) : requests.map((request) => (
            <div key={request.id} className="flex flex-col gap-2 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{planName(request.plan_id)}</p>
                <p className="text-sm text-muted-foreground">
                  {paymentMethodLabels[request.payment_method] || request.payment_method}
                  {request.payment_reference ? ` · ${request.payment_reference}` : ''}
                  {' · '}{new Date(request.created_at).toLocaleDateString('fr-FR')}
                </p>
                {request.review_note && <p className="mt-1 text-sm text-muted-foreground">{request.review_note}</p>}
                {request.payment_note && <p className="mt-1 text-sm text-muted-foreground">{request.payment_note}</p>}
              </div>
              <Badge variant={request.status === 'approved' ? 'default' : request.status === 'rejected' ? 'destructive' : 'outline'}>
                {requestStatusLabels[request.status] || request.status}
              </Badge>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
            <FileText className="h-4 w-4" />
            Les justificatifs sont privés et visibles uniquement par l’administration.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
