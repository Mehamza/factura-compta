import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useInvoices, type InvoiceRow } from '@/hooks/useInvoices';
import type { DocumentKind } from '@/config/documentTypes';
import { documentTypeConfig } from '@/config/documentTypes';

export default function DocumentListPage({ kind }: { kind: DocumentKind }) {
  const { toast } = useToast();
  const { config, list, convert } = useInvoices(kind);

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await list();
      if (cancelled) return;
      if (error) {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
        setRows([]);
      } else {
        setRows(data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, list, toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r: any) => {
      const number = (r.invoice_number || r.purchase_number || '').toLowerCase();
      const partyName = (r.clients?.name || r.suppliers?.name || '').toLowerCase();
      return number.includes(q) || partyName.includes(q);
    });
  }, [rows, search]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">{config.label}</div>
            <div className="text-sm text-muted-foreground">Liste des documents</div>
          </div>
          <Button asChild>
            <Link to="new">+ Nouveau</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Input
              placeholder="Rechercher par numéro ou tiers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Tiers</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Chargement...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Aucun document
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.invoice_number || r.purchase_number}</TableCell>
                      <TableCell>{r.clients?.name || r.suppliers?.name || '-'}</TableCell>
                      <TableCell>{r.issue_date}</TableCell>
                      <TableCell>{Number(r.total || 0).toFixed(3)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {config.canConvertTo.length > 0 ? (
                          <div className="flex items-center justify-end gap-2">
                            <select
                              className="h-9 rounded-md border bg-background px-3 text-sm"
                              defaultValue={config.canConvertTo[0]}
                              onChange={(e) => {
                                (r as any).__convertTarget = e.target.value;
                              }}
                            >
                              {config.canConvertTo.map((k) => (
                                <option key={k} value={k}>
                                  {documentTypeConfig[k].label}
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="outline"
                              onClick={async () => {
                                const target = (r as any).__convertTarget || config.canConvertTo[0];
                                try {
                                  await convert(r.id, target);
                                  toast({
                                    title: 'Succès',
                                    description: `Converti vers ${documentTypeConfig[target].label}`,
                                  });
                                } catch (err: any) {
                                  toast({
                                    variant: 'destructive',
                                    title: 'Erreur',
                                    description: err?.message || 'Conversion impossible',
                                  });
                                }
                              }}
                            >
                              Convertir
                            </Button>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
