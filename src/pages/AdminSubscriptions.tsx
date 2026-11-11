import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type Plan = { id: string; name: string; price_year: number; duration: string; active: boolean };
type Company = { id: string; name: string };
type Profile = { user_id: string; email: string | null };
type PaymentRequest = {
  id: string;
  company_id: string;
  requested_by: string;
  plan_id: string;
  payment_method: string;
  payment_reference: string | null;
  payment_note: string | null;
  proof_path: string;
  status: string;
  review_note: string | null;
  created_at: string;
};
type CompanyPlan = {
  id: string;
  company_id: string | null;
  plan_id: string;
  active: boolean;
  started_at: string | null;
  expires_at: string | null;
};

const paymentMethodLabels: Record<string, string> = {
  cash_deposit: 'Versement espèces',
  bank_transfer: 'Virement bancaire',
};

const requestStatusLabels: Record<string, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  rejected: 'Refusée',
};

function toLocalDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export default function AdminSubscriptions() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [companyPlans, setCompanyPlans] = useState<CompanyPlan[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [requestExpiry, setRequestExpiry] = useState<Record<string, string>>({});
  const [selectedPlans, setSelectedPlans] = useState<Record<string, string>>({});
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [selectedProof, setSelectedProof] = useState<{ url: string; isImage: boolean } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [requestResult, planResult, companyResult, companyPlanResult] = await Promise.all([
      supabase.from('subscription_payment_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('plans').select('id,name,price_year,duration,active').order('display_order'),
      supabase.from('companies').select('id,name').order('name'),
      supabase.from('company_plans').select('id,company_id,plan_id,active,started_at,expires_at'),
    ]);

    const firstError = requestResult.error || planResult.error || companyResult.error || companyPlanResult.error;
    if (firstError) {
      setLoadError(firstError.message);
      setLoading(false);
      return;
    }

    const requestRows = requestResult.data || [];
    setRequests(requestRows);
    setPlans(planResult.data || []);
    setCompanies(companyResult.data || []);
    setCompanyPlans(companyPlanResult.data || []);
    setSelectedPlans((previous) => {
      const next = { ...previous };
      (companyPlanResult.data || []).forEach((subscription) => {
        if (subscription.company_id) next[subscription.company_id] = subscription.plan_id;
      });
      return next;
    });
    setSubscriptionExpiry((previous) => {
      const next = { ...previous };
      (companyPlanResult.data || []).forEach((subscription) => {
        if (subscription.company_id) next[subscription.company_id] = toLocalDateTime(subscription.expires_at);
      });
      return next;
    });

    const userIds = [...new Set(requestRows.map((request) => request.requested_by))];
    if (userIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('user_id,email')
        .in('user_id', userIds);
      if (profileError) {
        setLoadError(profileError.message);
        setLoading(false);
        return;
      }
      setProfiles(profileRows || []);
    } else {
      setProfiles([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const companyById = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);
  const planById = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);
  const profileById = useMemo(() => new Map(profiles.map((profile) => [profile.user_id, profile])), [profiles]);
  const activePlanByCompany = useMemo(() => {
    const map = new Map<string, CompanyPlan>();
    companyPlans.forEach((subscription) => {
      if (subscription.company_id && subscription.active) map.set(subscription.company_id, subscription);
    });
    return map;
  }, [companyPlans]);

  const reviewRequest = async (request: PaymentRequest, decision: 'approved' | 'rejected') => {
    setWorkingId(request.id);
    const expiry = requestExpiry[request.id];
    const { error } = await supabase.rpc('admin_review_subscription_request', {
      p_request_id: request.id,
      p_decision: decision,
      p_review_note: reviewNotes[request.id]?.trim() || null,
      p_expires_at: decision === 'approved' && expiry ? new Date(expiry).toISOString() : null,
    });
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      toast({
        title: decision === 'approved' ? 'Abonnement activé' : 'Demande refusée',
        description: decision === 'approved'
          ? 'Le plan et l’accès payant de l’entreprise ont été mis à jour.'
          : 'La demande a été refusée.',
      });
      await loadData();
    }
    setWorkingId(null);
  };

  const changeCompanyPlan = async (companyId: string, active: boolean) => {
    const planId = active ? selectedPlans[companyId] : null;
    if (active && !planId) {
      toast({ variant: 'destructive', title: 'Plan requis', description: 'Choisissez un plan avant de l’activer.' });
      return;
    }

    setWorkingId(companyId);
    const expiry = subscriptionExpiry[companyId];
    const { error } = await supabase.rpc('admin_set_company_plan', {
      p_company_id: companyId,
      p_plan_id: planId,
      p_active: active,
      p_expires_at: active && expiry ? new Date(expiry).toISOString() : null,
    });

    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    } else {
      toast({
        title: active ? 'Plan activé' : 'Abonnement annulé',
        description: active ? 'Le plan et l’accès de l’entreprise sont à jour.' : 'L’accès payant a été désactivé.',
      });
      await loadData();
    }
    setWorkingId(null);
  };

  const showProof = async (proofPath: string) => {
    const { data, error } = await supabase.storage
      .from('subscription-proofs')
      .createSignedUrl(proofPath, 300);
    if (error) {
      toast({ variant: 'destructive', title: 'Preuve indisponible', description: error.message });
      return;
    }
    setSelectedProof({
      url: data.signedUrl,
      isImage: /\.(jpe?g|png|webp)$/i.test(proofPath),
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Abonnements clients</h1>
          <p className="mt-2 text-muted-foreground">Vérifiez les paiements et gérez les plans des entreprises.</p>
        </div>
        <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Actualiser
        </Button>
      </div>

      {loadError && (
        <div className="rounded-md border border-destructive/50 p-4 text-sm text-destructive" role="alert">
          Erreur de chargement : {loadError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Demandes de paiement</CardTitle>
          <CardDescription>Une demande approuvée active le plan et la période payée de l’entreprise.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : requests.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Aucune demande de paiement.</p>
          ) : (
            <div className="space-y-4">
              {requests.map((request) => {
                const plan = planById.get(request.plan_id);
                const company = companyById.get(request.company_id);
                const requester = profileById.get(request.requested_by);
                const busy = workingId === request.id;

                return (
                  <div key={request.id} className="space-y-4 rounded-lg border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{company?.name || 'Entreprise inconnue'}</h3>
                          <Badge variant={request.status === 'approved' ? 'default' : request.status === 'rejected' ? 'destructive' : 'outline'}>
                            {requestStatusLabels[request.status] || request.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {plan?.name || 'Plan inconnu'} · {plan ? `${Number(plan.price_year).toLocaleString('fr-FR')} TND / ${plan.duration}` : ''}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Demandé par {requester?.email || request.requested_by}
                          {' · '}{paymentMethodLabels[request.payment_method] || request.payment_method}
                          {request.payment_reference ? ` · Référence ${request.payment_reference}` : ''}
                          {' · '}{new Date(request.created_at).toLocaleString('fr-FR')}
                        </p>
                        {request.payment_note && <p className="text-sm">{request.payment_note}</p>}
                        {request.review_note && <p className="text-sm text-muted-foreground">Décision : {request.review_note}</p>}
                      </div>
                      <Button variant="outline" onClick={() => void showProof(request.proof_path)}>
                        <ExternalLink className="mr-2 h-4 w-4" /> Voir la preuve
                      </Button>
                    </div>

                    {request.status === 'pending' && (
                      <div className="grid gap-3 border-t pt-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
                        <div className="space-y-2">
                          <Label htmlFor={`review-note-${request.id}`}>Note de décision (facultatif)</Label>
                          <Textarea
                            id={`review-note-${request.id}`}
                            value={reviewNotes[request.id] || ''}
                            onChange={(event) => setReviewNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                            maxLength={500}
                            rows={2}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`request-expiry-${request.id}`}>Fin d’abonnement (facultatif)</Label>
                          <Input
                            id={`request-expiry-${request.id}`}
                            type="datetime-local"
                            value={requestExpiry[request.id] || ''}
                            onChange={(event) => setRequestExpiry((current) => ({ ...current, [request.id]: event.target.value }))}
                          />
                          <p className="text-xs text-muted-foreground">Vide = durée standard du plan.</p>
                        </div>
                        <Button disabled={busy} onClick={() => void reviewRequest(request, 'approved')}>
                          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Approuver et activer
                        </Button>
                        <Button variant="destructive" disabled={busy} onClick={() => void reviewRequest(request, 'rejected')}>
                          Refuser
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plans attribués aux entreprises</CardTitle>
          <CardDescription>Vous pouvez modifier le plan, sa date de fin, ou annuler l’abonnement à tout moment.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-6 text-sm text-muted-foreground">Chargement…</p>
          ) : companies.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">Aucune entreprise trouvée.</p>
          ) : (
            <div className="space-y-3">
              {companies.map((company) => {
                const subscription = activePlanByCompany.get(company.id);
                const currentPlan = subscription ? planById.get(subscription.plan_id) : null;
                const busy = workingId === company.id;
                return (
                  <div key={company.id} className="grid gap-3 rounded-md border p-4 md:grid-cols-[1.2fr_1fr_1fr_auto_auto] md:items-end">
                    <div>
                      <p className="font-medium">{company.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {subscription?.active
                          ? `${currentPlan?.name || 'Plan attribué'} · ${subscription.expires_at ? `jusqu’au ${new Date(subscription.expires_at).toLocaleDateString('fr-FR')}` : 'sans date de fin'}`
                          : 'Aucun abonnement actif'}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`company-plan-${company.id}`}>Plan</Label>
                      <Select
                        value={selectedPlans[company.id] || ''}
                        onValueChange={(value) => setSelectedPlans((current) => ({ ...current, [company.id]: value }))}
                      >
                        <SelectTrigger id={`company-plan-${company.id}`}><SelectValue placeholder="Choisir un plan" /></SelectTrigger>
                        <SelectContent>
                          {plans.filter((plan) => plan.active).map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`company-expiry-${company.id}`}>Fin (facultatif)</Label>
                      <Input
                        id={`company-expiry-${company.id}`}
                        type="datetime-local"
                        value={subscriptionExpiry[company.id] || ''}
                        onChange={(event) => setSubscriptionExpiry((current) => ({ ...current, [company.id]: event.target.value }))}
                      />
                    </div>
                    <Button disabled={busy} onClick={() => void changeCompanyPlan(company.id, true)}>
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {subscription ? 'Enregistrer' : 'Activer'}
                    </Button>
                    {subscription && (
                      <Button variant="destructive" disabled={busy} onClick={() => void changeCompanyPlan(company.id, false)}>
                        Annuler
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedProof)} onOpenChange={(open) => !open && setSelectedProof(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Preuve de paiement</DialogTitle></DialogHeader>
          {selectedProof && (
            selectedProof.isImage
              ? <img src={selectedProof.url} alt="Preuve de paiement" className="max-h-[75vh] w-full object-contain" />
              : <iframe title="Preuve de paiement PDF" src={selectedProof.url} className="h-[75vh] w-full rounded-md border" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
