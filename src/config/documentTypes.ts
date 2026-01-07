export type DocumentModule = 'ventes' | 'achats';

export type DocumentKind =
  // Ventes
  | 'devis'
  | 'bon_commande'
  | 'bon_livraison'
  | 'facture_credit'
  | 'facture_payee'
  // Achats
  | 'devis_achat'
  | 'bon_commande_achat'
  | 'bon_livraison_achat'
  | 'facture_credit_achat'
  | 'facture_payee_achat';

export type StockMovementType = 'entry' | 'exit';

export interface DocumentTypeConfig {
  kind: DocumentKind;
  label: string;
  prefix: string;
  module: DocumentModule;
  affectsStock: boolean;
  stockMovementType?: StockMovementType;
  requiresClient: boolean;
  requiresSupplier: boolean;
  requiresDueDate: boolean;
  canConvertTo: DocumentKind[];
  defaultStatus: string;
  statusOptions: string[];
}

export const documentTypeConfig: Record<DocumentKind, DocumentTypeConfig> = {
  devis: {
    kind: 'devis',
    label: 'Devis',
    prefix: 'DEV',
    module: 'ventes',
    affectsStock: false,
    requiresClient: true,
    requiresSupplier: false,
    requiresDueDate: false,
    canConvertTo: ['bon_commande'],
    defaultStatus: 'draft',
    statusOptions: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'],
  },
  bon_commande: {
    kind: 'bon_commande',
    label: 'Bon de commande',
    prefix: 'BC',
    module: 'ventes',
    affectsStock: false,
    requiresClient: true,
    requiresSupplier: false,
    requiresDueDate: false,
    canConvertTo: ['bon_livraison'],
    defaultStatus: 'draft',
    statusOptions: ['draft', 'confirmed', 'cancelled'],
  },
  bon_livraison: {
    kind: 'bon_livraison',
    label: 'Bon de livraison',
    prefix: 'BL',
    module: 'ventes',
    affectsStock: true,
    stockMovementType: 'exit',
    requiresClient: true,
    requiresSupplier: false,
    requiresDueDate: false,
    canConvertTo: ['facture_credit', 'facture_payee'],
    defaultStatus: 'draft',
    statusOptions: ['draft', 'delivered', 'cancelled'],
  },
  facture_credit: {
    kind: 'facture_credit',
    label: 'Facture à crédit',
    prefix: 'FAC',
    module: 'ventes',
    affectsStock: false,
    requiresClient: true,
    requiresSupplier: false,
    requiresDueDate: true,
    canConvertTo: ['facture_payee'],
    defaultStatus: 'draft',
    statusOptions: ['draft', 'sent', 'overdue', 'partial', 'cancelled'],
  },
  facture_payee: {
    kind: 'facture_payee',
    label: 'Facture payée / Reçu',
    prefix: 'REC',
    module: 'ventes',
    affectsStock: false,
    requiresClient: true,
    requiresSupplier: false,
    requiresDueDate: false,
    canConvertTo: [],
    defaultStatus: 'paid',
    statusOptions: ['paid'],
  },

  devis_achat: {
    kind: 'devis_achat',
    label: "Devis d'achat",
    prefix: 'DEV-A',
    module: 'achats',
    affectsStock: false,
    requiresClient: false,
    requiresSupplier: true,
    requiresDueDate: false,
    canConvertTo: ['bon_commande_achat'],
    defaultStatus: 'purchase_quote',
    statusOptions: ['purchase_quote', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'],
  },
  bon_commande_achat: {
    kind: 'bon_commande_achat',
    label: "Bon de commande (achat)",
    prefix: 'BC-A',
    module: 'achats',
    affectsStock: false,
    requiresClient: false,
    requiresSupplier: true,
    requiresDueDate: false,
    canConvertTo: ['bon_livraison_achat'],
    defaultStatus: 'draft',
    statusOptions: ['draft', 'confirmed', 'cancelled'],
  },
  bon_livraison_achat: {
    kind: 'bon_livraison_achat',
    label: "Bon de livraison (achat)",
    prefix: 'BL-A',
    module: 'achats',
    affectsStock: true,
    stockMovementType: 'entry',
    requiresClient: false,
    requiresSupplier: true,
    requiresDueDate: false,
    canConvertTo: ['facture_credit_achat', 'facture_payee_achat'],
    defaultStatus: 'draft',
    statusOptions: ['draft', 'delivered', 'cancelled'],
  },
  facture_credit_achat: {
    kind: 'facture_credit_achat',
    label: "Facture fournisseur (à crédit)",
    prefix: 'FAC-A',
    module: 'achats',
    affectsStock: false,
    requiresClient: false,
    requiresSupplier: true,
    requiresDueDate: true,
    canConvertTo: ['facture_payee_achat'],
    defaultStatus: 'draft',
    statusOptions: ['draft', 'sent', 'overdue', 'partial', 'cancelled'],
  },
  facture_payee_achat: {
    kind: 'facture_payee_achat',
    label: "Facture fournisseur (payée)",
    prefix: 'REC-A',
    module: 'achats',
    affectsStock: false,
    requiresClient: false,
    requiresSupplier: true,
    requiresDueDate: false,
    canConvertTo: [],
    defaultStatus: 'paid',
    statusOptions: ['paid'],
  },
};

export const getDocumentTypeConfig = (kind: DocumentKind) => documentTypeConfig[kind];
