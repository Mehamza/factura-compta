/**
 * Configuration des types de documents
 * 
 * MODÈLE CONFORME TUNISIE:
 * - facture = document fiscal unique (remplace facture_credit + facture_payee)
 * - Le statut de paiement est géré par la table payments
 * - La facture n'est PAS recréée pour un paiement
 * - Conversion: BL → facture
 */

export type DocumentModule = 'ventes' | 'achats';

export type DocumentKind =
  // Ventes
  | 'devis'
  | 'bon_commande'
  | 'bon_livraison'
  | 'facture'           // Document fiscal unique (ex facture_credit + facture_payee)
  | 'facture_avoir'     // Avoir/remboursement
  // Achats
  | 'bon_commande_achat'
  | 'bon_livraison_achat'
  | 'facture_achat'     // Facture fournisseur (ex facture_credit_achat)
  | 'avoir_achat';      // Avoir fournisseur

// Types obsolètes conservés pour compatibilité migration
export type LegacyDocumentKind = 'facture_credit' | 'facture_payee' | 'facture_credit_achat';

export type StockMovementType = 'entry' | 'exit';

/**
 * Statuts de facture conformes au modèle tunisien
 * - draft: brouillon (modifiable)
 * - validated: validée (document fiscal émis)
 * - partial: partiellement payée
 * - paid: totalement payée
 * - overdue: échue non payée
 * - cancelled: annulée
 */
export type InvoiceStatusType = 'draft' | 'validated' | 'partial' | 'paid' | 'overdue' | 'cancelled';

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
  /** Indique si ce document peut avoir des paiements associés */
  canHavePayments?: boolean;
}

export const documentTypeConfig: Record<DocumentKind, DocumentTypeConfig> = {
  // ===== VENTES =====
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
    canHavePayments: false,
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
    canHavePayments: false,
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
    canConvertTo: ['facture'],  // BL → Facture unique
    defaultStatus: 'draft',
    statusOptions: ['draft', 'delivered', 'cancelled'],
    canHavePayments: false,
  },
  // Facture unique (remplace facture_credit + facture_payee)
  facture: {
    kind: 'facture',
    label: 'Facture',
    prefix: 'FAC',
    module: 'ventes',
    affectsStock: false,
    requiresClient: true,
    requiresSupplier: false,
    requiresDueDate: true,
    canConvertTo: ['facture_avoir'],  // Seul l'avoir est possible
    defaultStatus: 'draft',
    // Statuts conformes au modèle tunisien
    statusOptions: ['draft', 'validated', 'partial', 'paid', 'overdue', 'cancelled'],
    canHavePayments: true,
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
    canHavePayments: false,  // L'avoir génère un crédit, pas un paiement
  },

  // ===== ACHATS =====
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
    canHavePayments: false,
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
    canConvertTo: ['facture_achat'],  // Réception → Facture achat
    defaultStatus: 'draft',
    statusOptions: ['draft', 'delivered', 'cancelled'],
    canHavePayments: false,
  },
  // Facture d'achat (ex facture_credit_achat)
  facture_achat: {
    kind: 'facture_achat',
    label: "Facture d'achat",
    prefix: 'FAC-A',
    module: 'achats',
    affectsStock: false,
    requiresClient: false,
    requiresSupplier: true,
    requiresDueDate: true,
    canConvertTo: ['avoir_achat'],
    defaultStatus: 'draft',
    statusOptions: ['draft', 'validated', 'partial', 'paid', 'overdue', 'cancelled'],
    canHavePayments: true,
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
    canHavePayments: false,
  },
};

export const getDocumentTypeConfig = (kind: DocumentKind): DocumentTypeConfig => {
  // Gestion de la rétro-compatibilité pour les anciens types
  const mappedKind = mapLegacyKind(kind as string);
  return documentTypeConfig[mappedKind] || documentTypeConfig['facture'];
};

/**
 * Mappe les anciens types de documents vers les nouveaux
 * Utile pour la migration et la rétro-compatibilité
 */
export function mapLegacyKind(kind: string): DocumentKind {
  switch (kind) {
    case 'facture_credit':
    case 'facture_payee':
      return 'facture';
    case 'facture_credit_achat':
      return 'facture_achat';
    default:
      return kind as DocumentKind;
  }
}

export const isCreditNoteKind = (kind: DocumentKind) => kind === 'facture_avoir' || kind === 'avoir_achat';

/** Vérifie si un document peut recevoir des paiements */
export const canReceivePayments = (kind: DocumentKind): boolean => {
  const config = getDocumentTypeConfig(kind);
  return config.canHavePayments === true;
};

/** Vérifie si un document est une facture (vente ou achat) */
export const isInvoiceKind = (kind: DocumentKind): boolean => {
  return kind === 'facture' || kind === 'facture_achat';
};

export const documentKindToRoute: Record<DocumentKind, string> = {
  devis: '/invoices/devis',
  bon_commande: '/invoices/bon-commande',
  bon_livraison: '/invoices/bon-livraison',
  facture: '/invoices/facture',  // Nouvelle route unifiée
  facture_avoir: '/invoices/avoir',
  bon_commande_achat: '/purchases/bon-commande',
  bon_livraison_achat: '/purchases/bon-livraison',
  facture_achat: '/purchases/facture',  // Nouvelle route unifiée
  avoir_achat: '/purchases/avoir',
};

/**
 * Route mapping incluant les anciens chemins pour rétro-compatibilité
 */
export const legacyRouteMapping: Record<string, string> = {
  '/invoices/credit': '/invoices/facture',
  '/invoices/recu': '/invoices/facture',
  '/purchases/credit': '/purchases/facture',
};
