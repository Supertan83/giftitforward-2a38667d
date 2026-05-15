import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { ShieldCheck, Info } from 'lucide-react';
import { useState } from 'react';
import { MethodologyDialog } from './MethodologyDialog';

interface Props {
  marketplaceId: string;
  marketplaceName: string;
}

interface Row {
  itemName: string;
  category: string | null;
  originalAllocated: number | null;
  distributed: number;
  returnedToDonorStock: number;
}

/**
 * Audit panel: shows the originally pledged Surpluss allocation (snapshot at first sync)
 * vs what was actually distributed and what was returned to donor inventory.
 *
 * For events synced before the snapshot column existed, the original column is NULL —
 * we display "—" with a methodology note explaining why.
 */
export function OriginalAllocationAuditPanel({ marketplaceId, marketplaceName }: Props) {
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['original_allocation_audit', marketplaceId],
    queryFn: async (): Promise<Row[]> => {
      const allocs = await fetchAllRows<any>(() =>
        supabase
          .from('marketplace_item_allocations')
          .select('item_type_id, allocated_quantity, distributed_quantity, original_allocated_quantity, item_types(name, category)')
          .eq('marketplace_id', marketplaceId)
          .is('deleted_at', null)
      );
      return (allocs || []).map((a: any) => ({
        itemName: a.item_types?.name || 'Unknown item',
        category: a.item_types?.category || null,
        originalAllocated: a.original_allocated_quantity,
        distributed: Number(a.distributed_quantity || 0),
        // Once Surpluss reconciles, allocated_quantity == distributed_quantity, so
        // "returned to donor stock" is original − distributed (only meaningful when original is known).
        returnedToDonorStock:
          a.original_allocated_quantity != null
            ? Math.max(Number(a.original_allocated_quantity) - Number(a.distributed_quantity || 0), 0)
            : 0,
      })).sort((a: Row, b: Row) => a.itemName.localeCompare(b.itemName));
    },
  });

  const hasSnapshot = (rows || []).some(r => r.originalAllocated != null);
  const totalOriginal = (rows || []).reduce((s, r) => s + (r.originalAllocated ?? 0), 0);
  const totalDistributed = (rows || []).reduce((s, r) => s + r.distributed, 0);
  const totalReturned = (rows || []).reduce((s, r) => s + r.returnedToDonorStock, 0);

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="p-4 md:p-6 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-display font-semibold text-lg">Audit Reconciliation</h3>
            <p className="text-xs text-muted-foreground">Originally pledged vs distributed (Surpluss snapshot)</p>
          </div>
        </div>
        <button
          onClick={() => setMethodologyOpen(true)}
          className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
        >
          <Info className="w-3.5 h-3.5" />
          Methodology
        </button>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {!hasSnapshot && !isLoading && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-foreground">
            <p className="font-semibold mb-1">No pre-reconciliation snapshot available</p>
            <p className="text-muted-foreground">
              This event was synced from Surpluss after end-of-event reconciliation. Surpluss adjusts the
              allocated quantity to match what was actually distributed and releases the rest back to donor
              inventory. Future events will display the original pledge here automatically.
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold">{hasSnapshot ? totalOriginal.toLocaleString() : '—'}</p>
            <p className="text-xs text-muted-foreground">Originally Pledged</p>
          </div>
          <div className="bg-emerald-500/10 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{totalDistributed.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Distributed at Event</p>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{hasSnapshot ? totalReturned.toLocaleString() : '—'}</p>
            <p className="text-xs text-muted-foreground">Returned to Donor Stock</p>
          </div>
        </div>

        {(rows || []).length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr className="border-b border-border">
                  <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</th>
                  <th className="text-center py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Originally Pledged</th>
                  <th className="text-center py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Distributed</th>
                  <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Returned to Donor Stock</th>
                </tr>
              </thead>
              <tbody>
                {(rows || []).map((r, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <p className="font-medium">{r.itemName}</p>
                      {r.category && <p className="text-xs text-muted-foreground">{r.category}</p>}
                    </td>
                    <td className="py-3 px-4 text-center text-muted-foreground">
                      {r.originalAllocated != null ? r.originalAllocated.toLocaleString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-emerald-600">
                      {r.distributed.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-blue-600">
                      {r.originalAllocated != null ? r.returnedToDonorStock.toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MethodologyDialog
        open={methodologyOpen}
        onOpenChange={setMethodologyOpen}
        marketplaceName={marketplaceName}
      />
    </div>
  );
}
