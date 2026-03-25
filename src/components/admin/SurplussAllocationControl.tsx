import { useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  RefreshCw,
  Send,
  Package,
  Undo2,
  Loader2,
  Search,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RotateCcw,
  List,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SurplussAllocationControlProps {
  onBack: () => void;
}

interface MarketplaceEvent {
  id: number;
  title?: string;
  name?: string;
  event_date?: string;
  status?: string;
  marketplace_location?: { name?: string };
  outreach_partner?: { name?: string };
}

/** Raw row from GET marketplace-events/:id/allocations */
interface AllocationItem {
  id: number;
  material_id?: number;
  amount?: number;
  total_amount?: number;
  distributed_amount?: number;
  remaining_amount?: number;
  allocated_materials?: Array<{
    material_id?: number | null;
    donation_metadata_id?: number;
    material_title?: string;
    amount?: number;
    distributed_amount?: number;
    remaining_amount?: number;
    donation_tag_name?: string;
    donation_tag_subcategory_name?: string;
  }>;
  donation_metadata?: {
    id?: number;
    title?: string;
    material?: { id?: number; title?: string };
    material_group?: { name?: string };
  };
}

/** One display row in Manage tab (per material for batch allocations) */
interface ManageAllocationRow {
  rowKey: string;
  /** Surpluss MARKETPLACE_EVENT_DONATION_ALLOCATION id */
  parentAllocationId: number;
  /** Surpluss material id for batch_update API */
  materialId: number;
  title: string;
  groupLabel?: string;
  amount: number;
  distributedAmount?: number;
  remainingAmount?: number;
  kind: "batch_material" | "legacy_single";
  /** When >1, return-remaining on parent would affect all materials */
  parentMaterialCount: number;
}

interface DonationMetadata {
  id: number;
  title: string;
  quantity?: number;
  item_count?: number;
  material_group?: { name?: string };
  company?: { name?: string };
}

interface BatchMaterial {
  material_id: number;
  material_title: string;
  amount: number;
}

interface AuditLogEntry {
  id: string;
  action: string;
  environment: string;
  request_payload: Record<string, unknown>;
  response_status: number;
  response_body: unknown;
  success: boolean;
  created_at: string;
}

/** Expand batch allocations (allocated_materials JSON) into one UI row per material */
function flattenAllocationsForManage(items: AllocationItem[]): ManageAllocationRow[] {
  const rows: ManageAllocationRow[] = [];
  for (const a of items) {
    const parentId = a.id;
    const materials = a.allocated_materials;
    if (Array.isArray(materials) && materials.length > 0) {
      const count = materials.length;
      for (const mat of materials) {
        const mid = mat.material_id != null ? Number(mat.material_id) : NaN;
        if (!Number.isFinite(mid) || mid <= 0) continue;
        rows.push({
          rowKey: `${parentId}-${mid}`,
          parentAllocationId: parentId,
          materialId: mid,
          title: mat.material_title || `Material #${mid}`,
          groupLabel: mat.donation_tag_subcategory_name || mat.donation_tag_name,
          amount: Number(mat.amount ?? 0),
          distributedAmount: mat.distributed_amount != null ? Number(mat.distributed_amount) : undefined,
          remainingAmount: mat.remaining_amount != null ? Number(mat.remaining_amount) : undefined,
          kind: "batch_material",
          parentMaterialCount: count,
        });
      }
    } else {
      const dm = a.donation_metadata;
      const matFromDm = dm?.material?.id != null ? Number(dm.material.id) : NaN;
      const mid =
        Number.isFinite(matFromDm) && matFromDm > 0
          ? matFromDm
          : a.material_id != null && Number(a.material_id) > 0
            ? Number(a.material_id)
            : 0;
      const title = dm?.title || dm?.material?.title || (mid > 0 ? `Material #${mid}` : `Allocation #${parentId}`);
      rows.push({
        rowKey: `legacy-${parentId}`,
        parentAllocationId: parentId,
        materialId: mid,
        title,
        groupLabel: dm?.material_group?.name,
        amount: Number(a.amount ?? a.total_amount ?? 0),
        distributedAmount: a.distributed_amount != null ? Number(a.distributed_amount) : undefined,
        remainingAmount: a.remaining_amount != null ? Number(a.remaining_amount) : undefined,
        kind: "legacy_single",
        parentMaterialCount: 1,
      });
    }
  }
  return rows;
}

export const SurplussAllocationControl = ({ onBack }: SurplussAllocationControlProps) => {
  const [environment, setEnvironment] = useState<"staging" | "production">("production");
  const [activeTab, setActiveTab] = useState<"allocate" | "manage" | "audit">("allocate");
  const { toast } = useToast();

  // Marketplace events
  const [events, setEvents] = useState<MarketplaceEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const [eventAllocations, setEventAllocations] = useState<AllocationItem[]>([]);
  const [isLoadingAllocations, setIsLoadingAllocations] = useState(false);

  // Donation metadata search
  const [donationSearch, setDonationSearch] = useState("");
  const [donations, setDonations] = useState<DonationMetadata[]>([]);
  const [isSearchingDonations, setIsSearchingDonations] = useState(false);

  // Batch allocation
  const [batchItems, setBatchItems] = useState<BatchMaterial[]>([]);
  const [isAllocating, setIsAllocating] = useState(false);

  const [editingRowKey, setEditingRowKey] = useState<string | null>(null);
  const [updateAmount, setUpdateAmount] = useState("");
  /** Row currently executing update/delete (spinner) */
  const [pendingRowKey, setPendingRowKey] = useState<string | null>(null);

  // Return remaining (Surpluss API is per parent allocation — only safe when that parent has one material)
  const [returningParentId, setReturningParentId] = useState<number | null>(null);
  const [confirmReturnParentId, setConfirmReturnParentId] = useState<number | null>(null);

  const manageRows = useMemo(() => flattenAllocationsForManage(eventAllocations), [eventAllocations]);

  // Audit log
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const callApi = useCallback(
    async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke("surpluss-allocations-api", {
        body: { ...payload, environment },
      });
      if (error) throw error;
      return data;
    },
    [environment],
  );

  // Fetch marketplace events
  const fetchEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const result = await callApi({ action: "list_marketplace_events", page: 1, limit: 100 });
      if (!result.success) throw new Error(result.error || "Failed to fetch events");
      const items = result.data?.items || result.data?.data || result.data || [];
      setEvents(Array.isArray(items) ? items : []);
      toast({
        title: "Events Loaded",
        description: `Found ${Array.isArray(items) ? items.length : 0} marketplace events`,
      });
    } catch (err) {
      toast({
        title: "Fetch Failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setIsLoadingEvents(false);
    }
  };

  // Fetch allocations for a marketplace event
  const fetchEventAllocations = async (eventId: number) => {
    setIsLoadingAllocations(true);
    setSelectedEventId(eventId);
    try {
      const result = await callApi({ action: "get_event_allocations", event_id: eventId });
      if (!result.success) throw new Error(result.error || "Failed to fetch allocations");
      const items = result.data?.items || result.data?.data || result.data || [];
      setEventAllocations(Array.isArray(items) ? (items as AllocationItem[]) : []);
    } catch (err) {
      toast({
        title: "Fetch Failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAllocations(false);
    }
  };

  // Search donation metadata for allocation
  const searchDonations = async () => {
    if (!donationSearch.trim()) return;
    setIsSearchingDonations(true);
    try {
      const result = await callApi({ action: "get_donation_metadata", search: donationSearch, page: 1, limit: 50 });
      if (!result.success) throw new Error(result.error || "Failed to search");
      const items = result.data?.items || result.data?.data || result.data || [];
      setDonations(Array.isArray(items) ? items : []);
    } catch (err) {
      toast({
        title: "Search Failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setIsSearchingDonations(false);
    }
  };

  // Add item to batch
  const addToBatch = (donation: DonationMetadata, amount: number) => {
    if (amount <= 0) return;
    setBatchItems((prev) => {
      const existing = prev.find((b) => b.material_id === donation.id);
      if (existing) {
        return prev.map((b) => (b.material_id === donation.id ? { ...b, amount } : b));
      }
      return [...prev, { material_id: donation.id, material_title: donation.title, amount }];
    });
  };

  const removeBatchItem = (materialId: number) => {
    setBatchItems((prev) => prev.filter((b) => b.material_id !== materialId));
  };

  // Execute batch allocation
  const executeBatchAllocate = async () => {
    if (!selectedEventId || batchItems.length === 0) {
      toast({ title: "Missing Data", description: "Select a marketplace event and add items", variant: "destructive" });
      return;
    }
    setIsAllocating(true);
    try {
      const result = await callApi({
        action: "batch_allocate",
        marketplace_event_id: selectedEventId,
        materials: batchItems.map((b) => ({ material_id: b.material_id, amount: b.amount })),
      });
      if (!result.success) throw new Error(result.error || JSON.stringify(result.data));
      toast({
        title: "Allocation Successful",
        description: `Allocated ${batchItems.length} items to event #${selectedEventId}`,
      });
      setBatchItems([]);
      fetchEventAllocations(selectedEventId);
    } catch (err) {
      toast({
        title: "Allocation Failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setIsAllocating(false);
    }
  };

  // Update amount: batch materials use batch_update; legacy single-allocation uses update_allocation
  const executeUpdate = async (row: ManageAllocationRow) => {
    const amount = parseInt(updateAmount, 10);
    if (isNaN(amount) || amount < 0) {
      toast({ title: "Invalid Amount", variant: "destructive" });
      return;
    }
    setPendingRowKey(row.rowKey);
    try {
      if (row.kind === "batch_material") {
        if (!selectedEventId) {
          toast({ title: "Missing event", description: "Select a marketplace event first", variant: "destructive" });
          return;
        }
        const result = await callApi({
          action: "batch_update",
          marketplace_event_id: selectedEventId,
          materials: [{ material_id: row.materialId, amount }],
        });
        if (!result.success) throw new Error(result.error || "Update failed");
        toast({
          title: "Material Updated",
          description: `${row.title}: amount set to ${amount} on event #${selectedEventId}`,
        });
      } else {
        const result = await callApi({
          action: "update_allocation",
          allocation_id: row.parentAllocationId,
          amount,
        });
        if (!result.success) throw new Error(result.error || "Update failed");
        toast({
          title: "Allocation Updated",
          description: `Allocation #${row.parentAllocationId} updated to ${amount}`,
        });
      }
      setUpdateAmount("");
      if (selectedEventId) fetchEventAllocations(selectedEventId);
    } catch (err) {
      toast({
        title: "Update Failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setPendingRowKey(null);
    }
  };

  const executeReturnRemaining = async (parentAllocationId: number) => {
    setReturningParentId(parentAllocationId);
    try {
      const result = await callApi({ action: "return_remaining", allocation_id: parentAllocationId });
      if (!result.success) throw new Error(result.error || "Return failed");
      toast({
        title: "Items Returned",
        description: `Remaining items from allocation #${parentAllocationId} returned to donation pool`,
      });
      if (selectedEventId) fetchEventAllocations(selectedEventId);
    } catch (err) {
      toast({
        title: "Return Failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setReturningParentId(null);
      setConfirmReturnParentId(null);
    }
  };

  /** Remove one material from a batch (batch_update 0). Legacy row: delete_allocation on parent. */
  const executeDelete = async (row: ManageAllocationRow) => {
    setPendingRowKey(row.rowKey);
    try {
      if (row.kind === "batch_material") {
        if (!selectedEventId) {
          toast({ title: "Missing event", description: "Select a marketplace event first", variant: "destructive" });
          return;
        }
        const result = await callApi({
          action: "batch_update",
          marketplace_event_id: selectedEventId,
          materials: [{ material_id: row.materialId, amount: 0 }],
        });
        if (!result.success) throw new Error(result.error || "Remove failed");
        toast({
          title: "Material Removed",
          description: `${row.title} set to 0 on Surpluss (other materials unchanged)`,
        });
      } else {
        const result = await callApi({ action: "delete_allocation", allocation_id: row.parentAllocationId });
        if (!result.success) throw new Error(result.error || "Delete failed");
        toast({ title: "Allocation Deleted", description: `Allocation #${row.parentAllocationId} removed` });
      }
      if (selectedEventId) fetchEventAllocations(selectedEventId);
    } catch (err) {
      toast({
        title: "Delete Failed",
        description: err instanceof Error ? err.message : "Error",
        variant: "destructive",
      });
    } finally {
      setPendingRowKey(null);
    }
  };

  // Fetch audit log
  const fetchAuditLog = async () => {
    setIsLoadingAudit(true);
    try {
      const { data, error } = await supabase
        .from("surpluss_api_audit_log")
        .select("*")
        .eq("environment", environment)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setAuditLogs((data || []) as AuditLogEntry[]);
    } catch (err) {
      toast({ title: "Failed to load audit log", variant: "destructive" });
    } finally {
      setIsLoadingAudit(false);
    }
  };

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-4 md:py-6 px-4 max-w-6xl mx-auto"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold">Surpluss Allocation Control</h1>
          <p className="text-sm text-muted-foreground">
            Create, update, and return allocations directly on the Surpluss platform
          </p>
        </div>
        <Select value={environment} onValueChange={(v) => setEnvironment(v as "staging" | "production")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="staging">Staging</SelectItem>
            <SelectItem value="production">Production</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="allocate" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Allocate
          </TabsTrigger>
          <TabsTrigger value="manage" className="gap-1.5">
            <List className="h-3.5 w-3.5" />
            Manage
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* ===================== ALLOCATE TAB ===================== */}
        <TabsContent value="allocate" className="space-y-4">
          {/* Step 1: Select Marketplace Event */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                  1
                </span>
                Select Marketplace Event
              </CardTitle>
              <CardDescription>Choose the Surpluss marketplace event to allocate items to</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Button onClick={fetchEvents} disabled={isLoadingEvents} size="sm">
                  {isLoadingEvents ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                  )}
                  Load Events
                </Button>
                {selectedEvent && (
                  <Badge variant="secondary" className="text-sm">
                    Selected: #{selectedEvent.id} — {selectedEvent.title || selectedEvent.name}
                  </Badge>
                )}
              </div>
              {events.length > 0 && (
                <div className="max-h-48 overflow-y-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">ID</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.id} className={selectedEventId === event.id ? "bg-primary/5" : ""}>
                          <TableCell className="font-mono text-xs">{event.id}</TableCell>
                          <TableCell className="font-medium text-sm">{event.title || event.name || "—"}</TableCell>
                          <TableCell className="text-xs">{event.event_date || "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                event.status === "PLANNED"
                                  ? "outline"
                                  : event.status === "COMPLETED"
                                    ? "secondary"
                                    : "default"
                              }
                              className="text-xs"
                            >
                              {event.status || "—"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={selectedEventId === event.id ? "default" : "outline"}
                              onClick={() => {
                                setSelectedEventId(event.id);
                                fetchEventAllocations(event.id);
                              }}
                              className="h-7 text-xs"
                            >
                              Select
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Search & Add Materials */}
          {selectedEventId && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                    2
                  </span>
                  Search & Add Materials
                </CardTitle>
                <CardDescription>Search Surpluss donation metadata to find materials for allocation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="Search materials (e.g. food, clothing...)"
                    value={donationSearch}
                    onChange={(e) => setDonationSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchDonations()}
                    className="flex-1"
                  />
                  <Button onClick={searchDonations} disabled={isSearchingDonations} size="sm">
                    {isSearchingDonations ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {donations.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border rounded-md mb-3">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">ID</TableHead>
                          <TableHead>Material</TableHead>
                          <TableHead>Group</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead className="w-32">Amount</TableHead>
                          <TableHead className="w-16"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {donations.map((d) => {
                          const batchEntry = batchItems.find((b) => b.material_id === d.id);
                          return (
                            <TableRow key={d.id}>
                              <TableCell className="font-mono text-xs">{d.id}</TableCell>
                              <TableCell className="text-sm font-medium truncate max-w-[200px]">{d.title}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {d.material_group?.name || "—"}
                              </TableCell>
                              <TableCell className="text-xs">{d.quantity ?? d.item_count ?? "—"}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="1"
                                  placeholder="Qty"
                                  defaultValue={batchEntry?.amount || ""}
                                  className="h-7 text-xs w-20"
                                  id={`amt-${d.id}`}
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    const input = document.getElementById(`amt-${d.id}`) as HTMLInputElement;
                                    const val = parseInt(input?.value || "0");
                                    if (val > 0) addToBatch(d, val);
                                  }}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Batch queue */}
                {batchItems.length > 0 && (
                  <div className="border rounded-md p-3 bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Allocation Queue ({batchItems.length} items)</Label>
                      <Button size="sm" variant="ghost" onClick={() => setBatchItems([])}>
                        Clear All
                      </Button>
                    </div>
                    <div className="space-y-1.5 mb-3">
                      {batchItems.map((b) => (
                        <div
                          key={b.material_id}
                          className="flex items-center justify-between text-sm bg-background rounded px-2 py-1"
                        >
                          <span className="truncate flex-1">
                            #{b.material_id} — {b.material_title}
                          </span>
                          <span className="font-mono text-xs mx-2">×{b.amount}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => removeBatchItem(b.material_id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button onClick={executeBatchAllocate} disabled={isAllocating} className="w-full">
                      {isAllocating ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Allocate {batchItems.length} Item{batchItems.length > 1 ? "s" : ""} to Event #{selectedEventId}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ===================== MANAGE TAB ===================== */}
        <TabsContent value="manage" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Manage Event Allocations</CardTitle>
              <CardDescription>
                View, update amounts, and return remaining items for a marketplace event
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Event selector */}
              <div className="flex gap-2 mb-4">
                <Button onClick={fetchEvents} disabled={isLoadingEvents} size="sm" variant="outline">
                  {isLoadingEvents ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                  )}
                  Load Events
                </Button>
                {events.length > 0 && (
                  <Select
                    value={selectedEventId?.toString() || ""}
                    onValueChange={(v) => {
                      const id = parseInt(v);
                      setSelectedEventId(id);
                      fetchEventAllocations(id);
                    }}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select event..." />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((e) => (
                        <SelectItem key={e.id} value={e.id.toString()}>
                          #{e.id} — {e.title || e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Allocations table */}
              {isLoadingAllocations ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : manageRows.length > 0 ? (
                <div className="border rounded-md overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">Alloc / Mat.</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                        <TableHead className="text-right">Distributed</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead className="w-48">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {manageRows.map((row) => (
                        <TableRow key={row.rowKey}>
                          <TableCell className="font-mono text-xs">
                            <span className="block text-muted-foreground">#{row.parentAllocationId}</span>
                            <span className="block">m{row.materialId || "—"}</span>
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.title}
                            {row.groupLabel && (
                              <span className="text-xs text-muted-foreground ml-1">({row.groupLabel})</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">{row.amount ?? "—"}</TableCell>
                          <TableCell className="text-right font-mono text-emerald-600">
                            {row.distributedAmount ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono">{row.remainingAmount ?? "—"}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              <div className="flex gap-1 items-center">
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="New amt"
                                  className="h-7 text-xs w-16"
                                  value={editingRowKey === row.rowKey ? updateAmount : ""}
                                  onChange={(e) => {
                                    setEditingRowKey(row.rowKey);
                                    setUpdateAmount(e.target.value);
                                  }}
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={
                                    pendingRowKey === row.rowKey ||
                                    (editingRowKey === row.rowKey && !updateAmount.trim())
                                  }
                                  onClick={() => executeUpdate(row)}
                                >
                                  {pendingRowKey === row.rowKey ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set"}
                                </Button>
                              </div>
                              {row.parentMaterialCount === 1 ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-orange-600 border-orange-300"
                                  disabled={returningParentId === row.parentAllocationId}
                                  onClick={() => setConfirmReturnParentId(row.parentAllocationId)}
                                  title="Return remaining (this allocation has a single material)"
                                >
                                  {returningParentId === row.parentAllocationId ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-3 w-3" />
                                  )}
                                </Button>
                              ) : null}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-destructive"
                                onClick={() => executeDelete(row)}
                                title={
                                  row.kind === "batch_material"
                                    ? "Remove this material only (others stay)"
                                    : "Delete allocation"
                                }
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : selectedEventId ? (
                <p className="text-sm text-muted-foreground text-center py-4">No allocations found for this event</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===================== AUDIT TAB ===================== */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">API Audit Log</CardTitle>
                  <CardDescription>History of all write operations sent to the Surpluss API</CardDescription>
                </div>
                <Button onClick={fetchAuditLog} disabled={isLoadingAudit} size="sm" variant="outline">
                  {isLoadingAudit ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1.5" />
                  )}
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {auditLogs.length > 0 ? (
                <div className="border rounded-md overflow-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>HTTP</TableHead>
                        <TableHead className="hidden md:table-cell">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-mono">
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={log.success ? "default" : "destructive"} className="text-xs">
                              {log.success ? "OK" : "Failed"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{log.response_status}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[300px] truncate">
                            {JSON.stringify(log.request_payload).substring(0, 100)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {isLoadingAudit ? "Loading..." : "No audit logs yet. Click Refresh to load."}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Return Remaining Confirmation Dialog */}
      <AlertDialog open={confirmReturnParentId !== null} onOpenChange={() => setConfirmReturnParentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Return Remaining Items?</AlertDialogTitle>
            <AlertDialogDescription>
              This will return all undistributed items from allocation #{confirmReturnParentId} back to the Surpluss
              donation pool. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmReturnParentId != null && executeReturnRemaining(confirmReturnParentId)}
            >
              Return Items
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};
