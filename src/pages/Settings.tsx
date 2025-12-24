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
import { Building2, Receipt, FileText, Plus, Trash2, Save, Upload, Image, User } from 'lucide-react';
import { currencies } from '@/lib/numberToWords';
import { logger } from '@/lib/logger';
import AccountTab from '@/components/settings/AccountTab';
import type { Tables } from '@/integrations/supabase/types';

interface VatRate {
  rate: number;
  label: string;
}

interface CompanySettings {
  id?: string;
  user_id: string;
  company_name: string;
  company_address: string;
  company_city: string;
  company_postal_code: string;
  company_country: string;
  company_phone: string;
  company_email: string;
  company_vat_number: string;
  company_tax_id: string;
  company_trade_register: string;
  company_logo_url: string;
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
}

const defaultSettings: Omit<CompanySettings, 'user_id'> = {
  company_name: '',
  company_address: '',
  company_city: '',
  company_postal_code: '',
  company_country: 'Tunisie',
  company_phone: '',
  company_email: '',
  company_vat_number: '',
  company_tax_id: '',
  company_trade_register: '',
  company_logo_url: '',
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
};

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [newVatRate, setNewVatRate] = useState({ rate: 0, label: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      fetchSettings();
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user?.id)
      .maybeSingle();
    setProfile(data);
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          ...data,
          company_logo_url: data.company_logo_url || '',
          default_currency: data.default_currency || 'TND',
          activity: data.activity || '',
          vat_rates: (data.vat_rates as unknown as VatRate[]) || defaultSettings.vat_rates,
          signature_url: data.signature_url || '',
          stamp_url: data.stamp_url || ''
        });
      } else {
        setSettings({
          ...defaultSettings,
          user_id: user!.id
        });
      }
    } catch (error) {
      logger.error('Erreur lors du chargement des paramètres:', error);
      toast.error('Erreur lors du chargement des paramètres');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

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
      if (settings?.company_logo_url) {
        try {
          const oldUrl = new URL(settings.company_logo_url);
          const oldPath = oldUrl.pathname.split('/company-assets/')[1];
          if (oldPath) {
            await supabase.storage.from('company-assets').remove([decodeURIComponent(oldPath)]);
          }
        } catch (e) {
          // Ignore deletion errors
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/logo-${Date.now()}.${fileExt}`;

      // Upload to company-assets bucket (public)
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('company-assets')
        .getPublicUrl(fileName);

      // Update local state
      const newSettings = settings ? { ...settings, company_logo_url: publicUrl } : null;
      setSettings(newSettings);
      
      // Auto-save to database
      if (newSettings && user) {
        const { id, ...settingsWithoutId } = newSettings;
        const settingsToSave = {
          ...settingsWithoutId,
          user_id: user.id,
          vat_rates: JSON.parse(JSON.stringify(newSettings.vat_rates))
        };

        if (newSettings.id) {
          const { error } = await supabase
            .from('company_settings')
            .update({ company_logo_url: publicUrl })
            .eq('id', newSettings.id);

          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from('company_settings')
            .insert(settingsToSave)
            .select()
            .single();

          if (error) throw error;
          setSettings({ ...newSettings, id: data.id });
        }
      }
      
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
    if (settings.company_logo_url) {
      try {
        const oldUrl = new URL(settings.company_logo_url);
        const oldPath = oldUrl.pathname.split('/company-assets/')[1];
        if (oldPath) {
          await supabase.storage.from('company-assets').remove([decodeURIComponent(oldPath)]);
        }
      } catch (e) {
        // Ignore deletion errors
      }
    }
    
    setSettings(prev => prev ? { ...prev, company_logo_url: '' } : null);
    
    // Auto-save removal to database
    if (settings.id) {
      try {
        const { error } = await supabase
          .from('company_settings')
          .update({ company_logo_url: null })
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

  const saveSettings = async () => {
    if (!settings || !user) return;

    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...settingsWithoutId } = settings;
      const settingsToSave = {
        ...settingsWithoutId,
        user_id: user.id,
        vat_rates: JSON.parse(JSON.stringify(settings.vat_rates))
      };

      if (settings.id) {
        const { error } = await supabase
          .from('company_settings')
          .update(settingsToSave)
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('company_settings')
          .insert(settingsToSave)
          .select()
          .single();

        if (error) throw error;
        setSettings({ ...settings, id: data.id });
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
    const year = new Date().getFullYear();
    const number = String(settings.invoice_next_number).padStart(settings.invoice_number_padding, '0');
    return settings.invoice_format
      .replace('{prefix}', settings.invoice_prefix)
      .replace('{year}', String(year))
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Paramètres</h1>
          <p className="text-muted-foreground">Configuration de votre entreprise et facturation</p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </Button>
      </div>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 bg-primary/10">
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
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Mon Compte
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
                  {settings.company_logo_url ? (
                    <div className="relative">
                      <img
                        src={settings.company_logo_url}
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Raison sociale</Label>
                  <Input
                    id="company_name"
                    value={settings.company_name}
                    onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                    placeholder="Nom de votre entreprise"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activity">Activité</Label>
                  <Input
                    id="activity"
                    value={settings.activity}
                    onChange={(e) => setSettings({ ...settings, activity: e.target.value })}
                    placeholder="Ex: Commerce de détail, Services informatiques..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_email">Email</Label>
                  <Input
                    id="company_email"
                    type="email"
                    value={settings.company_email}
                    onChange={(e) => setSettings({ ...settings, company_email: e.target.value })}
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
                <Label htmlFor="company_address">Adresse</Label>
                <Input
                  id="company_address"
                  value={settings.company_address}
                  onChange={(e) => setSettings({ ...settings, company_address: e.target.value })}
                  placeholder="Adresse complète"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_city">Ville</Label>
                  <Input
                    id="company_city"
                    value={settings.company_city}
                    onChange={(e) => setSettings({ ...settings, company_city: e.target.value })}
                    placeholder="Tunis"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_postal_code">Code postal</Label>
                  <Input
                    id="company_postal_code"
                    value={settings.company_postal_code}
                    onChange={(e) => setSettings({ ...settings, company_postal_code: e.target.value })}
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
                  <Label htmlFor="company_phone">Téléphone</Label>
                  <Input
                    id="company_phone"
                    value={settings.company_phone}
                    onChange={(e) => setSettings({ ...settings, company_phone: e.target.value })}
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

        {/* Numérotation Factures */}
        <TabsContent value="invoicing">
          <Card>
            <CardHeader>
              <CardTitle>Numérotation des factures</CardTitle>
              <CardDescription>
                Personnalisez le format de numérotation de vos factures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_prefix">Préfixe</Label>
                  <Input
                    id="invoice_prefix"
                    value={settings.invoice_prefix}
                    onChange={(e) => setSettings({ ...settings, invoice_prefix: e.target.value.toUpperCase() })}
                    placeholder="FAC"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoice_next_number">Prochain numéro</Label>
                  <Input
                    id="invoice_next_number"
                    type="number"
                    min="1"
                    value={settings.invoice_next_number}
                    onChange={(e) => setSettings({ ...settings, invoice_next_number: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_format">Format</Label>
                  <Select
                    value={settings.invoice_format}
                    onValueChange={(value) => setSettings({ ...settings, invoice_format: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="{prefix}-{year}-{number}">{settings.invoice_prefix}-2025-0001</SelectItem>
                      <SelectItem value="{prefix}{year}{number}">{settings.invoice_prefix}20250001</SelectItem>
                      <SelectItem value="{prefix}-{number}">{settings.invoice_prefix}-0001</SelectItem>
                      <SelectItem value="{year}/{prefix}/{number}">2025/{settings.invoice_prefix}/0001</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
              </div>

              <div className="p-4 bg-primary/10 rounded-lg">
                <Label className="text-muted-foreground">Aperçu de la prochaine facture</Label>
                <p className="text-2xl font-mono font-bold mt-2">{getInvoicePreview()}</p>
              </div>

              <div className="p-4 bg-accent/50 rounded-lg">
                <h4 className="font-medium mb-2">Variables disponibles</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li><code className="bg-background px-1 rounded">{'{prefix}'}</code> - Préfixe de la facture</li>
                  <li><code className="bg-background px-1 rounded">{'{year}'}</code> - Année en cours</li>
                  <li><code className="bg-background px-1 rounded">{'{number}'}</code> - Numéro séquentiel</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mon Compte */}
        <TabsContent value="account">
          <AccountTab profile={profile} onProfileUpdate={fetchProfile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
