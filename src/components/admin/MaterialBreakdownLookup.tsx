import { useState, useMemo } from "react";
import { Search, Package, AlertTriangle, Loader2, Wrench, RefreshCcw, GitCompareArrows } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { useItemTypes } from "@/hooks/useSupabaseData";
import { useSurplussDonationMetadata } from "@/hooks/useSurplussDonationMetadata";
import { surplussBulkReconcileDonationRemaining, type BulkReconcileResponse } from "@/lib/surplussReconcileRemaining";
import { auditGifTractorMismatch, type MismatchReport } from "@/lib/auditGifTractorMismatch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface MarketplaceBreakdown {
  marketplace_id: string;
  marketplace_name: string;
  allocated: number;
  distributed: number;
  remaining: number;
}

interface FixReport {
  dry_run: boolean;
  summary: {
    total_items_scanned: number;
    total_allocations_scanned: number;
    stock_changes_needed: number;
    distribution_corruptions_found: number;
    stock_updates_applied?: number;
    distribution_fixes_applied?: number;
  };
  stock_changes: Array<{
    material_id: number;
    name: string;
    old_total_stock: number;
    new_total_stock: number;
    delta: number;
  }>;
  stock_changes_total: number;
  corruption_fixes: Array<{
    material_id: number;
    name: string;
    old_distributed: number;
    allocated: number;
    capped_to: number;
  }>;
  message: string;
}

