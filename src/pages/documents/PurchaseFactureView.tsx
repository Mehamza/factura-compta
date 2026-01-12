import DocumentViewPage from '@/pages/documents/DocumentViewPage';

/**
 * Visualisation d'une facture d'achat
 * Modèle unifié conforme Tunisie
 */
export default function PurchaseFactureView() {
  return <DocumentViewPage kind="facture_achat" />;
}
