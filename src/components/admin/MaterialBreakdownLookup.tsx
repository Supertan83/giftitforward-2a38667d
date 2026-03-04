import { useState, useMemo } from 'react';
import { Search, Package, AlertTriangle, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { useItemTypes, useMarketplaces } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface MarketplaceBreakdown {
  marketplace_id: string;
  marketplace_name: string;
  allocated: number;
  distributed: number;
  remaining: number;
}

export const MaterialBreakdownLookup = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: itemTypes = [] } = useItemTypes();

  // Find matching items
  const matchingItems = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return itemTypes.filter(item =>
      item.name.toLowerCase().includes(q) ||
      (item.externalMaterialId && String(item.externalMaterialId).includes(q))
    ).slice(0, 10);
  }, [searchQuery, itemTypes]);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedItem = itemTypes.find(i => i.id === selectedItemId);

  // Fetch cross-marketplace allocations for selected item
  const { data: breakdownData, isLoading: loadingBreakdown } = useQuery({
    queryKey: ['material-breakdown', selectedItemId],
    queryFn: async () => {
      if (!selectedItemId) return null;
      const { data, error } = await supabase
        .from('marketplace_item_allocations')
        .select(`
          id,
          allocated_quantity,
          distributed_quantity,
          marketplace_id,
          marketplace_events!inner(name, event_date)
        `)
        .eq('item_type_id', selectedItemId);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        marketplace_id: row.marketplace_id,
        marketplace_name: `${row.marketplace_events.name}${row.marketplace_events.event_date ? ` (${new Date(row.marketplace_events.event_date).toLocaleDateString()})` : ''}`,
        allocated: row.allocated_quantity,
        distributed: row.distributed_quantity,
        remaining: row.allocated_quantity - row.distributed_quantity,
      })) as MarketplaceBreakdown[];
    },
    enabled: !!selectedItemId,
  });

  const totalAllocated = breakdownData?.reduce((s, b) => s + b.allocated, 0) || 0;
  const totalDistributed = breakdownData?.reduce((s, b) => s + b.distributed, 0) || 0;
  const totalRemaining = totalAllocated - totalDistributed;
  const isOverAllocated = selectedItem && totalAllocated > selectedItem.totalStock && selectedItem.totalStock > 0;

  return (
    <div className="bg-card rounded-xl border border-border shadow-card mb-6">
      <div className="p-4 md:p-6 border-b border-border">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <Search className="w-5 h-5" />
          Material Lookup — Cross-Marketplace View
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Search by Material ID or name to see allocation breakdown across all marketplaces
        </p>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by Material ID or name..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!e.target.value.trim()) setSelectedItemId(null);
            }}
            className="pl-10"
          />
        </div>

        {/* Search Results */}
        {searchQuery.trim() && !selectedItemId && matchingItems.length > 0 && (
          <div className="border border-border rounded-lg divide-y divide-border max-h-60 overflow-y-auto">
            {matchingItems.map(item => (
              <button
                key={item.id}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setSelectedItemId(item.id);
                  setSearchQuery(`${item.externalMaterialId || ''} — ${item.name}`);
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {item.externalMaterialId ? `#${item.externalMaterialId}` : ''}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Stock: {item.totalStock.toLocaleString()}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}

        {searchQuery.trim() && !selectedItemId && matchingItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No matching materials found</p>
        )}

        {/* Breakdown Table */}
        {selectedItemId && selectedItem && (
          <div className="space-y-4">
            {/* Item Summary */}
            <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg border border-border">
              <Package className="w-8 h-8 text-primary" />
              <div className="flex-1">
                <p className="font-semibold">{selectedItem.name}</p>
                <p className="text-sm text-muted-foreground">
                  Material #{selectedItem.externalMaterialId} · Total Stock: {selectedItem.totalStock.toLocaleString()}
                </p>
              </div>
              {isOverAllocated && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Over-allocated
                </Badge>
              )}
              <button
                className="text-sm text-muted-foreground hover:text-foreground underline"
                onClick={() => { setSelectedItemId(null); setSearchQuery(''); }}
              >
                Clear
              </button>
            </div>

            {loadingBreakdown ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : !breakdownData || breakdownData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No allocations found for this material across any marketplace
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marketplace</TableHead>
                      <TableHead className="text-right">Allocated</TableHead>
                      <TableHead className="text-right">Distributed</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {breakdownData.map((row) => (
                      <TableRow key={row.marketplace_id}>
                        <TableCell className="font-medium">{row.marketplace_name}</TableCell>
                        <TableCell className="text-right">{row.allocated.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-emerald-600">{row.distributed.toLocaleString()}</TableCell>
                        <TableCell className={`text-right font-medium ${row.remaining < 0 ? 'text-destructive' : 'text-amber-600'}`}>
                          {row.remaining.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="font-bold">
                      <TableCell>Total across all marketplaces</TableCell>
                      <TableCell className="text-right">{totalAllocated.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-emerald-600">{totalDistributed.toLocaleString()}</TableCell>
                      <TableCell className={`text-right ${totalRemaining < 0 ? 'text-destructive' : 'text-amber-600'}`}>
                        {totalRemaining.toLocaleString()}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-muted-foreground">Global Stock (total_stock)</TableCell>
                      <TableCell className="text-right font-semibold" colSpan={3}>
                        {selectedItem.totalStock.toLocaleString()}
                        {isOverAllocated && (
                          <span className="text-destructive ml-2 text-xs">
                            ⚠ Exceeds stock by {(totalAllocated - selectedItem.totalStock).toLocaleString()}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