export const MaterialBreakdownLookup = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: itemTypes = [] } = useItemTypes();
  const [fixReport, setFixReport] = useState<FixReport | null>(null);
  const [fixLoading, setFixLoading] = useState(false);
  const [bulkReconcileReport, setBulkReconcileReport] = useState<BulkReconcileResponse | null>(null);
  const [bulkReconcileLoading, setBulkReconcileLoading] = useState(false);
  const [auditReport, setAuditReport] = useState<MismatchReport | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const matchingItems = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return itemTypes
      .filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.externalMaterialId && String(item.externalMaterialId).includes(q)),
      )
      .slice(0, 10);
  }, [searchQuery, itemTypes]);

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedItem = itemTypes.find((i) => i.id === selectedItemId);

  const tractorMetaLookup = useSurplussDonationMetadata(selectedItem?.externalMaterialId ?? null, {
    enabled: !!selectedItemId && selectedItem?.externalMaterialId != null,
    environment: "production",
  });

  const { data: breakdownData, isLoading: loadingBreakdown } = useQuery({
    queryKey: ["material-breakdown", selectedItemId],
    queryFn: async () => {
      if (!selectedItemId) return null;
      const { data, error } = await supabase
        .from("marketplace_item_allocations")
        .select(
          `
          id,
          allocated_quantity,
          distributed_quantity,
          marketplace_id,
          marketplace_events!inner(name, event_date)
        `,
        )
        .eq("item_type_id", selectedItemId);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        marketplace_id: row.marketplace_id,
        marketplace_name: `${row.marketplace_events.name}${row.marketplace_events.event_date ? ` (${new Date(row.marketplace_events.event_date).toLocaleDateString()})` : ""}`,
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

  const runFix = async (dryRun: boolean) => {
    setFixLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fix-allocation-data", {
        body: { dry_run: dryRun },
      });
      if (error) throw error;
      setFixReport(data);
      toast.success(dryRun ? "Dry run complete — review changes below" : "Fixes applied successfully!");
    } catch (err: any) {
      toast.error(`Fix failed: ${err.message}`);
    } finally {
      setFixLoading(false);
    }
  };

  const runBulkReconcile = async (dryRun: boolean) => {
    setBulkReconcileLoading(true);
    try {
      const result = await surplussBulkReconcileDonationRemaining({ dry_run: dryRun, environment: "production" });
      if ("error" in result) throw new Error(result.error);
      setBulkReconcileReport(result.data);
      toast.success(
        dryRun
          ? `Dry run complete — ${result.data.drifted} discrepancies found across ${result.data.total} materials`
          : `Applied fixes to ${result.data.drifted} materials`,
      );
    } catch (err: any) {
      toast.error(`Bulk reconcile failed: ${err.message}`);
    } finally {
      setBulkReconcileLoading(false);
    }
  };

  const runMismatchAudit = async () => {
    setAuditLoading(true);
    try {
      const result = await auditGifTractorMismatch("production");
      if (result.ok === false) throw new Error(result.error);
      setAuditReport(result.report);
      toast.success(
        `Audit complete: ${result.report.summary.materials_with_issues} of ${result.report.summary.total_materials} materials have issues`,
      );
    } catch (err: any) {
      toast.error(`Audit failed: ${err.message}`);
    } finally {
      setAuditLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-card mb-6">
      <div className="p-4 md:p-6 border-b border-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="font-display font-bold text-lg flex items-center gap-2">
              <Search className="w-5 h-5" />
              Material Lookup — Cross-Marketplace View
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Search by Material ID or name to see allocation breakdown across all marketplaces
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={runMismatchAudit}
              disabled={auditLoading}
              className="flex items-center gap-2"
            >
              {auditLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitCompareArrows className="w-4 h-4" />}
              GIF ↔ Tractor Audit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runBulkReconcile(true)}
              disabled={bulkReconcileLoading}
              className="flex items-center gap-2"
            >
              {bulkReconcileLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              Bulk Reconcile Remaining
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runFix(true)}
              disabled={fixLoading}
              className="flex items-center gap-2"
            >
              {fixLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
              Run Allocation Audit
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-4">
        {/* Bulk Reconcile Report */}
        {bulkReconcileReport && (
          <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <RefreshCcw className="w-4 h-4" />
                {bulkReconcileReport.dry_run ? "Bulk Reconcile — Dry Run" : "Bulk Reconcile — Applied"}
              </h3>
              <div className="flex gap-2">
                {bulkReconcileReport.dry_run && bulkReconcileReport.drifted > 0 && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => runBulkReconcile(false)}
                    disabled={bulkReconcileLoading}
                  >
                    {bulkReconcileLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Apply {bulkReconcileReport.drifted} Fixes
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setBulkReconcileReport(null)}>
                  Dismiss
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-2 bg-background rounded border">
                <p className="text-muted-foreground text-xs">Materials Checked</p>
                <p className="font-bold">{bulkReconcileReport.total}</p>
              </div>
              <div className="p-2 bg-background rounded border">
                <p className="text-muted-foreground text-xs">Discrepancies</p>
                <p className="font-bold text-amber-600">{bulkReconcileReport.drifted}</p>
              </div>
              <div className="p-2 bg-background rounded border">
                <p className="text-muted-foreground text-xs">Errors</p>
                <p className="font-bold text-destructive">{bulkReconcileReport.errors}</p>
              </div>
              <div className="p-2 bg-background rounded border">
                <p className="text-muted-foreground text-xs">Mode</p>
                <p className="font-bold">{bulkReconcileReport.dry_run ? "Dry Run" : "Applied"}</p>
              </div>
            </div>

            {bulkReconcileReport.results.filter((r) => r.changed || r.error).length > 0 && (
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Item Count</TableHead>
                      <TableHead className="text-right">Before</TableHead>
                      <TableHead className="text-right">After</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkReconcileReport.results
                      .filter((r) => r.changed || r.error)
                      .map((r) => (
                        <TableRow key={r.material_id}>
                          <TableCell>#{r.material_id}</TableCell>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-right">{r.item_count?.toLocaleString() ?? "—"}</TableCell>
                          <TableCell className="text-right">{r.before?.toLocaleString() ?? "—"}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {r.after?.toLocaleString() ?? "—"}
                          </TableCell>
                          <TableCell>
                            {r.error ? (
                              <Badge variant="destructive" className="text-xs">{r.error}</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-amber-600">Drift fixed</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {bulkReconcileReport.drifted === 0 && bulkReconcileReport.errors === 0 && (
              <p className="text-xs text-muted-foreground">✅ All materials have correct remaining counts.</p>
            )}
          </div>
        )}

        {/* Fix Report */}
        {fixReport && (
          <div className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                {fixReport.dry_run ? "Dry Run Report" : "Fix Applied Report"}
              </h3>
              <div className="flex gap-2">
                {fixReport.dry_run && fixReport.summary.stock_changes_needed > 0 && (
                  <Button size="sm" variant="destructive" onClick={() => runFix(false)} disabled={fixLoading}>
                    {fixLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Apply {fixReport.summary.stock_changes_needed} Fixes
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setFixReport(null)}>
                  Dismiss
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-2 bg-background rounded border">
                <p className="text-muted-foreground text-xs">Items Scanned</p>
                <p className="font-bold">{fixReport.summary.total_items_scanned}</p>
              </div>
              <div className="p-2 bg-background rounded border">
                <p className="text-muted-foreground text-xs">Stock Corrections</p>
                <p className="font-bold text-amber-600">{fixReport.summary.stock_changes_needed}</p>
              </div>
              <div className="p-2 bg-background rounded border">
                <p className="text-muted-foreground text-xs">Corrupted Distributions</p>
                <p className="font-bold text-destructive">{fixReport.summary.distribution_corruptions_found}</p>
              </div>
              <div className="p-2 bg-background rounded border">
                <p className="text-muted-foreground text-xs">Allocations Scanned</p>
                <p className="font-bold">{fixReport.summary.total_allocations_scanned}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{fixReport.message}</p>

            {fixReport.corruption_fixes.length > 0 && (
              <div className="text-sm">
                <p className="font-medium text-destructive mb-1">Distribution Corruptions:</p>
                {fixReport.corruption_fixes.map((fix, i) => (
                  <p key={i} className="text-xs">
                    #{fix.material_id} {fix.name}: distributed {fix.old_distributed.toLocaleString()} → capped to{" "}
                    {fix.capped_to.toLocaleString()}
                  </p>
                ))}
              </div>
            )}

            {fixReport.stock_changes.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-medium text-amber-600">
                  Stock Changes ({fixReport.stock_changes_total} total, showing first 50)
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto text-xs space-y-0.5">
                  {fixReport.stock_changes.map((ch, i) => (
                    <p key={i}>
                      #{ch.material_id} {ch.name}: {ch.old_total_stock.toLocaleString()} →{" "}
                      {ch.new_total_stock.toLocaleString()} ({ch.delta > 0 ? "+" : ""}
                      {ch.delta.toLocaleString()})
                    </p>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

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
            {matchingItems.map((item) => (
              <button
                key={item.id}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setSelectedItemId(item.id);
                  setSearchQuery(`${item.externalMaterialId || ""} — ${item.name}`);
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {item.externalMaterialId ? `#${item.externalMaterialId}` : ""}
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
                onClick={() => {
                  setSelectedItemId(null);
                  setSearchQuery("");
                }}
              >
                Clear
              </button>
            </div>

            {selectedItem.externalMaterialId != null && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm space-y-1">
                <p className="font-semibold text-foreground flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Tractor / QR (donation_metadata)
                </p>
                <p className="text-xs text-muted-foreground">
                  Compare with GIF totals above. Tractor remaining is what Surpluss Admin shows after Scan QR.
                </p>
                {tractorMetaLookup.isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading…
                  </div>
                ) : tractorMetaLookup.isError ? (
                  <p className="text-xs text-destructive">{tractorMetaLookup.error?.message ?? "Failed to load"}</p>
                ) : (
                  <>
                    <p className="text-xs">
                      <span className="font-medium">Total (item_count):</span>{" "}
                      {tractorMetaLookup.data?.material?.item_count != null
                        ? tractorMetaLookup.data.material.item_count.toLocaleString()
                        : "—"}
                    </p>
                    <p className="text-xs">
                      <span className="font-medium">Remaining (Tractor):</span>{" "}
                      {tractorMetaLookup.data?.total_remaining_item_count != null
                        ? tractorMetaLookup.data.total_remaining_item_count.toLocaleString()
                        : "—"}
                    </p>
                    {tractorMetaLookup.data?.material?.item_count != null &&
                    tractorMetaLookup.data.material.item_count !== selectedItem.totalStock ? (
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        GIF total_stock ({selectedItem.totalStock.toLocaleString()}) ≠ Tractor item_count (
                        {tractorMetaLookup.data.material.item_count.toLocaleString()}).
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            )}

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
                        <TableCell className="text-right text-emerald-600">
                          {row.distributed.toLocaleString()}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${row.remaining < 0 ? "text-destructive" : "text-amber-600"}`}
                        >
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
                      <TableCell className={`text-right ${totalRemaining < 0 ? "text-destructive" : "text-amber-600"}`}>
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
