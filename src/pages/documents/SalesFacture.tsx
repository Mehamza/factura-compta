import DocumentListPage from '@/pages/documents/DocumentListPage';

/**
 * Liste des factures de vente
 * Modèle unifié conforme Tunisie (remplace facture_credit + facture_payee)
 */
export default function SalesFacture() {
  return <DocumentListPage kind="facture" />;
}
