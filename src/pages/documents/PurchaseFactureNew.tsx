import DocumentNewPage from '@/pages/documents/DocumentNewPage';

/**
 * Création d'une nouvelle facture d'achat
 * Modèle unifié conforme Tunisie
 */
export default function PurchaseFactureNew() {
  return <DocumentNewPage kind="facture_achat" />;
}
