import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, Receipt, FileText, Plus, Trash2, Save, Upload, Image } from 'lucide-react';
import { currencies } from '@/lib/numberToWords';
import { logger } from '@/lib/logger';
import SetupWizard from '@/components/settings/SetupWizard';
import type { Tables } from '@/integrations/supabase/types';
import { useSearchParams } from 'react-router-dom';

interface VatRate {
  rate: number;
  label: string;
}

interface CompanySettings {
  id: string;
  legal_name: string;
  address: string;
  city: string;
  postal_code: string;
  company_country: string;
  phone: string;
  email: string;
  logo_url: string;
  matricule_fiscale: string;
  company_vat_number: string;
  company_tax_id: string;
  company_trade_register: string;
  default_currency: string;
  activity: string;
  default_vat_rate: number;
  vat_rates: VatRate[];
  invoice_prefix: string;
  invoice_next_number: number;
  invoice_format: string;
  invoice_number_padding: number;
  signature_url: string;
  stamp_url: string;
  type: string;
  is_configured: boolean;
  bank_accounts?: { bank: string; rib: string }[];
}

const defaultSettings: Omit<CompanySettings, 'id' | 'type' | 'is_configured'> = {
  legal_name: '',
  address: '',
  city: '',
  postal_code: '',
  company_country: 'Tunisie',
  phone: '',
  email: '',
  logo_url: '',
  matricule_fiscale: '',
  company_vat_number: '',
  company_tax_id: '',
  company_trade_register: '',
  default_currency: 'TND',
  activity: '',
  default_vat_rate: 19,
  vat_rates: [
    { rate: 0, label: 'Exonéré' },
    { rate: 7, label: 'Réduit 7%' },
    { rate: 13, label: 'Intermédiaire 13%' },
    { rate: 19, label: 'Standard 19%' }
  ],
  invoice_prefix: 'FAC',
  invoice_next_number: 1,
  invoice_format: '{prefix}-{year}-{number}',
  invoice_number_padding: 4,
  signature_url: '',
  stamp_url: ''
  ,
  bank_accounts: []
};

