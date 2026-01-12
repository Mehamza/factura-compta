import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useInvoices, type InvoiceRow } from '@/hooks/useInvoices';
import type { DocumentKind } from '@/config/documentTypes';
import { documentTypeConfig } from '@/config/documentTypes';
import { StatusBadge } from '@/components/invoices/shared';
import { calculateTotals, type DiscountConfig, type InvoiceItem } from '@/components/invoices/shared/types';
import { supabase } from '@/integrations/supabase/client';
import { Eye, Pencil, Trash2, FileDown, ArrowRight, Plus, Search } from 'lucide-react';

export default function DocumentListPage({ kind }: { kind: DocumentKind }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { config, list, remove, convert } = useInvoices(kind);

  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [computedTotals, setComputedTotals] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [convertTarget, setConvertTarget] = useState<Record<string, DocumentKind>>({});

  const fetchData = async () => {
    setLoading(true);
    setComputedTotals({});
    const { data, error } = await list();
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      setRows([]);
    } else {
      setRows(data);

      // Compute accurate totals (incl. remise) from invoice items to avoid stale DB totals.
      // This is done in a single batch query to avoid N+1.
      try {
        const ids = (data || []).map((r) => r.id).filter(Boolean);
        if (ids.length > 0) {
          const { data: itemsData, error: itemsError } = await supabase.from('invoice_items')
            .select('invoice_id,total,fodec_amount,vat_rate')
            .in('invoice_id', ids);
          if (!itemsError && itemsData) {
            const itemsByInvoice = new Map<string, any[]>();
            for (const it of itemsData) {
              const invoiceId = String((it as any).invoice_id);
              if (!itemsByInvoice.has(invoiceId)) itemsByInvoice.set(invoiceId, []);
              itemsByInvoice.get(invoiceId)!.push(it);
            }

            const totalsMap: Record<string, number> = {};
            for (const r of data) {
              const invoiceItems = itemsByInvoice.get(r.id) || [];
              if (invoiceItems.length === 0) continue;

              const discountValue = Number((r as any).discount_value ?? 0);
              const discountType = ((r as any).discount_type ?? 'percent') as DiscountConfig['type'];
              const discount: DiscountConfig | undefined =
                discountValue > 0 ? { type: discountType, value: discountValue } : undefined;

              // Minimal item shape: calculateTotals only uses total, fodec_amount, vat_rate.
              const calcItems: InvoiceItem[] = invoiceItems.map((it) => ({
                reference: '',
                description: '',
                quantity: 0,
                unit_price: 0,
                vat_rate: Number((it as any).vat_rate ?? 0),
                vat_amount: 0,
                fodec_applicable: false,
                fodec_rate: 0,
                fodec_amount: Number((it as any).fodec_amount ?? 0),
                total: Number((it as any).total ?? 0),
              }));

              totalsMap[r.id] = calculateTotals(calcItems, Boolean(r.stamp_included), discount).total;
            }

            setComputedTotals(totalsMap);
          }
        }
      } catch {
        // Non-blocking: fall back to stored totals.
      }

      // Initialize convert targets
      const targets: Record<string, DocumentKind> = {};
      data.forEach(r => {
        if (config.canConvertTo.length > 0) {
          targets[r.id] = config.canConvertTo[0];
        }
      });
      setConvertTarget(targets);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [kind]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const number = (r.invoice_number || '').toLowerCase();
      const partyName = (r.clients?.name || r.suppliers?.name || '').toLowerCase();
      return number.includes(q) || partyName.includes(q);
    });
  }, [rows, search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await remove(deleteId);
      toast({ title: 'Succès', description: 'Document supprimé' });
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err?.message || 'Suppression impossible' });
    } finally {
      setDeleteId(null);
    }
  };

  const handleConvert = async (id: string) => {
    const target = convertTarget[id];
    if (!target) return;
    try {
      const newDoc = await convert(id, target);
      toast({ title: 'Succès', description: `Converti vers ${documentTypeConfig[target].label}` });
      // Navigate to the new document type list
      const targetConfig = documentTypeConfig[target];
      const basePath = targetConfig.module === 'ventes' ? '/invoices' : '/purchases';
      const typePath = target.replace('_achat', '').replace('_', '-');
      navigate(`${basePath}/${typePath}`);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: err?.message || 'Conversion impossible' });
    }
  };

  const formatCurrency = (amount: number) => {
    return `${Number(amount || 0).toFixed(3)} TND`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xl font-semibold">{config.label}</div>
            <div className="text-sm text-muted-foreground">Liste des documents</div>
          </div>
          <Button asChild>
            <Link to="new">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par numéro ou tiers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Tiers</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        Chargement...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Aucun document trouvé
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.invoice_number}</TableCell>
                      <TableCell>{r.clients?.name || r.suppliers?.name || '—'}</TableCell>
                      <TableCell>{r.issue_date}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(computedTotals[r.id] ?? r.total)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={r.status}
                          paymentStatus={(r as any).payment_status}
                          usePaymentStatus={r.document_kind === 'facture' || r.document_kind === 'facture_achat'}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {/* View */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`${r.id}`)}
                            title="Voir"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {/* Edit */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`${r.id}/edit`)}
                            title="Modifier"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          
                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(r.id)}
                            title="Supprimer"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>

                          {/* Convert */}
                          {config.canConvertTo.length > 0 && (
                            <div className="flex items-center gap-1 ml-2 pl-2 border-l">
                              <Select
                                value={convertTarget[r.id] || config.canConvertTo[0]}
                                onValueChange={(value) => 
                                  setConvertTarget(prev => ({ ...prev, [r.id]: value as DocumentKind }))
                                }
                              >
                                <SelectTrigger className="h-8 w-[140px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {config.canConvertTo.map((k) => (
                                    <SelectItem key={k} value={k}>
                                      {documentTypeConfig[k].label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConvert(r.id)}
                                className="h-8"
                              >
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le document et ses lignes seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
