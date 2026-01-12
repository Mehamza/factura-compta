import DocumentListPage from '@/pages/documents/DocumentListPage';

/**
 * Liste des factures d'achat
 * Modèle unifié conforme Tunisie (remplace facture_credit_achat)
 */
export default function PurchaseFacture() {
  return <DocumentListPage kind="facture_achat" />;
}
