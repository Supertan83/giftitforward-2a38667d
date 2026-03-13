import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Package, 
  Plus, 
  Loader2, 
  Trash2, 
  MapPin,
  Warehouse,
  Pencil,
  Check,
  X,
  Undo2,
  ArrowRightLeft,
  Send,
  ChevronsUpDown,
  Search,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useItemTypes, useMarketplaces } from '@/hooks/useSupabaseData';
import { useMarketplaceAllocations, useAllocationOperations } from '@/hooks/useMarketplaceAllocations';
import { useToast } from '@/hooks/use-toast';
import { useLogTraceabilityEvent } from '@/hooks/useTraceabilityLogs';
import { supabase } from '@/integrations/supabase/client';
import { MaterialBreakdownLookup } from './MaterialBreakdownLookup';

interface AllocationManagementProps {
  onBack: () => void;
}

export const AllocationManagement = ({ onBack }: AllocationManagementProps) => {
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string>('');
  const [modalMarketplaceId, setModalMarketplaceId] = useState<string>('');
  const [modalItemTypeId, setModalItemTypeId] = useState<string>('');
  const [itemComboOpen, setItemComboOpen] = useState(false);
  const [quantity, setQuantity] = useState('');

  // Inline editing state
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [editAllocated, setEditAllocated] = useState<number>(0);
  const [editDistributed, setEditDistributed] = useState<number>(0);

  // Undo / return-to-warehouse state
  const [undoAllocation, setUndoAllocation] = useState<{ id: string; allocated: number; distributed: number } | null>(null);
  const [undoQuantity, setUndoQuantity] = useState('');

  // Re-allocate state
  const [reallocAllocation, setReallocAllocation] = useState<{ id: string; allocated: number; distributed: number } | null>(null);
  const [reallocTargetMarketplace, setReallocTargetMarketplace] = useState('');
  const [reallocQuantity, setReallocQuantity] = useState('');

  // Distribute confirmation state
  const [distributeAllocation, setDistributeAllocation] = useState<{ id: string; itemName: string; allocated: number; distributed: number } | null>(null);

  const [isSyncingFromSurpluss, setIsSyncingFromSurpluss] = useState(false);

  const { data: itemTypes = [], isLoading: loadingItems } = useItemTypes();
  const { data: marketplaces = [], isLoading: loadingMarketplaces } = useMarketplaces();
  const { data: allocations = [], isLoading: loadingAllocations } = useMarketplaceAllocations(
    selectedMarketplaceId || undefined
  );
  const { allocateToMarketplace, deleteAllocation, updateAllocationQuantities, incrementDistributed } = useAllocationOperations();
  const { toast } = useToast();
  const logEvent = useLogTraceabilityEvent();

  const activeMarketplaces = marketplaces
    .filter(m => m.status === 'active' || m.status === 'upcoming')
    .sort((a, b) => {
      if (!a.event_date && !b.event_date) return 0;
      if (!a.event_date) return 1;
      if (!b.event_date) return -1;
      return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
    });

  // All allocatable item types (those with external_material_id from Tractor)
  const allocatableItems = itemTypes.filter(item => item.externalMaterialId != null);

  const handleAllocate = async () => {
    const targetMarketplace = modalMarketplaceId || selectedMarketplaceId;
    if (!targetMarketplace || !modalItemTypeId || !quantity) {
      toast({
        title: 'Missing Fields',
        description: 'Please select a marketplace, item, and quantity',
        variant: 'destructive',
      });
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({
        title: 'Invalid Quantity',
        description: 'Please enter a valid quantity',
        variant: 'destructive',
      });
      return;
    }

    try {
      const mp = marketplaces.find(m => m.id === targetMarketplace);
      const item = itemTypes.find(i => i.id === modalItemTypeId);
      const existingAlloc = allocations.find(a => a.itemTypeId === modalItemTypeId);
      const qtyBefore = existingAlloc?.allocatedQuantity || 0;

      await allocateToMarketplace.mutateAsync({
        marketplaceId: targetMarketplace,
        itemTypeId: modalItemTypeId,
        quantity: qty,
      });

      logEvent.mutate({
        itemTypeId: modalItemTypeId,
        marketplaceId: targetMarketplace,
        marketplaceName: mp?.name || 'Unknown',
        actionType: 'allocated',
        quantityBefore: qtyBefore,
        quantityAfter: qtyBefore + qty,
        description: `${qty.toLocaleString()} units of ${item?.name || 'item'} allocated to ${mp?.name || 'marketplace'}`,
      });

      toast({
        title: 'Items Allocated',
        description: `${qty.toLocaleString()} items allocated to marketplace`,
      });
      setShowAllocateModal(false);
      setModalMarketplaceId('');
      setModalItemTypeId('');
      setQuantity('');
    } catch (error) {
      toast({
        title: 'Allocation Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (allocationId: string) => {
    if (!confirm('Remove this allocation?')) return;

    const alloc = allocations.find(a => a.id === allocationId);
    const mp = marketplaces.find(m => m.id === selectedMarketplaceId);

    try {
      await deleteAllocation.mutateAsync(allocationId);

      // Reverse sync to Surpluss: set this specific material's amount to 0
      if (alloc) {
        const itemType = itemTypes.find(i => i.id === alloc.itemTypeId);
        const marketplace = marketplaces.find(m => m.id === selectedMarketplaceId);
        if (itemType?.externalMaterialId && marketplace?.external_id) {
          try {
            await supabase.functions.invoke('surpluss-allocations-api', {
              body: {
                action: 'batch_update',
                marketplace_event_id: marketplace.external_id,
                materials: [{ material_id: itemType.externalMaterialId, amount: 0 }],
                environment: 'production'
              }
            });
            console.log(`[reverse-sync] Set material ${itemType.externalMaterialId} to 0 on Surpluss event ${marketplace.external_id}`);
          } catch (syncErr) {
            console.error('[reverse-sync] Failed to sync delete to Surpluss:', syncErr);
          }
        }
      }

      if (alloc) {
        logEvent.mutate({
          allocationId,
          itemTypeId: alloc.itemTypeId,
          marketplaceId: selectedMarketplaceId || undefined,
          marketplaceName: mp?.name || 'Unknown',
          actionType: 'removed',
          quantityBefore: alloc.allocatedQuantity,
          quantityAfter: 0,
          description: `Allocation of ${alloc.itemName || 'item'} removed from ${mp?.name || 'marketplace'}`,
        });
      }

      toast({
        title: 'Allocation Removed',
        description: 'The allocation has been deleted',
      });
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // Start editing an allocation
  const handleStartEdit = (alloc: { id: string; allocatedQuantity: number; distributedQuantity: number }) => {
    setEditingAllocationId(alloc.id);
    setEditAllocated(alloc.allocatedQuantity);
    setEditDistributed(alloc.distributedQuantity);
  };

  const handleCancelEdit = () => {
    setEditingAllocationId(null);
    setEditAllocated(0);
    setEditDistributed(0);
  };

  const handleSaveEdit = async () => {
    if (!editingAllocationId) return;

    const alloc = allocations.find(a => a.id === editingAllocationId);
    const mp = marketplaces.find(m => m.id === selectedMarketplaceId);

    try {
      await updateAllocationQuantities.mutateAsync({
        allocationId: editingAllocationId,
        allocatedQuantity: editAllocated,
        distributedQuantity: editDistributed,
      });

      // Reverse sync quantity update to Surpluss at material level
      if (alloc) {
        const itemType = itemTypes.find(i => i.id === alloc.itemTypeId);
        const marketplace = marketplaces.find(m => m.id === selectedMarketplaceId);
        if (itemType?.externalMaterialId && marketplace?.external_id) {
          try {
            await supabase.functions.invoke('surpluss-allocations-api', {
              body: {
                action: 'batch_update',
                marketplace_event_id: marketplace.external_id,
                materials: [{ material_id: itemType.externalMaterialId, amount: editAllocated }],
                environment: 'production'
              }
            });
            console.log(`[reverse-sync] Updated material ${itemType.externalMaterialId} to ${editAllocated} on Surpluss event ${marketplace.external_id}`);
          } catch (syncErr) {
            console.error('[reverse-sync] Failed to update Surpluss:', syncErr);
          }
        }
      }

      logEvent.mutate({
        allocationId: editingAllocationId,
        itemTypeId: alloc?.itemTypeId,
        marketplaceId: selectedMarketplaceId || undefined,
        marketplaceName: mp?.name || 'Unknown',
        actionType: 'edited',
        quantityBefore: alloc?.allocatedQuantity || 0,
        quantityAfter: editAllocated,
        description: `Allocation of ${alloc?.itemName || 'item'} edited: allocated ${alloc?.allocatedQuantity}→${editAllocated}, distributed ${alloc?.distributedQuantity}→${editDistributed}`,
      });

      toast({
        title: 'Allocation Updated',
        description: 'Quantities have been saved',
      });
      handleCancelEdit();
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // Handle distribute (increment distributed by 1)
  const handleDistribute = async () => {
    if (!distributeAllocation) return;
    const mp = marketplaces.find(m => m.id === selectedMarketplaceId);

    try {
      await incrementDistributed.mutateAsync(distributeAllocation.id);

      logEvent.mutate({
        allocationId: distributeAllocation.id,
        marketplaceId: selectedMarketplaceId || undefined,
        marketplaceName: mp?.name || 'Unknown',
        actionType: 'distributed',
        quantityBefore: distributeAllocation.distributed,
        quantityAfter: distributeAllocation.distributed + 1,
        description: `1 unit of ${distributeAllocation.itemName} distributed at ${mp?.name || 'marketplace'}`,
      });

      toast({
        title: 'Item Distributed',
        description: `1 unit of ${distributeAllocation.itemName} marked as distributed`,
      });
      setDistributeAllocation(null);
    } catch (error) {
      toast({
        title: 'Distribution Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // Handle undo / return to warehouse
  const handleUndo = async () => {
    if (!undoAllocation) return;
    const qty = parseInt(undoQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: 'Invalid Quantity', description: 'Enter a valid quantity to return', variant: 'destructive' });
      return;
    }
    const maxReturnable = undoAllocation.allocated - undoAllocation.distributed;
    if (qty > maxReturnable) {
      toast({ title: 'Too Many', description: `Only ${maxReturnable} undistributed items can be returned`, variant: 'destructive' });
      return;
    }
    const alloc = allocations.find(a => a.id === undoAllocation.id);
    const mp = marketplaces.find(m => m.id === selectedMarketplaceId);

    try {
      const newAllocated = undoAllocation.allocated - qty;
      if (newAllocated <= 0 && undoAllocation.distributed <= 0) {
        await deleteAllocation.mutateAsync(undoAllocation.id);
      } else {
        await updateAllocationQuantities.mutateAsync({
          allocationId: undoAllocation.id,
          allocatedQuantity: newAllocated,
        });
      }

      // Reverse sync return to Surpluss at material level
      if (alloc) {
        const itemType = itemTypes.find(i => i.id === alloc.itemTypeId);
        const marketplace = marketplaces.find(m => m.id === selectedMarketplaceId);
        if (itemType?.externalMaterialId && marketplace?.external_id) {
          try {
            const surplussAmount = Math.max(newAllocated, 0);
            await supabase.functions.invoke('surpluss-allocations-api', {
              body: {
                action: 'batch_update',
                marketplace_event_id: marketplace.external_id,
                materials: [{ material_id: itemType.externalMaterialId, amount: surplussAmount }],
                environment: 'production'
              }
            });
            console.log(`[reverse-sync] Returned ${qty} items: set material ${itemType.externalMaterialId} to ${surplussAmount} on Surpluss event ${marketplace.external_id}`);
          } catch (syncErr) {
            console.error('[reverse-sync] Failed to sync return to Surpluss:', syncErr);
          }
        }
      }

      logEvent.mutate({
        allocationId: undoAllocation.id,
        itemTypeId: alloc?.itemTypeId,
        marketplaceId: selectedMarketplaceId || undefined,
        marketplaceName: mp?.name || 'Unknown',
        actionType: 'returned_to_warehouse',
        quantityBefore: undoAllocation.allocated,
        quantityAfter: newAllocated,
        description: `${qty.toLocaleString()} units of ${alloc?.itemName || 'item'} returned to warehouse from ${mp?.name || 'marketplace'}`,
      });

      toast({ title: 'Items Returned', description: `${qty.toLocaleString()} items returned to warehouse pool` });
      setUndoAllocation(null);
      setUndoQuantity('');
    } catch (error) {
      toast({ title: 'Undo Failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  // Handle re-allocate to another marketplace
  const handleReallocate = async () => {
    if (!reallocAllocation || !reallocTargetMarketplace) return;
    const qty = parseInt(reallocQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast({ title: 'Invalid Quantity', description: 'Enter a valid quantity', variant: 'destructive' });
      return;
    }
    const maxMovable = reallocAllocation.allocated - reallocAllocation.distributed;
    if (qty > maxMovable) {
      toast({ title: 'Too Many', description: `Only ${maxMovable} undistributed items can be moved`, variant: 'destructive' });
      return;
    }
    const sourceMp = marketplaces.find(m => m.id === selectedMarketplaceId);
    const targetMp = marketplaces.find(m => m.id === reallocTargetMarketplace);

    try {
      const sourceAlloc = allocations.find(a => a.id === reallocAllocation.id);
      const itemTypeId = sourceAlloc?.itemTypeId;
      if (!itemTypeId) throw new Error('Could not determine item type');

      const newAllocated = reallocAllocation.allocated - qty;
      if (newAllocated <= 0 && reallocAllocation.distributed <= 0) {
        await deleteAllocation.mutateAsync(reallocAllocation.id);
      } else {
        await updateAllocationQuantities.mutateAsync({
          allocationId: reallocAllocation.id,
          allocatedQuantity: newAllocated,
        });
      }
      await allocateToMarketplace.mutateAsync({
        marketplaceId: reallocTargetMarketplace,
        itemTypeId,
        quantity: qty,
      });

      logEvent.mutate({
        allocationId: reallocAllocation.id,
        itemTypeId,
        marketplaceId: selectedMarketplaceId || undefined,
        marketplaceName: sourceMp?.name || 'Unknown',
        actionType: 're-allocated',
        quantityBefore: reallocAllocation.allocated,
        quantityAfter: newAllocated,
        description: `${qty.toLocaleString()} units of ${sourceAlloc?.itemName || 'item'} re-allocated from ${sourceMp?.name || 'source'} to ${targetMp?.name || 'target'}`,
      });

      toast({ title: 'Items Re-allocated', description: `${qty.toLocaleString()} items moved to new marketplace` });
      setReallocAllocation(null);
      setReallocTargetMarketplace('');
      setReallocQuantity('');
    } catch (error) {
      toast({ title: 'Re-allocation Failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const selectedMarketplace = marketplaces.find(m => m.id === selectedMarketplaceId);
  const selectedHasExternalId = selectedMarketplace && (selectedMarketplace as any).external_id;

  // Sync allocations from Surpluss for selected marketplace
  const handleSyncFromSurpluss = async () => {
    if (!selectedMarketplaceId) return;
    setIsSyncingFromSurpluss(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-surpluss-event-allocations', {
        body: { marketplace_id: selectedMarketplaceId, environment: 'production' }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Sync failed');
      toast({
        title: 'Surpluss Sync Complete',
        description: `Synced ${data.synced} allocations (${data.created} created, ${data.updated} updated)`,
      });
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to sync from Surpluss',
        variant: 'destructive',
      });
    } finally {
      setIsSyncingFromSurpluss(false);
    }
  };

  // Calculate totals for selected marketplace
  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedQuantity, 0);
  const totalDistributed = allocations.reduce((sum, a) => sum + a.distributedQuantity, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-3 md:py-4 px-4">
          <div className="flex items-center gap-3 md:gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-bold text-base md:text-lg truncate">Item Allocation</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Allocate Tractor items to marketplaces</p>
            </div>
            {selectedHasExternalId && (
              <Button onClick={handleSyncFromSurpluss} size="sm" variant="outline" className="shrink-0" disabled={isSyncingFromSurpluss}>
                {isSyncingFromSurpluss ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                <span className="hidden sm:inline">Sync Surpluss</span>
              </Button>
            )}
            <Button onClick={() => setShowAllocateModal(true)} size="sm" className="shrink-0">
              <Plus className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Allocate</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Cross-Marketplace Material Lookup */}
        <MaterialBreakdownLookup />

        {/* Marketplace Selector */}
        <div className="mb-6">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Select Marketplace</label>
          <Select value={selectedMarketplaceId} onValueChange={setSelectedMarketplaceId}>
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder="Choose a marketplace..." />
            </SelectTrigger>
            <SelectContent>
              {activeMarketplaces.map(mp => (
                <SelectItem key={mp.id} value={mp.id}>
                  {mp.name}{mp.event_date ? ` (${new Date(mp.event_date).toLocaleDateString()})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedMarketplaceId ? (
          <>
            {/* Summary Stats - Total Quantity Only */}
            <div className="bg-card rounded-xl border border-border p-4 mb-6 shadow-card">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Quantity</p>
                    <p className="text-2xl font-bold">{totalAllocated.toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Distributed / Remaining</p>
                  <p className="text-lg font-semibold">
                    <span className="text-emerald-600">{totalDistributed.toLocaleString()}</span>
                    <span className="text-muted-foreground mx-1">/</span>
                    <span className="text-amber-600">{(totalAllocated - totalDistributed).toLocaleString()}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Allocations Table */}
            <div className="bg-card rounded-xl md:rounded-2xl border border-border shadow-card">
              <div className="p-4 md:p-6 border-b border-border">
                <h2 className="font-display font-bold text-lg">
                  Items for {selectedMarketplace?.name}
                </h2>
              </div>

              {loadingAllocations ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                </div>
              ) : allocations.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No items allocated to this marketplace</p>
                  <p className="text-sm">Click "Allocate" to add items</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material ID</TableHead>
                        <TableHead>Item Name</TableHead>
                        <TableHead className="text-right">Allocated</TableHead>
                        <TableHead className="text-right">Distributed</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allocations.map((alloc) => {
                        const remaining = alloc.allocatedQuantity - alloc.distributedQuantity;
                        const isEditing = editingAllocationId === alloc.id;

                        return (
                          <TableRow key={alloc.id}>
                            {isEditing ? (
                              <>
                                <TableCell className="font-mono text-sm text-muted-foreground">
                                  {alloc.externalMaterialId ?? '—'}
                                </TableCell>
                                <TableCell>{alloc.itemName || 'Unknown'}</TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={editAllocated}
                                    onChange={(e) => setEditAllocated(parseInt(e.target.value) || 0)}
                                    className="w-24 ml-auto text-right"
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  <Input
                                    type="number"
                                    min={0}
                                    max={editAllocated}
                                    value={editDistributed}
                                    onChange={(e) => setEditDistributed(parseInt(e.target.value) || 0)}
                                    className="w-24 ml-auto text-right"
                                  />
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {(editAllocated - editDistributed).toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex gap-1 justify-end">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={handleCancelEdit}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="default"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={handleSaveEdit}
                                      disabled={updateAllocationQuantities.isPending}
                                    >
                                      {updateAllocationQuantities.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Check className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </div>
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell className="font-mono text-sm text-muted-foreground">
                                  {alloc.externalMaterialId ?? '—'}
                                </TableCell>
                                <TableCell className="font-medium">{alloc.itemName || 'Unknown'}</TableCell>
                                <TableCell className="text-right">{alloc.allocatedQuantity.toLocaleString()}</TableCell>
                                <TableCell className="text-right text-emerald-600">{alloc.distributedQuantity.toLocaleString()}</TableCell>
                                <TableCell className={`text-right font-medium ${remaining < 0 ? 'text-destructive' : 'text-amber-600'}`}>
                                  {remaining.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex gap-1 justify-end">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                                      onClick={() => handleStartEdit(alloc)}
                                      title="Edit"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
                                      onClick={() => setDistributeAllocation({
                                        id: alloc.id,
                                        itemName: alloc.itemName || 'Unknown',
                                        allocated: alloc.allocatedQuantity,
                                        distributed: alloc.distributedQuantity,
                                      })}
                                      disabled={remaining <= 0}
                                      title="Distribute"
                                    >
                                      <Send className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-amber-600"
                                      onClick={() => {
                                        const maxReturnable = alloc.allocatedQuantity - alloc.distributedQuantity;
                                        setUndoAllocation({ id: alloc.id, allocated: alloc.allocatedQuantity, distributed: alloc.distributedQuantity });
                                        setUndoQuantity(maxReturnable > 0 ? String(maxReturnable) : '');
                                      }}
                                      disabled={remaining <= 0}
                                      title="Return to Warehouse"
                                    >
                                      <Undo2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                                      onClick={() => {
                                        const maxMovable = alloc.allocatedQuantity - alloc.distributedQuantity;
                                        setReallocAllocation({ id: alloc.id, allocated: alloc.allocatedQuantity, distributed: alloc.distributedQuantity });
                                        setReallocQuantity(maxMovable > 0 ? String(maxMovable) : '');
                                      }}
                                      disabled={remaining <= 0}
                                      title="Re-allocate"
                                    >
                                      <ArrowRightLeft className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                      onClick={() => handleDelete(alloc.id)}
                                      disabled={deleteAllocation.isPending}
                                      title="Delete"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Select a marketplace to view allocations</p>
          </div>
        )}
      </main>

      {/* Allocate Modal - Select item by ID */}
      <Dialog open={showAllocateModal} onOpenChange={setShowAllocateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Allocate Items</DialogTitle>
            <DialogDescription>
              Assign items to a marketplace by item ID
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Marketplace Selection */}
            <div className="space-y-2">
              <Label>Marketplace</Label>
              <Select 
                value={modalMarketplaceId || selectedMarketplaceId} 
                onValueChange={setModalMarketplaceId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select marketplace..." />
                </SelectTrigger>
                <SelectContent>
                  {activeMarketplaces.map(mp => (
                    <SelectItem key={mp.id} value={mp.id}>
                      {mp.name}{mp.event_date ? ` (${new Date(mp.event_date).toLocaleDateString()})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Item Selection - Searchable */}
            <div className="space-y-2">
              <Label>Item</Label>
              <Popover open={itemComboOpen} onOpenChange={setItemComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={itemComboOpen}
                    className="w-full justify-between font-normal"
                  >
                    {modalItemTypeId
                      ? (() => {
                          const item = itemTypes.find(i => i.id === modalItemTypeId);
                          return item
                            ? `${item.externalMaterialId ? item.externalMaterialId + ' — ' : ''}${item.name}`
                            : 'Select item...';
                        })()
                      : 'Select item...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by name or material ID..." />
                    <CommandList>
                      <CommandEmpty>No items found.</CommandEmpty>
                      <CommandGroup>
                        {[...allocatableItems, ...itemTypes.filter(item => item.externalMaterialId == null)].map(item => (
                          <CommandItem
                            key={item.id}
                            value={`${item.externalMaterialId || ''} ${item.name} ${item.category || ''}`}
                            onSelect={() => {
                              setModalItemTypeId(item.id);
                              setItemComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                modalItemTypeId === item.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{item.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {item.externalMaterialId ? `ID: ${item.externalMaterialId}` : 'No Material ID'}
                                {item.category ? ` · ${item.category}` : ''}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Selected item info */}
            {modalItemTypeId && (() => {
              const selectedItem = itemTypes.find(i => i.id === modalItemTypeId);
              if (!selectedItem) return null;
              const remaining = selectedItem.totalStock - selectedItem.distributed;
              return (
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-sm">
                  <p className="font-semibold text-foreground">Current Material:</p>
                  <p><span className="font-semibold">Title:</span> {selectedItem.name}</p>
                  <p><span className="font-semibold">Category:</span> {selectedItem.category || 'Uncategorized'}</p>
                  <p><span className="font-semibold">Total Items:</span> {selectedItem.totalStock.toLocaleString()}</p>
                  <p>
                    <span className="font-semibold">Remaining:</span>{' '}
                    <span className={remaining > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>{remaining.toLocaleString()}</span>
                  </p>
                </div>
              );
            })()}

            {/* Quantity */}
            <div className="space-y-2">
              <Label>Quantity to Allocate</Label>
              <Input
                type="number"
                placeholder="Enter quantity..."
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={1}
              />
              <p className="text-xs text-muted-foreground">
                This will add to any existing allocation for the selected item and marketplace
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowAllocateModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAllocate} 
              disabled={allocateToMarketplace.isPending || !(modalMarketplaceId || selectedMarketplaceId) || !modalItemTypeId || !quantity}
            >
              {allocateToMarketplace.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Allocate Items
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Distribute Confirmation Modal */}
      <Dialog open={!!distributeAllocation} onOpenChange={(open) => { if (!open) setDistributeAllocation(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Send className="w-5 h-5" /> Confirm Distribution
            </DialogTitle>
            <DialogDescription>
              Mark 1 unit as distributed
            </DialogDescription>
          </DialogHeader>
          {distributeAllocation && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Item</span>
                  <span className="font-medium">{distributeAllocation.itemName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Currently Distributed</span>
                  <span className="font-medium">{distributeAllocation.distributed.toLocaleString()} / {distributeAllocation.allocated.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-border pt-1 mt-1">
                  <span className="text-muted-foreground">After Distribution</span>
                  <span className="font-semibold text-emerald-600">{(distributeAllocation.distributed + 1).toLocaleString()} / {distributeAllocation.allocated.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDistributeAllocation(null)}>Cancel</Button>
            <Button onClick={handleDistribute} disabled={incrementDistributed.isPending}>
              {incrementDistributed.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Distribute
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Undo / Return to Warehouse Modal */}
      <Dialog open={!!undoAllocation} onOpenChange={(open) => { if (!open) { setUndoAllocation(null); setUndoQuantity(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <Undo2 className="w-5 h-5" /> Return to Warehouse
            </DialogTitle>
            <DialogDescription>
              Return undistributed items back to the unallocated warehouse pool
            </DialogDescription>
          </DialogHeader>
          {undoAllocation && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Currently Allocated</span>
                  <span className="font-medium">{undoAllocation.allocated.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Already Distributed</span>
                  <span className="font-medium">{undoAllocation.distributed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-border pt-1 mt-1">
                  <span className="text-muted-foreground">Max Returnable</span>
                  <span className="font-semibold text-primary">{(undoAllocation.allocated - undoAllocation.distributed).toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Quantity to Return</Label>
                <Input
                  type="number"
                  value={undoQuantity}
                  onChange={(e) => setUndoQuantity(e.target.value)}
                  min={1}
                  max={undoAllocation.allocated - undoAllocation.distributed}
                />
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setUndoAllocation(null); setUndoQuantity(''); }}>Cancel</Button>
            <Button variant="warning" onClick={handleUndo} disabled={updateAllocationQuantities.isPending || deleteAllocation.isPending}>
              {(updateAllocationQuantities.isPending || deleteAllocation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Return Items
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Re-allocate Modal */}
      <Dialog open={!!reallocAllocation} onOpenChange={(open) => { if (!open) { setReallocAllocation(null); setReallocTargetMarketplace(''); setReallocQuantity(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" /> Re-allocate Items
            </DialogTitle>
            <DialogDescription>
              Move undistributed items from this marketplace to another
            </DialogDescription>
          </DialogHeader>
          {reallocAllocation && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-muted rounded-lg space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Currently Allocated</span>
                  <span className="font-medium">{reallocAllocation.allocated.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Already Distributed</span>
                  <span className="font-medium">{reallocAllocation.distributed.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-border pt-1 mt-1">
                  <span className="text-muted-foreground">Max Movable</span>
                  <span className="font-semibold text-primary">{(reallocAllocation.allocated - reallocAllocation.distributed).toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Target Marketplace</Label>
                <Select value={reallocTargetMarketplace} onValueChange={setReallocTargetMarketplace}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select target marketplace..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeMarketplaces
                      .filter(mp => mp.id !== selectedMarketplaceId)
                      .map(mp => (
                        <SelectItem key={mp.id} value={mp.id}>
                          {mp.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity to Move</Label>
                <Input
                  type="number"
                  value={reallocQuantity}
                  onChange={(e) => setReallocQuantity(e.target.value)}
                  min={1}
                  max={reallocAllocation.allocated - reallocAllocation.distributed}
                />
              </div>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setReallocAllocation(null); setReallocTargetMarketplace(''); setReallocQuantity(''); }}>Cancel</Button>
            <Button onClick={handleReallocate} disabled={allocateToMarketplace.isPending || updateAllocationQuantities.isPending || !reallocTargetMarketplace}>
              {(allocateToMarketplace.isPending || updateAllocationQuantities.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Move Items
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
