import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Save, Check, Package, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useMarketplaces } from '@/hooks/useSupabaseData';
import { useManualCounts, useManualCountOperations } from '@/hooks/useManualCounts';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface ItemAllocation {
  id: string;
  item_type_id: string;
  item_name: string;
  category: string | null;
  allocated_quantity: number;
  distributed_quantity: number;
}

export const ManualCountZone = () => {
  const { toast } = useToast();
  const { data: marketplaces = [], isLoading: loadingMarketplaces } = useMarketplaces();
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string>('');
  const [counts, setCounts] = useState<Record<string, { distributed: number; remaining: number; notes: string }>>({});
  const [isSaving, setIsSaving] = useState(false);

  const { data: existingCounts = [], isLoading: loadingCounts } = useManualCounts(selectedMarketplaceId);
  const { saveCount } = useManualCountOperations();

  // Fetch allocations for selected marketplace
  const { data: allocations = [], isLoading: loadingAllocations } = useQuery({
    queryKey: ['marketplace_allocations_with_items', selectedMarketplaceId],
    queryFn: async () => {
      if (!selectedMarketplaceId) return [];
      
      const { data, error } = await supabase
        .from('marketplace_item_allocations')
        .select(`
          id,
          item_type_id,
          allocated_quantity,
          distributed_quantity,
          item_types (
            name,
            category
          )
        `)
        .eq('marketplace_id', selectedMarketplaceId);

      if (error) throw error;

      return (data || []).map((a: any) => ({
        id: a.id,
        item_type_id: a.item_type_id,
        item_name: a.item_types?.name || 'Unknown Item',
        category: a.item_types?.category || null,
        allocated_quantity: a.allocated_quantity,
        distributed_quantity: a.distributed_quantity,
      })) as ItemAllocation[];
    },
    enabled: !!selectedMarketplaceId,
  });

  // Group allocations by category
  const groupedAllocations = useMemo(() => {
    const groups: Record<string, ItemAllocation[]> = {};
    
    allocations.forEach(allocation => {
      const category = allocation.category || 'Uncategorized';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(allocation);
    });

    return groups;
  }, [allocations]);

  // Initialize counts from existing data
  useMemo(() => {
    if (existingCounts.length > 0 && allocations.length > 0) {
      const initialCounts: Record<string, { distributed: number; remaining: number; notes: string }> = {};
      
      existingCounts.forEach((count: any) => {
        initialCounts[count.item_type_id] = {
          distributed: count.actual_distributed,
          remaining: count.actual_remaining,
          notes: count.notes || '',
        };
      });
      
      setCounts(initialCounts);
    }
  }, [existingCounts, allocations]);

  const handleCountChange = (itemTypeId: string, field: 'distributed' | 'remaining', value: number) => {
    setCounts(prev => ({
      ...prev,
      [itemTypeId]: {
        ...prev[itemTypeId],
        distributed: prev[itemTypeId]?.distributed || 0,
        remaining: prev[itemTypeId]?.remaining || 0,
        notes: prev[itemTypeId]?.notes || '',
        [field]: value,
      },
    }));
  };

  const handleNotesChange = (itemTypeId: string, notes: string) => {
    setCounts(prev => ({
      ...prev,
      [itemTypeId]: {
        ...prev[itemTypeId],
        distributed: prev[itemTypeId]?.distributed || 0,
        remaining: prev[itemTypeId]?.remaining || 0,
        notes,
      },
    }));
  };

  const handleSaveAll = async () => {
    if (!selectedMarketplaceId) return;
    
    setIsSaving(true);
    try {
      const allocationMap = new Map(allocations.map(a => [a.item_type_id, a.id]));
      
      for (const [itemTypeId, countData] of Object.entries(counts)) {
        await saveCount.mutateAsync({
          marketplace_id: selectedMarketplaceId,
          item_type_id: itemTypeId,
          allocation_id: allocationMap.get(itemTypeId) || null,
          actual_distributed: countData.distributed,
          actual_remaining: countData.remaining,
          notes: countData.notes || null,
        });
      }
      
      toast({
        title: 'Counts Saved',
        description: 'Manual item counts have been saved successfully.',
      });
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: 'Failed to save manual counts. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedMarketplace = marketplaces.find(m => m.id === selectedMarketplaceId);
  const hasChanges = Object.keys(counts).length > 0;

  return (
    <div className="p-4 space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">Manual Item Count</h2>
            <p className="text-sm text-muted-foreground">
              Enter actual counts after marketplace ends
            </p>
          </div>
        </div>

        {/* Marketplace Selector */}
        <Card>
          <CardContent className="pt-4">
            <Label className="text-sm font-medium mb-2 block">Select Marketplace</Label>
            <Select
              value={selectedMarketplaceId}
              onValueChange={setSelectedMarketplaceId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a marketplace event..." />
              </SelectTrigger>
              <SelectContent>
                {marketplaces.map(mp => (
                  <SelectItem key={mp.id} value={mp.id}>
                    <div className="flex items-center gap-2">
                      <span>{mp.name}</span>
                      {mp.event_date && (
                        <Badge variant="outline" className="text-xs">
                          {new Date(mp.event_date).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Loading State */}
        {(loadingAllocations || loadingCounts) && selectedMarketplaceId && (
          <div className="text-center py-8 text-muted-foreground">
            Loading allocations...
          </div>
        )}

        {/* No Allocations */}
        {selectedMarketplaceId && !loadingAllocations && allocations.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">
                No item allocations found for this marketplace.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Item Count Forms by Category */}
        {Object.entries(groupedAllocations).map(([category, items]) => (
          <Card key={category}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4" />
                {category}
                <Badge variant="secondary" className="ml-auto">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map(item => {
                const currentCount = counts[item.item_type_id];
                const systemDistributed = item.distributed_quantity;
                const systemAllocated = item.allocated_quantity;
                
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-muted/50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.item_name}</span>
                      <div className="text-xs text-muted-foreground">
                        System: {systemDistributed} / {systemAllocated}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Actual Distributed
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={currentCount?.distributed ?? ''}
                          onChange={(e) => handleCountChange(
                            item.item_type_id,
                            'distributed',
                            parseInt(e.target.value) || 0
                          )}
                          placeholder={String(systemDistributed)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Actual Remaining
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          value={currentCount?.remaining ?? ''}
                          onChange={(e) => handleCountChange(
                            item.item_type_id,
                            'remaining',
                            parseInt(e.target.value) || 0
                          )}
                          placeholder="0"
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                      <Textarea
                        value={currentCount?.notes ?? ''}
                        onChange={(e) => handleNotesChange(item.item_type_id, e.target.value)}
                        placeholder="Any discrepancies or observations..."
                        className="mt-1 h-16 resize-none"
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}

        {/* Save Button */}
        {selectedMarketplaceId && allocations.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="sticky bottom-20 z-10"
          >
            <Button
              onClick={handleSaveAll}
              disabled={isSaving || !hasChanges}
              className="w-full h-12 text-base font-semibold shadow-lg"
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save All Counts
                </>
              )}
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
