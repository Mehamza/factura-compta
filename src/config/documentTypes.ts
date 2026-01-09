export type DocumentModule = 'ventes' | 'achats';

export type DocumentKind =
  // Ventes
  | 'devis'
  | 'bon_commande'
  | 'bon_livraison'
  | 'facture_credit'
  | 'facture_payee'
  | 'facture_avoir'
  // Achats
  | 'bon_commande_achat'
  | 'bon_livraison_achat'
  | 'facture_credit_achat'
  | 'avoir_achat';

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
    canConvertTo: ['facture_payee', 'facture_avoir'],
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
  facture_avoir: {
    kind: 'facture_avoir',
    label: "Facture d'avoir",
    prefix: 'AV',
    module: 'ventes',
    affectsStock: true,
    stockMovementType: 'entry',
    requiresClient: true,
    requiresSupplier: false,
    requiresDueDate: false,
    canConvertTo: [],
    defaultStatus: 'draft',
    statusOptions: ['draft', 'validated'],
  },
  bon_commande_achat: {
    kind: 'bon_commande_achat',
    label: 'Commande fournisseur',
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
    label: 'Bon de réception',
    prefix: 'BL-A',
    module: 'achats',
    affectsStock: true,
    stockMovementType: 'entry',
    requiresClient: false,
    requiresSupplier: true,
    requiresDueDate: false,
    canConvertTo: ['facture_credit_achat'],
    defaultStatus: 'draft',
    statusOptions: ['draft', 'delivered', 'cancelled'],
  },
  facture_credit_achat: {
    kind: 'facture_credit_achat',
    label: "Facture d'achat",
    prefix: 'FAC-A',
    module: 'achats',
    affectsStock: false,
    requiresClient: false,
    requiresSupplier: true,
    requiresDueDate: true,
    canConvertTo: ['avoir_achat'],
    defaultStatus: 'draft',
    statusOptions: ['draft', 'sent', 'overdue', 'partial', 'cancelled'],
  },
  avoir_achat: {
    kind: 'avoir_achat',
    label: 'Avoir fournisseur',
    prefix: 'AV-A',
    module: 'achats',
    affectsStock: true,
    stockMovementType: 'exit',
    requiresClient: false,
    requiresSupplier: true,
    requiresDueDate: false,
    canConvertTo: [],
    defaultStatus: 'draft',
    statusOptions: ['draft', 'validated'],
  },
};

export const getDocumentTypeConfig = (kind: DocumentKind) => documentTypeConfig[kind];

export const isCreditNoteKind = (kind: DocumentKind) => kind === 'facture_avoir' || kind === 'avoir_achat';

export const documentKindToRoute: Record<DocumentKind, string> = {
  devis: '/invoices/devis',
  bon_commande: '/invoices/bon-commande',
  bon_livraison: '/invoices/bon-livraison',
  facture_credit: '/invoices/credit',
  facture_payee: '/invoices/recu',
  facture_avoir: '/invoices/avoir',
  bon_commande_achat: '/purchases/bon-commande',
  bon_livraison_achat: '/purchases/bon-livraison',
  facture_credit_achat: '/purchases/credit',
  avoir_achat: '/purchases/avoir',
};