export default function Settings() {
  const { user, activeCompanyId, setActiveCompany, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supportsBankAccounts, setSupportsBankAccounts] = useState(false);
  const [supportsIsConfigured, setSupportsIsConfigured] = useState(false);
  const [supportedColumns, setSupportedColumns] = useState<Set<string>>(new Set());
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [newVatRate, setNewVatRate] = useState({ rate: 0, label: '' });
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [setupStep, setSetupStep] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const completingSetupRef = useRef(false);

  const OTHER_ACTIVITY_VALUE = 'Autre';
  const [activitySelectValue, setActivitySelectValue] = useState<string>('');
  const [customActivity, setCustomActivity] = useState<string>('');

  // Common activity labels used in Tunisia (broad, business-friendly categories)
  const TUNISIAN_ACTIVITIES = [
    'Agriculture / Élevage',
    'Pêche / Aquaculture',
    'Industries agroalimentaires',
    'Industries textiles / habillement',
    'Industries du cuir / chaussures',
    'Industries du bois / papier / imprimerie',
    'Industries chimiques / pharmaceutiques',
    'Plasturgie / caoutchouc',
    'Matériaux de construction (ciment, briques, etc.)',
    'Métallurgie / sidérurgie',
    'Mécanique / maintenance industrielle',
    'Électricité / électronique',
    'Fabrication de meubles',
    'Énergie / utilities',
    'Eau / assainissement / environnement',
    'Construction / BTP',
    'Promotion immobilière',
    'Architecture / ingénierie / bureau d’études',
    'Travaux publics / VRD',
    'Commerce de gros',
    'Commerce de détail',
    'Import / Export',
    'Distribution / logistique',
    'Transport routier',
    'Transport maritime',
    'Transport aérien',
    'Entreposage / stockage',
    'Hôtellerie',
    'Restauration / cafés',
    'Tourisme / agences de voyage',
    'Événementiel',
    'Télécommunications',
    'Informatique (services)',
    'Développement logiciel',
    'E-commerce',
    'Sécurité informatique',
    'Conseil / stratégie',
    'Comptabilité / audit',
    'Juridique / avocat / notaire',
    'Assurance',
    'Banque / finance',
    'Immobilier (agence)',
    'Location de véhicules',
    'Services aux entreprises',
    'Nettoyage / hygiène',
    'Sécurité / gardiennage',
    'Recrutement / RH',
    'Formation / éducation',
    'Santé / clinique / cabinet',
    'Pharmacie / parapharmacie',
    'Laboratoire / analyses',
    'Vétérinaire',
    'Beauté / esthétique / coiffure',
    'Sport / loisirs',
    'Culture / médias / publicité',
    'Design / communication',
    'Photographie / audiovisuel',
    'Artisanat',
    'Réparation (électroménager, téléphone, etc.)',
    'Automobile (vente / réparation)',
    'Pièces détachées',
    'Boulangerie / pâtisserie',
    'Boucherie / poissonnerie',
    'Supermarché / épicerie',
    'Parfumerie',
    'Librairie / papeterie',
    'Matériel informatique / bureautique',
    'Matériel électrique',
    'Quincaillerie',
    'Autre',
  ] as const;
  
  // Get the default tab from URL query parameter
  const defaultTab = searchParams.get('tab') || 'company';

  useEffect(() => {
    if (!user) return;
    // Wait for auth provider to resolve memberships/activeCompanyId.
    // Otherwise, we may incorrectly show the wizard and create duplicate companies.
    if (authLoading) return;
    // If user has no company yet, initialize wizard with defaults.
    if (!activeCompanyId) {
      setSettings({
        id: '',
        type: 'personne_physique',
        is_configured: false,
        ...defaultSettings,
      });
      setSupportsBankAccounts(false);
      setSupportsIsConfigured(false);
      setSupportedColumns(new Set());
      setShowSetupWizard(true);
      setSetupStep(1);
      setLoading(false);
      fetchProfile();
      return;
    }

    fetchSettings();
    fetchProfile();
  }, [user, activeCompanyId, authLoading]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user?.id)
      .maybeSingle();
    setProfile(data);
  };

  const fetchSettings = async () => {
    if (!activeCompanyId) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', activeCompanyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Detect if the columns exist on the backend
        setSupportsBankAccounts(Object.prototype.hasOwnProperty.call(data, 'bank_accounts'));
        setSupportsIsConfigured(Object.prototype.hasOwnProperty.call(data, 'is_configured'));
        setSupportedColumns(new Set(Object.keys(data)));
        setSettings({
          ...data,
          legal_name: data.legal_name || (data as any).name || '',
          address: data.address || '',
          city: data.city || '',
          postal_code: data.postal_code || '',
          company_country: data.company_country || 'Tunisie',
          phone: data.phone || '',
          email: data.email || '',
          logo_url: data.logo_url || '',
          matricule_fiscale: (data as any).matricule_fiscale || '',
          company_vat_number: data.company_vat_number || '',
          company_tax_id: data.company_tax_id || '',
          company_trade_register: data.company_trade_register || '',
          default_currency: data.default_currency || 'TND',
          activity: data.activity || '',
          default_vat_rate: data.default_vat_rate || 19,
          vat_rates: (data.vat_rates as unknown as VatRate[]) || defaultSettings.vat_rates,
          invoice_prefix: data.invoice_prefix || 'FAC',
          invoice_next_number: data.invoice_next_number || 1,
          invoice_format: data.invoice_format || '{prefix}-{year}-{number}',
          invoice_number_padding: data.invoice_number_padding || 4,
          signature_url: data.signature_url || '',
          stamp_url: data.stamp_url || ''
        });

        // Initialize activity select state.
        // If activity is not one of the predefined options, show it as a custom "Autre" value.
        const loadedActivity = (data.activity || '').trim();
        const isKnownActivity = loadedActivity && (TUNISIAN_ACTIVITIES as readonly string[]).includes(loadedActivity);
        if (isKnownActivity) {
          setActivitySelectValue(loadedActivity);
          setCustomActivity('');
        } else if (loadedActivity) {
          setActivitySelectValue(OTHER_ACTIVITY_VALUE);
          setCustomActivity(loadedActivity);
        } else {
          setActivitySelectValue('');
          setCustomActivity('');
        }
        
        // Show onboarding wizard when company is not configured.
        // Fallback: if the backend column doesn't exist yet, infer onboarding need from missing legal_name.
        const hasIsConfiguredColumn = Object.prototype.hasOwnProperty.call(data, 'is_configured');
        const needsOnboarding =
          (hasIsConfiguredColumn && (data as any).is_configured === false) ||
          (!data.legal_name && !(data as any).name);

        if (needsOnboarding) {
          setSetupStep(1);
          setShowSetupWizard(true);
        }
      }
    } catch (error) {
      logger.error('Erreur lors du chargement des paramètres:', error);
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleActivitySelectChange = (value: string) => {
    setActivitySelectValue(value);
    if (!settings) return;

    if (value === OTHER_ACTIVITY_VALUE) {
      // Keep current custom value (or empty) in settings.activity
      setSettings({ ...settings, activity: customActivity });
      return;
    }

    setCustomActivity('');
    setSettings({ ...settings, activity: value });
  };

  const handleCustomActivityChange = (value: string) => {
    setCustomActivity(value);
    if (!settings) return;
    setSettings({ ...settings, activity: value });
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user || !settings) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 2 Mo');
      return;
    }

    setUploadingLogo(true);
    try {
      // Delete old logo if exists
      if (settings?.logo_url) {
        try {
          const oldUrl = new URL(settings.logo_url);
          const oldPath = oldUrl.pathname.split('/company-assets/')[1];
          if (oldPath) {
            await supabase.storage.from('company-assets').remove([decodeURIComponent(oldPath)]);
          }
        } catch (e) {
          // Ignore deletion errors
        }
      }

      const fileExt = file.name.split('.').pop();
      // Storage policy requires first folder = auth.uid()
      const fileName = `${user.id}/${activeCompanyId}/logo-${Date.now()}.${fileExt}`;

      // Upload to company-assets bucket (public)
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(fileName);

      // Update local state
      const newSettings = { ...settings, logo_url: publicUrl };
      setSettings(newSettings);
      
      // Auto-save to database
      const { error } = await supabase
        .from('companies')
        .update({ logo_url: publicUrl })
        .eq('id', settings.id);

      if (error) throw error;
      
      toast.success('Logo téléchargé et enregistré');
    } catch (error) {
      logger.error('Erreur upload logo:', error);
      toast.error('Erreur lors du téléchargement du logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const removeLogo = async () => {
    if (!settings || !user) return;
    
    // Delete file from storage
    if (settings.logo_url) {
      try {
        const oldUrl = new URL(settings.logo_url);
        const oldPath = oldUrl.pathname.split('/company-assets/')[1];
        if (oldPath) {
          await supabase.storage.from('company-assets').remove([decodeURIComponent(oldPath)]);
        }
      } catch (e) {
        // Ignore deletion errors
      }
    }
    
    setSettings(prev => prev ? { ...prev, logo_url: '' } : null);
    
    // Auto-save removal to database
    if (settings.id) {
      try {
        const { error } = await supabase
          .from('companies')
          .update({ logo_url: null })
          .eq('id', settings.id);

        if (error) throw error;
        toast.success('Logo supprimé');
      } catch (error) {
        logger.error('Erreur suppression logo:', error);
        toast.error('Erreur lors de la suppression du logo');
      }
    }
  };

  const handleSignatureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    if (file.size > 1 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 1 Mo');
      return;
    }

    setUploadingSignature(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/signature-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(fileName);

      setSettings(prev => prev ? { ...prev, signature_url: publicUrl } : null);
      toast.success('Signature téléchargée avec succès');
    } catch (error) {
      logger.error('Erreur upload signature:', error);
      toast.error('Erreur lors du téléchargement de la signature');
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleStampUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image');
      return;
    }

    if (file.size > 1 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 1 Mo');
      return;
    }

    setUploadingStamp(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/stamp-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(fileName);

      setSettings(prev => prev ? { ...prev, stamp_url: publicUrl } : null);
      toast.success('Cachet téléchargé avec succès');
    } catch (error) {
      logger.error('Erreur upload cachet:', error);
      toast.error('Erreur lors du téléchargement du cachet');
    } finally {
      setUploadingStamp(false);
    }
  };

  const removeSignature = () => {
    setSettings(prev => prev ? { ...prev, signature_url: '' } : null);
  };

  const removeStamp = () => {
    setSettings(prev => prev ? { ...prev, stamp_url: '' } : null);
  };

  const saveSettings = async (
    companyIdOverride?: string,
    schemaOverride?: { supportedColumns?: Set<string>; supportsIsConfigured?: boolean }
  ) => {
    const companyId = companyIdOverride ?? activeCompanyId;
    if (!settings || !companyId) return;

    setSaving(true);
    try {
      const settingsToSave: any = {
        legal_name: settings.legal_name,
        address: settings.address,
        city: settings.city,
        postal_code: settings.postal_code,
        company_country: settings.company_country,
        phone: settings.phone,
        email: settings.email,
        logo_url: settings.logo_url,
        matricule_fiscale: settings.matricule_fiscale,
        company_vat_number: settings.company_vat_number,
        company_tax_id: settings.company_tax_id,
        company_trade_register: settings.company_trade_register,
        default_currency: settings.default_currency,
        activity: settings.activity,
        default_vat_rate: settings.default_vat_rate,
        vat_rates: JSON.parse(JSON.stringify(settings.vat_rates)),
        invoice_prefix: settings.invoice_prefix,
        invoice_next_number: settings.invoice_next_number,
        invoice_format: settings.invoice_format,
        invoice_number_padding: settings.invoice_number_padding,
        signature_url: settings.signature_url,
        stamp_url: settings.stamp_url,
        type: settings.type as 'personne_physique' | 'personne_morale',
      };

      const columns = schemaOverride?.supportedColumns ?? supportedColumns;
      const hasIsConfigured = schemaOverride?.supportsIsConfigured ?? supportsIsConfigured;

      // Include is_configured only if supported by remote schema
      if (hasIsConfigured) {
        settingsToSave.is_configured = true;
      }

      // Filter payload to only include columns supported by remote schema
      const payload: any = {};
      for (const [key, value] of Object.entries(settingsToSave)) {
        if (columns.has(key)) {
          payload[key] = value;
        }
      }

      const { error } = await supabase
        .from('companies')
        .update(payload)
        .eq('id', companyId);

      if (error) throw error;

      // Let global company settings listeners refresh (DashboardLayout redirect guard depends on this)
      try {
        window.dispatchEvent(new Event('company-settings-updated'));
      } catch (e) {
        void e;
      }

      toast.success('Paramètres enregistrés avec succès');
    } catch (error) {
      logger.error('Erreur lors de la sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde des paramètres');
    } finally {
      setSaving(false);
    }
  };

  const addVatRate = () => {
    if (!settings || !newVatRate.label || newVatRate.rate < 0) {
      toast.error('Veuillez remplir le taux et le libellé');
      return;
    }

    const exists = settings.vat_rates.some(r => r.rate === newVatRate.rate);
    if (exists) {
      toast.error('Ce taux existe déjà');
      return;
    }

    setSettings({
      ...settings,
      vat_rates: [...settings.vat_rates, { ...newVatRate }].sort((a, b) => a.rate - b.rate)
    });
    setNewVatRate({ rate: 0, label: '' });
  };

  const removeVatRate = (rate: number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      vat_rates: settings.vat_rates.filter(r => r.rate !== rate)
    });
  };

  const getInvoicePreview = () => {
    if (!settings) return '';
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const number = String(1).padStart(settings.invoice_number_padding, '0');
    const examplePrefix = 'FAC';
    return String(settings.invoice_format)
      .replace('{prefix}', examplePrefix)
      .replace('{year}', year)
      .replace('{month}', month)
      .replace('{number}', number);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!settings) return null;

  const handleCompleteSetup = async () => {
    // Idempotency guard: prevent double-click / multiple submissions from creating multiple companies.
    if (completingSetupRef.current) return;
    completingSetupRef.current = true;

    // If the user has no company yet, create it now (only on wizard completion).
    try {
      if (!activeCompanyId) {
        // Try insert with both name and legal_name for compatibility.
        const baseName = (settings.legal_name || '').trim() || (profile?.full_name || '').trim() || user?.email || 'Entreprise';

        const tryInsert = async (payload: any) => {
          const res = await (supabase
            .from('companies' as any)
            .insert(payload)
            .select('*')
            .single() as any);
          return res;
        };

        let insertedCompany: any | null = null;
        let insertError: any | null = null;

        // Attempt 1: name + legal_name
        ({ data: insertedCompany, error: insertError } = await tryInsert({
          name: baseName,
          legal_name: baseName,
          type: settings.type,
        }));

        // Attempt 1b: name + legal_name (without type) for older schemas
        if (insertError && String((insertError as any).code || '') === 'PGRST204') {
          ({ data: insertedCompany, error: insertError } = await tryInsert({
            name: baseName,
            legal_name: baseName,
          }));
        }

        // Attempt 2: only legal_name
        if (insertError && String(insertError.message || '').toLowerCase().includes('column') && String(insertError.message || '').toLowerCase().includes('name')) {
          ({ data: insertedCompany, error: insertError } = await tryInsert({
            legal_name: baseName,
            type: settings.type,
          }));
        }

        // Attempt 2b: only legal_name (without type) for older schemas
        if (insertError && String((insertError as any).code || '') === 'PGRST204') {
          ({ data: insertedCompany, error: insertError } = await tryInsert({
            legal_name: baseName,
          }));
        }

        // Attempt 3: only name
        if (insertError && String(insertError.message || '').toLowerCase().includes('column') && String(insertError.message || '').toLowerCase().includes('legal_name')) {
          ({ data: insertedCompany, error: insertError } = await tryInsert({
            name: baseName,
            type: settings.type,
          }));
        }

        // Attempt 3b: only name (without type) for older schemas
        if (insertError && String((insertError as any).code || '') === 'PGRST204') {
          ({ data: insertedCompany, error: insertError } = await tryInsert({
            name: baseName,
          }));
        }

        if (insertError) throw insertError;
        if (!insertedCompany?.id) throw new Error('Company creation failed');

        // Link user as company_admin
        const { error: linkErr } = await supabase
          .from('company_users' as any)
          .insert({ user_id: user!.id, company_id: insertedCompany.id, role: 'company_admin' });
        if (linkErr) throw linkErr;

        // Backward compatibility: assign legacy app role for navigation/permissions
        await supabase
          .from('user_roles' as any)
          .upsert({ user_id: user!.id, role: 'admin' }, { onConflict: 'user_id' } as any);

        // Make it the active company in the app
        setActiveCompany(insertedCompany.id);

        // Update local schema detection using returned row
        const nextSupportedColumns = new Set(Object.keys(insertedCompany));
        const nextSupportsIsConfigured = Object.prototype.hasOwnProperty.call(insertedCompany, 'is_configured');
        setSupportsBankAccounts(Object.prototype.hasOwnProperty.call(insertedCompany, 'bank_accounts'));
        setSupportsIsConfigured(nextSupportsIsConfigured);
        setSupportedColumns(nextSupportedColumns);
        setSettings((prev) => prev ? { ...prev, id: insertedCompany.id } : prev);

        // Now save the wizard fields into the created company
        await saveSettings(insertedCompany.id, {
          supportedColumns: nextSupportedColumns,
          supportsIsConfigured: nextSupportsIsConfigured,
        });
      }

      // Active company exists already, just save wizard changes.
      await saveSettings();

      setShowSetupWizard(false);
    } catch (e) {
      logger.error('Erreur création entreprise:', e);
      const anyErr = e as any;
      const message =
        (typeof anyErr?.message === 'string' && anyErr.message.trim()) ||
        (typeof anyErr?.error_description === 'string' && anyErr.error_description.trim()) ||
        (typeof anyErr?.details === 'string' && anyErr.details.trim()) ||
        (typeof anyErr?.hint === 'string' && anyErr.hint.trim()) ||
        '';
      toast.error(message ? `Erreur lors de la création de l'entreprise: ${message}` : 'Erreur lors de la création de l\'entreprise');
      return;
    } finally {
      completingSetupRef.current = false;
    }
  };

  // Render setup wizard for new users
  if (showSetupWizard) {
    return (
      <SetupWizard 
        onComplete={handleCompleteSetup}
        currentStep={setupStep}
        setCurrentStep={setSetupStep}
      >
        {setupStep === 1 && (
          <div className="space-y-4">
            {/* Company info fields for wizard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wizard_legal_name">Raison sociale</Label>
                <Input
                  id="wizard_legal_name"
                  value={settings.legal_name}
                  onChange={(e) => setSettings({ ...settings, legal_name: e.target.value })}
                  placeholder="Nom de votre entreprise"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wizard_activity">Activité</Label>
                <Select
                  value={activitySelectValue}
                  onValueChange={handleActivitySelectChange}
                >
                  <SelectTrigger id="wizard_activity">
                    <SelectValue placeholder="Sélectionner une activité" />
                  </SelectTrigger>
                  <SelectContent>
                    {TUNISIAN_ACTIVITIES.map((activity) => (
                      <SelectItem key={activity} value={activity}>
                        {activity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {activitySelectValue === OTHER_ACTIVITY_VALUE && (
                  <div className="space-y-2">
                    <Label htmlFor="wizard_activity_other">Précisez votre activité</Label>
                    <Input
                      id="wizard_activity_other"
                      value={customActivity}
                      onChange={(e) => handleCustomActivityChange(e.target.value)}
                      placeholder="Ex: Vente en ligne de vêtements"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wizard_email">Email</Label>
                <Input
                  id="wizard_email"
                  type="email"
                  value={settings.email}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  placeholder="contact@entreprise.tn"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wizard_phone">Téléphone</Label>
                <Input
                  id="wizard_phone"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="+216 XX XXX XXX"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wizard_address">Adresse</Label>
              <Input
                id="wizard_address"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                placeholder="Adresse complète"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wizard_city">Ville</Label>
                <Input
                  id="wizard_city"
                  value={settings.city}
                  onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                  placeholder="Tunis"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wizard_postal">Code postal</Label>
                <Input
                  id="wizard_postal"
                  value={settings.postal_code}
                  onChange={(e) => setSettings({ ...settings, postal_code: e.target.value })}
                  placeholder="1000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wizard_tax_id">Matricule fiscal</Label>
                <Input
                  id="wizard_tax_id"
                  value={settings.company_tax_id}
                  onChange={(e) => setSettings({ ...settings, company_tax_id: e.target.value })}
                  placeholder="XXXXXXX/X/X/XXX"
                />
              </div>
            </div>
          </div>
        )}
        
        {setupStep === 2 && (
          <div className="space-y-4">
            {/* Invoice format fields for wizard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="wizard_padding">Nombre de chiffres</Label>
                <Select
                  value={String(settings.invoice_number_padding)}
                  onValueChange={(value) => setSettings({ ...settings, invoice_number_padding: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 (001)</SelectItem>
                    <SelectItem value="4">4 (0001)</SelectItem>
                    <SelectItem value="5">5 (00001)</SelectItem>
                    <SelectItem value="6">6 (000001)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="wizard_format">Modèle</Label>
                <Select
                  value={settings.invoice_format}
                  onValueChange={(value) => setSettings({ ...settings, invoice_format: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="{prefix}-{year}-{number}">type_doc-année-numéro</SelectItem>
                      <SelectItem value="{year}-{month}-{number}">année-mois-numéro</SelectItem>
                      <SelectItem value="{year}-{number}">année-numéro</SelectItem>
                      <SelectItem value="{number}">numéro</SelectItem>
                      <SelectItem value="{year} {number}">année numéro</SelectItem>
                      <SelectItem value="{prefix}-{number}">type_doc-numéro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wizard_currency">Devise par défaut</Label>
              <Select
                value={settings.default_currency}
                onValueChange={(value) => setSettings({ ...settings, default_currency: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une devise" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(currencies).map(([code, info]) => (
                    <SelectItem key={code} value={code}>
                      {info.symbol} - {info.name.charAt(0).toUpperCase() + info.name.slice(1)} ({code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-primary/10 rounded-lg">
              <Label className="text-muted-foreground">Aperçu de la prochaine facture</Label>
              <p className="text-2xl font-mono font-bold mt-2">{getInvoicePreview()}</p>
            </div>
          </div>
        )}
        
        {setupStep === 3 && (
          <div className="space-y-4">
            {/* VAT settings for wizard */}
            <div className="space-y-2">
              <Label>Taux TVA par défaut</Label>
              <Select
                value={String(settings.default_vat_rate)}
                onValueChange={(value) => setSettings({ ...settings, default_vat_rate: Number(value) })}
              >
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="Sélectionner un taux" />
                </SelectTrigger>
                <SelectContent>
                  {settings.vat_rates.map((vat) => (
                    <SelectItem key={vat.rate} value={String(vat.rate)}>
                      {vat.label} ({vat.rate}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Taux disponibles</Label>
              <div className="grid grid-cols-2 gap-2">
                {settings.vat_rates.map((vat) => (
                  <div key={vat.rate} className="p-3 bg-primary/10 rounded-lg flex justify-between items-center">
                    <span>{vat.rate}% - {vat.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Vous pourrez ajouter ou modifier les taux TVA après la configuration initiale.
              </p>
            </div>
          </div>
        )}
      </SetupWizard>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Paramètres</h1>
          <p className="text-muted-foreground">Configuration de votre entreprise et facturation</p>
        </div>
        <Button onClick={() => saveSettings()} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 bg-primary/10">
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Entreprise
          </TabsTrigger>
          <TabsTrigger value="vat" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            TVA
          </TabsTrigger>
          <TabsTrigger value="invoicing" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Facturation
          </TabsTrigger>
        </TabsList>

        {/* Données Entreprise */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Informations de la société</CardTitle>
              <CardDescription>
                Ces informations apparaîtront sur vos factures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo de l'entreprise */}
              <div className="space-y-3">
                <Label>Logo de l'entreprise</Label>
                <div className="flex items-center gap-4">
                  {settings.logo_url ? (
                    <div className="relative">
                      <img
                        src={settings.logo_url}
                        alt="Logo entreprise"
                        className="h-20 w-20 object-contain rounded-lg border bg-background"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={removeLogo}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                      <Image className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  )}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingLogo ? 'Téléchargement...' : 'Télécharger un logo'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Format: JPG, PNG. Taille max: 2 Mo
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="legal_name">Raison sociale</Label>
                  <Input
                    id="legal_name"
                    value={settings.legal_name}
                    onChange={(e) => setSettings({ ...settings, legal_name: e.target.value })}
                    placeholder="Nom de votre entreprise"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activity">Activité</Label>
                  <Select
                    value={activitySelectValue}
                    onValueChange={handleActivitySelectChange}
                  >
                    <SelectTrigger id="activity">
                      <SelectValue placeholder="Sélectionner une activité" />
                    </SelectTrigger>
                    <SelectContent>
                      {TUNISIAN_ACTIVITIES.map((activity) => (
                        <SelectItem key={activity} value={activity}>
                          {activity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {activitySelectValue === OTHER_ACTIVITY_VALUE && (
                    <div className="space-y-2">
                      <Label htmlFor="activity_other">Précisez votre activité</Label>
                      <Input
                        id="activity_other"
                        value={customActivity}
                        onChange={(e) => handleCustomActivityChange(e.target.value)}
                        placeholder="Ex: Services informatiques (freelance)"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type d'entreprise</Label>
                  <Select
                    value={settings.type}
                    onValueChange={(value) => setSettings({ ...settings, type: value })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Sélectionner le type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personne_physique">Personne Physique</SelectItem>
                      <SelectItem value="personne_morale">Entreprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={settings.email}
                    onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                    placeholder="contact@entreprise.tn"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default_currency">Devise par défaut</Label>
                  <Select
                    value={settings.default_currency}
                    onValueChange={(value) => setSettings({ ...settings, default_currency: value })}
                  >
                    <SelectTrigger id="default_currency">
                      <SelectValue placeholder="Sélectionner une devise" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(currencies).map(([code, info]) => (
                        <SelectItem key={code} value={code}>
                          {info.symbol} - {info.name.charAt(0).toUpperCase() + info.name.slice(1)} ({code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="Adresse complète"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    value={settings.city}
                    onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                    placeholder="Tunis"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postal_code">Code postal</Label>
                  <Input
                    id="postal_code"
                    value={settings.postal_code}
                    onChange={(e) => setSettings({ ...settings, postal_code: e.target.value })}
                    placeholder="1000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_country">Pays</Label>
                  <Input
                    id="company_country"
                    value={settings.company_country}
                    onChange={(e) => setSettings({ ...settings, company_country: e.target.value })}
                    placeholder="Tunisie"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Téléphone</Label>
                  <Input
                    id="phone"
                    value={settings.phone}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    placeholder="+216 XX XXX XXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_vat_number">Numéro TVA</Label>
                  <Input
                    id="company_vat_number"
                    value={settings.company_vat_number}
                    onChange={(e) => setSettings({ ...settings, company_vat_number: e.target.value })}
                    placeholder="Matricule fiscal TVA"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_tax_id">Matricule fiscal</Label>
                  <Input
                    id="company_tax_id"
                    value={settings.company_tax_id}
                    onChange={(e) => setSettings({ ...settings, company_tax_id: e.target.value })}
                    placeholder="XXXXXXX/X/X/XXX"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_trade_register">Registre de commerce</Label>
                  <Input
                    id="company_trade_register"
                    value={settings.company_trade_register}
                    onChange={(e) => setSettings({ ...settings, company_trade_register: e.target.value })}
                    placeholder="N° RC"
                  />
                </div>
              </div>

              {/* Signature & Cachet */}
              <div className="space-y-3 pt-4 border-t">
                <Label className="text-base font-semibold">Signature & Cachet</Label>
                <p className="text-sm text-muted-foreground">
                  Ces images apparaîtront sur vos factures générées
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Signature */}
                  <div className="space-y-2">
                    <Label>Signature</Label>
                    <div className="flex items-center gap-4">
                      {settings.signature_url ? (
                        <div className="relative">
                          <img
                            src={settings.signature_url}
                            alt="Signature"
                            className="h-16 w-32 object-contain rounded-lg border bg-background"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={removeSignature}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="h-16 w-32 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                          <span className="text-xs text-muted-foreground/50">Signature</span>
                        </div>
                      )}
                      <div>
                        <input
                          ref={signatureInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleSignatureUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => signatureInputRef.current?.click()}
                          disabled={uploadingSignature}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadingSignature ? 'Chargement...' : 'Télécharger'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Cachet */}
                  <div className="space-y-2">
                    <Label>Cachet</Label>
                    <div className="flex items-center gap-4">
                      {settings.stamp_url ? (
                        <div className="relative">
                          <img
                            src={settings.stamp_url}
                            alt="Cachet"
                            className="h-16 w-16 object-contain rounded-lg border bg-background"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6"
                            onClick={removeStamp}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="h-16 w-16 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                          <span className="text-xs text-muted-foreground/50">Cachet</span>
                        </div>
                      )}
                      <div>
                        <input
                          ref={stampInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleStampUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => stampInputRef.current?.click()}
                          disabled={uploadingStamp}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploadingStamp ? 'Chargement...' : 'Télécharger'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Format: PNG avec fond transparent recommandé. Taille max: 1 Mo
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration TVA */}
        <TabsContent value="vat">
          <Card>
            <CardHeader>
              <CardTitle>Configuration TVA</CardTitle>
              <CardDescription>
                Gérez les taux de TVA tunisiens applicables à vos factures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Taux par défaut</Label>
                <Select
                  value={String(settings.default_vat_rate)}
                  onValueChange={(value) => setSettings({ ...settings, default_vat_rate: Number(value) })}
                >
                  <SelectTrigger className="w-full md:w-[300px]">
                    <SelectValue placeholder="Sélectionner un taux" />
                  </SelectTrigger>
                  <SelectContent className='bg-primary/10'>
                    {settings.vat_rates.map((vat) => (
                      <SelectItem key={vat.rate} value={String(vat.rate)}>
                        {vat.label} ({vat.rate}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <Label>Taux disponibles</Label>
                <div className="space-y-2">
                  {settings.vat_rates.map((vat) => (
                    <div
                      key={vat.rate}
                      className="flex items-center justify-between p-3 bg-primary/10 rounded-lg"
                    >
                      <div>
                        <span className="font-medium">{vat.rate}%</span>
                        <span className="text-muted-foreground ml-2">- {vat.label}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVatRate(vat.rate)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex items-end gap-2 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Nouveau taux (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={newVatRate.rate}
                      onChange={(e) => setNewVatRate({ ...newVatRate, rate: Number(e.target.value) })}
                      className="w-24"
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label>Libellé</Label>
                    <Input
                      value={newVatRate.label}
                      onChange={(e) => setNewVatRate({ ...newVatRate, label: e.target.value })}
                      placeholder="Ex: Réduit 7%"
                    />
                  </div>
                  <Button onClick={addVatRate} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Ajouter
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Numérotation Documents */}
        <TabsContent value="invoicing">
          <Card>
            <CardHeader>
              <CardTitle>Numérotation des documents</CardTitle>
              <CardDescription>
                Choisissez le modèle et le nombre de chiffres du numéro
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_number_padding">Nombre de chiffres</Label>
                  <Select
                    value={String(settings.invoice_number_padding)}
                    onValueChange={(value) => setSettings({ ...settings, invoice_number_padding: Number(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3">3 (001)</SelectItem>
                      <SelectItem value="4">4 (0001)</SelectItem>
                      <SelectItem value="5">5 (00001)</SelectItem>
                      <SelectItem value="6">6 (000001)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice_format">Modèle</Label>
                  <Select
                    value={settings.invoice_format}
                    onValueChange={(value) => setSettings({ ...settings, invoice_format: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="{prefix}-{year}-{number}">type_doc-année-numéro</SelectItem>
                      <SelectItem value="{year}-{month}-{number}">année-mois-numéro</SelectItem>
                      <SelectItem value="{year}-{number}">année-numéro</SelectItem>
                      <SelectItem value="{number}">numéro</SelectItem>
                      <SelectItem value="{year} {number}">année numéro</SelectItem>
                      <SelectItem value="{prefix}-{number}">type_doc-numéro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-4 bg-primary/10 rounded-lg">
                <Label className="text-muted-foreground">Aperçu de la prochaine facture</Label>
                <p className="text-2xl font-mono font-bold mt-2">{getInvoicePreview()}</p>
              </div>

              <div className="p-4 bg-accent/50 rounded-lg">
                <h4 className="font-medium mb-2">Variables disponibles</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li><code className="bg-background px-1 rounded">{'{type_doc}'}</code> - type de la facture</li>
                  <li><code className="bg-background px-1 rounded">{'{année}'}</code> - Année en cours</li>
                  <li><code className="bg-background px-1 rounded">{'{mois}'}</code> - Mois en cours</li>
                  <li><code className="bg-background px-1 rounded">{'{numéro}'}</code> - Numéro séquentiel</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
