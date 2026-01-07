import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useInvoices } from '@/hooks/useInvoices';
import type { DocumentKind } from '@/config/documentTypes';
import { StatusBadge } from '@/components/invoices/shared';
import { ArrowLeft, Pencil, Printer } from 'lucide-react';

export default function DocumentViewPage({ kind }: { kind: DocumentKind }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config, getById } = useInvoices(kind);

  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const { invoice: inv, items: itms, error } = await getById(id);
      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      } else {
        setInvoice(inv);
        setItems(itms);
      }
      setLoading(false);
    })();
  }, [id, getById, toast]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (!invoice) {
    return <div className="text-center py-8 text-muted-foreground">Document non trouvé</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('..')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{config.label} — {invoice.invoice_number}</h1>
          <p className="text-sm text-muted-foreground">{invoice.issue_date}</p>
        </div>
        <Button variant="outline" onClick={() => navigate(`edit`)}>
          <Pencil className="h-4 w-4 mr-2" /> Modifier
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <span className="font-medium">Statut: </span>
            <StatusBadge status={invoice.status} />
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{Number(invoice.total).toFixed(3)} TND</div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Tiers</p>
              <p className="font-medium">{invoice.clients?.name || invoice.suppliers?.name || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Échéance</p>
              <p className="font-medium">{invoice.due_date || '—'}</p>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-3">Description</th>
                  <th className="text-right p-3">Qté</th>
                  <th className="text-right p-3">P.U.</th>
                  <th className="text-right p-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3">{item.description || item.reference}</td>
                    <td className="text-right p-3">{item.quantity}</td>
                    <td className="text-right p-3">{Number(item.unit_price).toFixed(3)}</td>
                    <td className="text-right p-3">{Number(item.total).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invoice.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p>{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
