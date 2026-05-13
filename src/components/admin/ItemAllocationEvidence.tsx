import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, Loader2, PackageSearch, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';

const downloadCsv = (filename: string, rows: (string | number)[][]) => {
  const csv = rows
    .map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const fmt = (d?: string | null) => (d ? format(new Date(d), 'yyyy-MM-dd HH:mm') : '');

export const ItemAllocationEvidence = () => {
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['item-allocation-evidence'],
    queryFn: async () => {
      const [allocs, items, mps, manualCounts, logs] = await Promise.all([
        fetchAllRows<any>(() =>
          supabase
            .from('marketplace_item_allocations')
            .select('id, marketplace_id, item_type_id, allocated_quantity, distributed_quantity, created_at, updated_at')
            .is('deleted_at', null)
        ),
        fetchAllRows<any>(() =>
          supabase
            .from('item_types')
            .select('id, name, category, subcategory, total_stock, distributed')
            .is('deleted_at', null)
        ),
        fetchAllRows<any>(() =>
          supabase
            .from('marketplace_events')
            .select('id, name, event_date, outreach_partner')
            .is('deleted_at', null)
            .order('event_date', { ascending: false, nullsFirst: false })
        ),
        fetchAllRows<any>(() =>
          supabase
            .from('marketplace_manual_counts')
            .select('item_type_id, marketplace_id, actual_distributed')
            .is('deleted_at', null)
        ),
        fetchAllRows<any>(() =>
          supabase
            .from('allocation_traceability_logs')
            .select('id, marketplace_id, marketplace_name, item_type_id, action_type, quantity_before, quantity_after, description, performed_by_email, created_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
        ),
      ]);

      const itemMap = new Map<string, any>();
      for (const i of items) itemMap.set(i.id, i);
      const mpMap = new Map<string, any>();
      for (const m of mps) mpMap.set(m.id, m);
      const manualMap = new Map<string, number>();
      for (const mc of manualCounts) manualMap.set(`${mc.item_type_id}|${mc.marketplace_id}`, mc.actual_distributed);

      // Allocation sheet rows
      const sheet = allocs.map((a) => {
        const item = itemMap.get(a.item_type_id);
        const mp = mpMap.get(a.marketplace_id);
        const manual = manualMap.get(`${a.item_type_id}|${a.marketplace_id}`);
        const distributed = manual ?? a.distributed_quantity ?? 0;
        return {
          id: a.id,
          marketplaceId: a.marketplace_id,
          marketplace: mp?.name || '(unknown)',
          eventDate: mp?.event_date || '',
          partner: mp?.outreach_partner || '',
          itemId: a.item_type_id,
          item: item?.name || '(unknown)',
          category: item?.category || '',
          subcategory: item?.subcategory || '',
          allocated: a.allocated_quantity || 0,
          distributed,
          remaining: Math.max((a.allocated_quantity || 0) - distributed, 0),
          manualOverride: manual != null,
          updatedAt: a.updated_at,
        };
      });

      // Category breakdown
      const catMap = new Map<string, { category: string; allocated: number; distributed: number; items: Set<string>; events: Set<string> }>();
      for (const r of sheet) {
        const k = r.category || 'Uncategorized';
        if (!catMap.has(k)) catMap.set(k, { category: k, allocated: 0, distributed: 0, items: new Set(), events: new Set() });
        const c = catMap.get(k)!;
        c.allocated += r.allocated;
        c.distributed += r.distributed;
        c.items.add(r.itemId);
        c.events.add(r.marketplaceId);
      }
      const byCategory = Array.from(catMap.values())
        .map((c) => ({
          ...c,
          itemsCount: c.items.size,
          eventsCount: c.events.size,
          remaining: Math.max(c.allocated - c.distributed, 0),
          rate: c.allocated ? Math.round((c.distributed / c.allocated) * 100) : 0,
        }))
        .sort((a, b) => b.allocated - a.allocated);

      // Planned vs actual (per marketplace)
      const mpAgg = new Map<string, { id: string; name: string; date: string | null; partner: string; planned: number; actual: number; itemsPlanned: number; itemsDistributed: number }>();
      for (const r of sheet) {
        const k = r.marketplaceId;
        if (!mpAgg.has(k)) {
          mpAgg.set(k, { id: k, name: r.marketplace, date: r.eventDate, partner: r.partner, planned: 0, actual: 0, itemsPlanned: 0, itemsDistributed: 0 });
        }
        const a = mpAgg.get(k)!;
        a.planned += r.allocated;
        a.actual += r.distributed;
        if (r.allocated > 0) a.itemsPlanned++;
        if (r.distributed > 0) a.itemsDistributed++;
      }
      const plannedVsActual = Array.from(mpAgg.values())
        .map((a) => ({
          ...a,
          variance: a.actual - a.planned,
          rate: a.planned ? Math.round((a.actual / a.planned) * 100) : 0,
        }))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      // Leftovers for 2027 — per item
      const itemLeftover = new Map<string, { id: string; name: string; category: string; totalStock: number; allocated: number; distributed: number }>();
      for (const i of items) {
        itemLeftover.set(i.id, { id: i.id, name: i.name, category: i.category || 'Uncategorized', totalStock: i.total_stock || 0, allocated: 0, distributed: 0 });
      }
      for (const r of sheet) {
        const e = itemLeftover.get(r.itemId);
        if (!e) continue;
        e.allocated += r.allocated;
        e.distributed += r.distributed;
      }
      const leftovers = Array.from(itemLeftover.values())
        .map((e) => ({
          ...e,
          unallocated: Math.max(e.totalStock - e.allocated, 0),
          allocatedNotDistributed: Math.max(e.allocated - e.distributed, 0),
          totalLeftover: Math.max(e.totalStock - e.distributed, 0),
        }))
        .filter((e) => e.totalLeftover > 0)
        .sort((a, b) => b.totalLeftover - a.totalLeftover);

      // Exceptions / Reallocations
      const enrichedLogs = logs.map((l) => ({
        ...l,
        item: l.item_type_id ? (itemMap.get(l.item_type_id)?.name || '') : '',
      }));

      const totals = {
        allocated: sheet.reduce((s, r) => s + r.allocated, 0),
        distributed: sheet.reduce((s, r) => s + r.distributed, 0),
        remaining: sheet.reduce((s, r) => s + r.remaining, 0),
        events: new Set(sheet.map((r) => r.marketplaceId)).size,
        items: new Set(sheet.map((r) => r.itemId)).size,
        leftover2027: leftovers.reduce((s, r) => s + r.totalLeftover, 0),
      };

      return { sheet, byCategory, plannedVsActual, leftovers, logs: enrichedLogs, mps, totals };
    },
  });

  const filteredSheet = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.sheet.filter((r) => {
      if (eventFilter !== 'all' && r.marketplaceId !== eventFilter) return false;
      if (q && !`${r.marketplace} ${r.item} ${r.category} ${r.partner}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, eventFilter, search]);

  const exportSheet = () => {
    const header = ['Marketplace', 'Event Date', 'Outreach Partner', 'Item', 'Category', 'Subcategory', 'Allocated', 'Distributed', 'Remaining', 'Source'];
    const rows = filteredSheet.map((r) => [
      r.marketplace, r.eventDate, r.partner, r.item, r.category, r.subcategory,
      r.allocated, r.distributed, r.remaining, r.manualOverride ? 'Manual count' : 'GIF system',
    ]);
    downloadCsv(`item-allocation-sheet-${format(new Date(), 'yyyy-MM-dd')}.csv`, [header, ...rows]);
  };

  const exportCategory = () => {
    if (!data) return;
    const header = ['Category', 'Items', 'Events', 'Allocated', 'Distributed', 'Remaining', 'Distribution Rate'];
    const rows = data.byCategory.map((c) => [c.category, c.itemsCount, c.eventsCount, c.allocated, c.distributed, c.remaining, `${c.rate}%`]);
    downloadCsv(`allocation-by-category-${format(new Date(), 'yyyy-MM-dd')}.csv`, [header, ...rows]);
  };

  const exportPvA = () => {
    if (!data) return;
    const header = ['Marketplace', 'Date', 'Partner', 'Planned', 'Actual', 'Variance', 'Rate', 'Items Planned', 'Items Distributed'];
    const rows = data.plannedVsActual.map((r) => [r.name, r.date || '', r.partner, r.planned, r.actual, r.variance, `${r.rate}%`, r.itemsPlanned, r.itemsDistributed]);
    downloadCsv(`planned-vs-actual-${format(new Date(), 'yyyy-MM-dd')}.csv`, [header, ...rows]);
  };

  const exportLeftovers = () => {
    if (!data) return;
    const header = ['Item', 'Category', 'Total Stock', 'Allocated', 'Distributed', 'Unallocated', 'Allocated-Not-Distributed', 'Total Leftover (for 2027)'];
    const rows = data.leftovers.map((e) => [e.name, e.category, e.totalStock, e.allocated, e.distributed, e.unallocated, e.allocatedNotDistributed, e.totalLeftover]);
    downloadCsv(`leftovers-for-2027-${format(new Date(), 'yyyy-MM-dd')}.csv`, [header, ...rows]);
  };

  const exportLogs = () => {
    if (!data) return;
    const header = ['Date', 'Marketplace', 'Item', 'Action', 'Qty Before', 'Qty After', 'Change', 'Description', 'Performed by'];
    const rows = data.logs.map((l) => [
      fmt(l.created_at), l.marketplace_name || '', l.item, l.action_type,
      l.quantity_before, l.quantity_after, (l.quantity_after - l.quantity_before),
      l.description, l.performed_by_email || '',
    ]);
    downloadCsv(`allocation-changes-log-${format(new Date(), 'yyyy-MM-dd')}.csv`, [header, ...rows]);
  };

  const exportAll = () => {
    exportSheet();
    setTimeout(exportCategory, 250);
    setTimeout(exportPvA, 500);
    setTimeout(exportLeftovers, 750);
    setTimeout(exportLogs, 1000);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageSearch className="w-5 h-5 text-primary" />
            Item Allocation Evidence
          </CardTitle>
          <Button onClick={exportAll} disabled={isLoading || !data} size="sm">
            <Download className="w-4 h-4 mr-2" /> Download all (CSV)
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
              <Chip label="Allocated" value={data.totals.allocated} color="text-amber-600" />
              <Chip label="Distributed" value={data.totals.distributed} color="text-emerald-600" />
              <Chip label="Remaining" value={data.totals.remaining} color="text-rose-600" />
              <Chip label="Events" value={data.totals.events} />
              <Chip label="Item types" value={data.totals.items} />
              <Chip label="Leftover for 2027" value={data.totals.leftover2027} color="text-violet-600" />
            </div>

            <Tabs defaultValue="sheet">
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="sheet">Allocation Sheet</TabsTrigger>
                <TabsTrigger value="category">By Category</TabsTrigger>
                <TabsTrigger value="pva">Planned vs Actual</TabsTrigger>
                <TabsTrigger value="leftovers">Leftovers for 2027</TabsTrigger>
                <TabsTrigger value="logs">Exceptions / Reallocations</TabsTrigger>
              </TabsList>

              {/* Allocation sheet */}
              <TabsContent value="sheet" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Select value={eventFilter} onValueChange={setEventFilter}>
                      <SelectTrigger className="w-64 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All events</SelectItem>
                        {data.mps.map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        className="pl-8 h-9 w-64"
                        placeholder="Search item, partner..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={exportSheet}>
                    <Download className="w-4 h-4 mr-2" /> Download CSV
                  </Button>
                </div>
                <div className="border rounded-lg overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Marketplace</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                        <TableHead className="text-right">Distributed</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSheet.slice(0, 500).map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{r.marketplace}</div>
                            {r.eventDate && <div className="text-xs text-muted-foreground">{format(new Date(r.eventDate), 'MMM d, yyyy')}</div>}
                          </TableCell>
                          <TableCell className="text-sm">{r.partner || '-'}</TableCell>
                          <TableCell className="text-sm">{r.item}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.category}</TableCell>
                          <TableCell className="text-right font-mono">{r.allocated}</TableCell>
                          <TableCell className="text-right font-mono">{r.distributed}</TableCell>
                          <TableCell className="text-right font-mono">{r.remaining}</TableCell>
                          <TableCell>
                            {r.manualOverride
                              ? <Badge variant="secondary" className="text-xs">Manual</Badge>
                              : <Badge variant="outline" className="text-xs">GIF</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {filteredSheet.length > 500 && (
                  <p className="text-xs text-muted-foreground">
                    Showing first 500 of {filteredSheet.length}. Export CSV for full list.
                  </p>
                )}
              </TabsContent>

              {/* By category */}
              <TabsContent value="category" className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={exportCategory}>
                    <Download className="w-4 h-4 mr-2" /> Download CSV
                  </Button>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Events</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                        <TableHead className="text-right">Distributed</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byCategory.map((c) => (
                        <TableRow key={c.category}>
                          <TableCell className="font-medium">{c.category}</TableCell>
                          <TableCell className="text-right font-mono">{c.itemsCount}</TableCell>
                          <TableCell className="text-right font-mono">{c.eventsCount}</TableCell>
                          <TableCell className="text-right font-mono">{c.allocated.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{c.distributed.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{c.remaining.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{c.rate}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Planned vs actual */}
              <TabsContent value="pva" className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={exportPvA}>
                    <Download className="w-4 h-4 mr-2" /> Download CSV
                  </Button>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Marketplace</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Partner</TableHead>
                        <TableHead className="text-right">Planned</TableHead>
                        <TableHead className="text-right">Actual</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                        <TableHead className="text-right">Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.plannedVsActual.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-sm">{r.date ? format(new Date(r.date), 'MMM d, yyyy') : '-'}</TableCell>
                          <TableCell className="text-sm">{r.partner || '-'}</TableCell>
                          <TableCell className="text-right font-mono">{r.planned.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{r.actual.toLocaleString()}</TableCell>
                          <TableCell className={`text-right font-mono ${r.variance < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {r.variance > 0 ? '+' : ''}{r.variance.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono">{r.rate}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Leftovers */}
              <TabsContent value="leftovers" className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={exportLeftovers}>
                    <Download className="w-4 h-4 mr-2" /> Download CSV
                  </Button>
                </div>
                <div className="border rounded-lg overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Total Stock</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                        <TableHead className="text-right">Distributed</TableHead>
                        <TableHead className="text-right">Unallocated</TableHead>
                        <TableHead className="text-right">Alloc-Not-Distrib</TableHead>
                        <TableHead className="text-right">Leftover for 2027</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.leftovers.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium text-sm">{e.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{e.category}</TableCell>
                          <TableCell className="text-right font-mono">{e.totalStock.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{e.allocated.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{e.distributed.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{e.unallocated.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{e.allocatedNotDistributed.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono font-semibold text-violet-600">{e.totalLeftover.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Logs */}
              <TabsContent value="logs" className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={exportLogs}>
                    <Download className="w-4 h-4 mr-2" /> Download CSV
                  </Button>
                </div>
                <div className="border rounded-lg overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Marketplace</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead className="text-right">Before</TableHead>
                        <TableHead className="text-right">After</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.logs.slice(0, 500).map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs font-mono">{fmt(l.created_at)}</TableCell>
                          <TableCell className="text-sm">{l.marketplace_name}</TableCell>
                          <TableCell className="text-sm">{l.item}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">{l.action_type}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{l.quantity_before}</TableCell>
                          <TableCell className="text-right font-mono">{l.quantity_after}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-md truncate" title={l.description}>{l.description}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{l.performed_by_email || '-'}</TableCell>
                        </TableRow>
                      ))}
                      {data.logs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">
                            No allocation changes logged.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                {data.logs.length > 500 && (
                  <p className="text-xs text-muted-foreground">
                    Showing first 500 of {data.logs.length}. Export CSV for full log.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const Chip = ({ label, value, color = 'text-foreground' }: { label: string; value: number; color?: string }) => (
  <div className="rounded-lg border p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-xl font-bold ${color}`}>{value.toLocaleString()}</div>
  </div>
);
