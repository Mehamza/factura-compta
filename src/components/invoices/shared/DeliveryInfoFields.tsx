import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Truck, MapPin, User, Phone, Package, Scale, Calendar } from 'lucide-react';

export interface DeliveryInfo {
  delivery_address: string;
  delivery_contact: string;
  delivery_phone: string;
  transport_method: string;
  driver_name: string;
  vehicle_info: string;
  delivery_date: string;
  package_count: number | null;
  total_weight: number | null;
  delivery_notes: string;
}

export const defaultDeliveryInfo: DeliveryInfo = {
  delivery_address: '',
  delivery_contact: '',
  delivery_phone: '',
  transport_method: '',
  driver_name: '',
  vehicle_info: '',
  delivery_date: '',
  package_count: null,
  total_weight: null,
  delivery_notes: '',
};

export const transportMethods = [
  { value: 'vehicule_propre', label: 'Véhicule propre' },
  { value: 'transporteur', label: 'Transporteur externe' },
  { value: 'livraison_client', label: 'Enlevé par le client' },
  { value: 'autre', label: 'Autre' },
];

interface DeliveryInfoFieldsProps {
  deliveryInfo: DeliveryInfo;
  onChange: (info: DeliveryInfo) => void;
}

export function DeliveryInfoFields({ deliveryInfo, onChange }: DeliveryInfoFieldsProps) {
  const updateField = <K extends keyof DeliveryInfo>(field: K, value: DeliveryInfo[K]) => {
    onChange({ ...deliveryInfo, [field]: value });
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
        <Truck className="h-4 w-4" />
        <span>Informations de livraison</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Delivery Address */}
        <div className="space-y-2 lg:col-span-2">
          <Label className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            Adresse de livraison
          </Label>
          <Input
            placeholder="Adresse de livraison (si différente du client)"
            value={deliveryInfo.delivery_address}
            onChange={(e) => updateField('delivery_address', e.target.value)}
          />
        </div>

        {/* Delivery Date */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Date de livraison
          </Label>
          <Input
            type="datetime-local"
            value={deliveryInfo.delivery_date}
            onChange={(e) => updateField('delivery_date', e.target.value)}
          />
        </div>

        {/* Delivery Contact */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <User className="h-3 w-3" />
            Contact livraison
          </Label>
          <Input
            placeholder="Nom du contact"
            value={deliveryInfo.delivery_contact}
            onChange={(e) => updateField('delivery_contact', e.target.value)}
          />
        </div>

        {/* Delivery Phone */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Phone className="h-3 w-3" />
            Téléphone livraison
          </Label>
          <Input
            placeholder="Téléphone du contact"
            value={deliveryInfo.delivery_phone}
            onChange={(e) => updateField('delivery_phone', e.target.value)}
          />
        </div>

        {/* Transport Method */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Truck className="h-3 w-3" />
            Mode de transport
          </Label>
          <Select
            value={deliveryInfo.transport_method}
            onValueChange={(v) => updateField('transport_method', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              {transportMethods.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Driver Name */}
        <div className="space-y-2">
          <Label>Nom du chauffeur</Label>
          <Input
            placeholder="Chauffeur / Livreur"
            value={deliveryInfo.driver_name}
            onChange={(e) => updateField('driver_name', e.target.value)}
          />
        </div>

        {/* Vehicle Info */}
        <div className="space-y-2">
          <Label>Véhicule</Label>
          <Input
            placeholder="Immatriculation, N° camion..."
            value={deliveryInfo.vehicle_info}
            onChange={(e) => updateField('vehicle_info', e.target.value)}
          />
        </div>

        {/* Package Count */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            Nombre de colis
          </Label>
          <Input
            type="number"
            min={0}
            placeholder="0"
            value={deliveryInfo.package_count ?? ''}
            onChange={(e) => updateField('package_count', e.target.value ? Number(e.target.value) : null)}
          />
        </div>

        {/* Total Weight */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Scale className="h-3 w-3" />
            Poids total (kg)
          </Label>
          <Input
            type="number"
            min={0}
            step={0.1}
            placeholder="0.0"
            value={deliveryInfo.total_weight ?? ''}
            onChange={(e) => updateField('total_weight', e.target.value ? Number(e.target.value) : null)}
          />
        </div>
      </div>

      {/* Delivery Notes */}
      <div className="space-y-2">
        <Label>Instructions de livraison</Label>
        <Textarea
          placeholder="Instructions spéciales pour la livraison..."
          value={deliveryInfo.delivery_notes}
          onChange={(e) => updateField('delivery_notes', e.target.value)}
          rows={2}
        />
      </div>
    </div>
  );
}
