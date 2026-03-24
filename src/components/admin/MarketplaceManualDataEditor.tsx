import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Package, Save, Edit2, X, Plus, Trash2, Loader2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useMarketplaceAllocations, useAllocationOperations } from '@/hooks/useMarketplaceAllocations';
import { useItemTypesExtended } from '@/hooks/useItemTypesExtended';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface MarketplaceManualDataEditorProps {
  marketplaceId: string;
  marketplaceName: string;
}

interface EditableRow {
  id: string | null; // null = new row
  itemTypeId: string;
  itemName: string;
  category: string | null;
  subcategory: string | null;
  allocatedQuantity: number;
  distributedQuantity: number;
  isNew?: boolean;
}

export const MarketplaceManualDataEditor = ({
  marketplaceId,
  marketplaceName,
}: MarketplaceManualDataEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [manualBeneficiaryCount, setManualBeneficiaryCount] = useState<number | null>(null);
  const [editBeneficiaryCount, setEditBeneficiaryCount] = useState<number | null>(null);
  const [editableRows, setEditableRows] = useState<EditableRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [isLoadingBeneficiary, setIsLoadingBeneficiary] = useState(true);
  const [addItemOpen, setAddItemOpen] = useState(false);

  const { data: allocations = [], isLoading: loadingAllocations } = useMarketplaceAllocations(marketplaceId);
  const { data: allItemTypes = [] } = useItemTypesExtended();
  const { allocateToMarketplace, updateAllocationQuantities, deleteAllocation } = useAllocationOperations();
  const queryClient = useQueryClient();

  // Load manual_beneficiary_count
  useEffect(() => {
    const load = async () => {
      setIsLoadingBeneficiary(true);
      const { data } = await supabase
        .from('marketplace_events')
        .select('manual_beneficiary_count')
        .eq('id', marketplaceId)
        .single();
      setManualBeneficiaryCount((data as any)?.manual_beneficiary_count ?? null);
      setIsLoadingBeneficiary(false);
    };
    load();
  }, [marketplaceId]);

  const hasData = manualBeneficiaryCount !== null || allocations.length > 0;

  const startEditing = () => {
    setEditBeneficiaryCount(manualBeneficiaryCount);
    setEditableRows(
      allocations.map(a => ({
        id: a.id,
        itemTypeId: a.itemTypeId,
        itemName: a.itemName || 'Unknown',
        category: null,
        subcategory: null,
        allocatedQuantity: a.allocatedQuantity,
        distributedQuantity: a.distributedQuantity,
      }))
    );
    setDeletedIds([]);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditableRows([]);
    setDeletedIds([]);
  };

  const addItem = (itemTypeId: string) => {
    const item = allItemTypes.find(i => i.id === itemTypeId);
    if (!item) return;
    // Check if already in rows
    if (editableRows.some(r => r.itemTypeId === itemTypeId)) {
      toast.error('Item already added');
      return;
    }
    setEditableRows(prev => [
      ...prev,
      {
        id: null,
        itemTypeId: item.id,
        itemName: item.name,
        category: item.category,
        subcategory: item.subcategory,
        allocatedQuantity: 0,
        distributedQuantity: 0,
        isNew: true,
      },
    ]);
    setAddItemOpen(false);
  };

  const removeRow = (index: number) => {
    const row = editableRows[index];
    if (row.id) {
      setDeletedIds(prev => [...prev, row.id!]);
    }
    setEditableRows(prev => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: 'allocatedQuantity' | 'distributedQuantity', value: number) => {
    setEditableRows(prev =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save beneficiary count
      const { error: bErr } = await supabase
        .from('marketplace_events')
        .update({ manual_beneficiary_count: editBeneficiaryCount } as any)
        .eq('id', marketplaceId);
      if (bErr) throw bErr;

      // Delete removed allocations + reverse sync to Surpluss
      if (deletedIds.length > 0) {
        // Look up marketplace external_id for Surpluss sync
        const { data: mpData } = await supabase
          .from('marketplace_events')
          .select('external_id')
          .eq('id', marketplaceId)
          .single();
        const marketplaceExternalId = mpData?.external_id;

        // Look up external_material_ids for deleted allocations
        const { data: deletedAllocData } = await supabase
          .from('marketplace_item_allocations')
          .select('id, item_type_id')
          .in('id', deletedIds);

        const itemTypeIds = deletedAllocData?.map(a => a.item_type_id).filter(Boolean) || [];
        let materialIdMap: Record<string, number> = {};
        if (itemTypeIds.length > 0) {
          const { data: itemTypesData } = await supabase
            .from('item_types')
            .select('id, external_material_id')
            .in('id', itemTypeIds);
          materialIdMap = Object.fromEntries(
            (itemTypesData || [])
              .filter(it => it.external_material_id != null)
              .map(it => [it.id, it.external_material_id!])
          );
        }

        // Delete from GIF
        for (const id of deletedIds) {
          await deleteAllocation.mutateAsync(id);
        }

        // Reverse sync: set deleted materials to 0 on Surpluss
        if (marketplaceExternalId) {
          const materialsToSync = (deletedAllocData || [])
            .filter(a => materialIdMap[a.item_type_id])
            .map(a => ({ material_id: materialIdMap[a.item_type_id], amount: 0 }));

          if (materialsToSync.length > 0) {
            try {
              await supabase.functions.invoke('surpluss-allocations-api', {
                body: {
                  action: 'batch_update',
                  marketplace_event_id: marketplaceExternalId,
                  materials: materialsToSync,
                  environment: 'production',
                },
              });
              console.log(`[reverse-sync] Set ${materialsToSync.length} materials to 0 on Surpluss event ${marketplaceExternalId}`);
            } catch (syncErr) {
              console.error('[reverse-sync] Failed to sync deletions to Surpluss:', syncErr);
            }
          }
        }
      }

      // Process rows
      for (const row of editableRows) {
        if (row.isNew || !row.id) {
          // Create new allocation
          await allocateToMarketplace.mutateAsync({
            marketplaceId,
            itemTypeId: row.itemTypeId,
            quantity: row.allocatedQuantity,
          });
          // Then set distributed if > 0
          if (row.distributedQuantity > 0) {
            // Find the newly created allocation
            const { data: newAlloc } = await supabase
              .from('marketplace_item_allocations')
              .select('id')
              .eq('marketplace_id', marketplaceId)
              .eq('item_type_id', row.itemTypeId)
              .maybeSingle();
            if (newAlloc) {
              await updateAllocationQuantities.mutateAsync({
                allocationId: newAlloc.id,
                allocatedQuantity: row.allocatedQuantity,
                distributedQuantity: row.distributedQuantity,
              });
            }
          }
        } else {
          // Update existing
          await updateAllocationQuantities.mutateAsync({
            allocationId: row.id,
            allocatedQuantity: row.allocatedQuantity,
            distributedQuantity: row.distributedQuantity,
          });
        }
      }

      setManualBeneficiaryCount(editBeneficiaryCount);
      queryClient.invalidateQueries({ queryKey: ['marketplace_report', marketplaceId] });
      toast.success('Marketplace data saved successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving marketplace data:', error);
      toast.error('Failed to save marketplace data');
    } finally {
      setIsSaving(false);
    }
  };

  // Items available to add (not already in rows)
  const availableItems = useMemo(() => {
    const usedIds = new Set(editableRows.map(r => r.itemTypeId));
    return allItemTypes.filter(i => !usedIds.has(i.id));
  }, [allItemTypes, editableRows]);

  // Compute totals for view mode
  const totalAllocated = allocations.reduce((s, a) => s + a.allocatedQuantity, 0);
  const totalDistributed = allocations.reduce((s, a) => s + a.distributedQuantity, 0);

  if (isLoadingBeneficiary || loadingAllocations) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Package className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg">Marketplace Data</h3>
            <p className="text-sm text-foreground/80">{marketplaceName}</p>
          </div>
        </div>

        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={startEditing}>
            <Edit2 className="w-4 h-4 mr-2" />
            {hasData ? 'Edit' : 'Add Data'}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={cancelEditing}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="p-4 md:p-6">
        {!isEditing ? (
          // View Mode
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Users className="w-5 h-5 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold">{manualBeneficiaryCount ?? '—'}</p>
                <p className="text-xs text-muted-foreground">Beneficiaries (Manual)</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{totalAllocated}</p>
                <p className="text-xs text-muted-foreground">Total Allocated</p>
              </div>
              <div className="bg-emerald-500/10 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-emerald-600">{totalDistributed}</p>
                <p className="text-xs text-muted-foreground">Total Distributed</p>
              </div>
            </div>

            {/* Item breakdown table */}
            {allocations.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-[40%]" />
                    <col className="w-[20%]" />
                    <col className="w-[20%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</th>
                      <th className="text-center py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Allocated</th>
                      <th className="text-center py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Distributed</th>
                      <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocations.map(a => (
                      <tr key={a.id} className="border-b border-border/50 last:border-0">
                        <td className="py-3 px-4 font-medium">{a.itemName}</td>
                        <td className="py-3 px-4 text-center text-muted-foreground">{a.allocatedQuantity.toLocaleString()}</td>
                        <td className="py-3 px-4 text-center text-muted-foreground">{a.distributedQuantity.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right font-semibold text-primary">{(a.allocatedQuantity - a.distributedQuantity).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : !hasData ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No marketplace data entered yet.</p>
                <p className="text-sm">Click "Add Data" to enter item allocations and beneficiary counts.</p>
              </div>
            ) : null}
          </motion.div>
        ) : (
          // Edit Mode
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Manual Beneficiary Count */}
            <div>
              <Label htmlFor="manual-beneficiary-count" className="font-semibold flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-purple-500" />
                Manual Beneficiary Count
              </Label>
              <Input
                id="manual-beneficiary-count"
                type="number"
                min="0"
                placeholder="Enter total beneficiaries"
                value={editBeneficiaryCount ?? ''}
                onChange={(e) => setEditBeneficiaryCount(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full md:w-64"
              />
            </div>

            {/* Item Allocations */}
            <div>
              <Label className="font-semibold mb-2 block">Item Allocations</Label>
              {editableRows.length > 0 && (
                <div className="overflow-x-auto border border-border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase">Item</th>
                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase w-32">Allocated</th>
                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase w-32">Distributed</th>
                        <th className="w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editableRows.map((row, index) => (
                        <tr key={row.itemTypeId} className="border-b border-border/50 last:border-0">
                          <td className="py-2 px-3 font-medium">{row.itemName}</td>
                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              min="0"
                              value={row.allocatedQuantity}
                              onChange={(e) => updateRow(index, 'allocatedQuantity', parseInt(e.target.value) || 0)}
                              className="w-full text-center h-8"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              type="number"
                              min="0"
                              value={row.distributedQuantity}
                              onChange={(e) => updateRow(index, 'distributedQuantity', parseInt(e.target.value) || 0)}
                              className="w-full text-center h-8"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeRow(index)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add Item */}
              <Popover open={addItemOpen} onOpenChange={setAddItemOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="mt-3 gap-2">
                    <Plus className="w-4 h-4" /> Add Item
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search items..." />
                    <CommandList>
                      <CommandEmpty>No items found.</CommandEmpty>
                      <CommandGroup>
                        {availableItems.map(item => (
                          <CommandItem
                            key={item.id}
                            value={`${item.name} ${item.externalMaterialId || ''} ${item.category || ''}`}
                            onSelect={() => addItem(item.id)}
                          >
                            <span>{item.name}</span>
                            {item.externalMaterialId && (
                              <span className="ml-auto text-xs text-muted-foreground">#{item.externalMaterialId}</span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
