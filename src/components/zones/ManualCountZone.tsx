import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Save, Package, AlertCircle, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [counts, setCounts] = useState<Record<string, number>>({});
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

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    allocations.forEach(a => {
      if (a.category) cats.add(a.category);
    });
    return Array.from(cats).sort();
  }, [allocations]);

  // Extract subcategories (derived from item names - first word or prefix before dash/colon)
  const subcategories = useMemo(() => {
    if (!selectedCategory) return [];
    
    const subs = new Set<string>();
    allocations
      .filter(a => a.category === selectedCategory)
      .forEach(a => {
        // Try to extract subcategory from item name
        const name = a.item_name;
        const match = name.match(/^([^-:]+)[-:]/);
        if (match) {
          subs.add(match[1].trim());
        } else {
          // Use first two words as subcategory if no delimiter
          const words = name.split(' ').slice(0, 2).join(' ');
          subs.add(words);
        }
      });
    return Array.from(subs).sort();
  }, [allocations, selectedCategory]);

  // Filter allocations based on selected category and subcategory
  // Only show items after a category is selected
  const filteredAllocations = useMemo(() => {
    if (!selectedCategory) return [];
    
    let filtered = allocations.filter(a => a.category === selectedCategory);
    
    if (selectedSubcategory) {
      filtered = filtered.filter(a => {
        const name = a.item_name;
        return name.startsWith(selectedSubcategory) || name.includes(selectedSubcategory);
      });
    }
    
    return filtered;
  }, [allocations, selectedCategory, selectedSubcategory]);

  // Reset subcategory when category changes
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedSubcategory('');
  };

  // Initialize counts from existing data
  useMemo(() => {
    if (existingCounts.length > 0 && allocations.length > 0) {
      const initialCounts: Record<string, number> = {};
      
      existingCounts.forEach((count: any) => {
        initialCounts[count.item_type_id] = count.actual_remaining;
      });
      
      setCounts(initialCounts);
    }
  }, [existingCounts, allocations]);

  const handleCountChange = (itemTypeId: string, value: number) => {
    setCounts(prev => ({
      ...prev,
      [itemTypeId]: value,
    }));
  };

  const handleSaveAll = async () => {
    if (!selectedMarketplaceId) return;
    
    setIsSaving(true);
    try {
      const allocationMap = new Map(allocations.map(a => [a.item_type_id, a.id]));
      const allocationDistMap = new Map(allocations.map(a => [a.item_type_id, a.distributed_quantity]));
      
      for (const [itemTypeId, remaining] of Object.entries(counts)) {
        await saveCount.mutateAsync({
          marketplace_id: selectedMarketplaceId,
          item_type_id: itemTypeId,
          allocation_id: allocationMap.get(itemTypeId) || null,
          actual_distributed: allocationDistMap.get(itemTypeId) || 0,
          actual_remaining: remaining,
          notes: null,
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

        {/* Category & Subcategory Filters */}
        {selectedMarketplaceId && allocations.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {/* Category Dropdown */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Category</Label>
              <Select
                value={selectedCategory}
                onValueChange={(value) => handleCategoryChange(value === 'all' ? '' : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background">
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subcategory Dropdown */}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Subcategory</Label>
              <Select
                value={selectedSubcategory || 'all'}
                onValueChange={(value) => setSelectedSubcategory(value === 'all' ? '' : value)}
                disabled={!selectedCategory}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All subcategories" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-background">
                  <SelectItem value="all">All subcategories</SelectItem>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub} value={sub}>
                      {sub}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

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

        {/* Filtered Items List */}
        {filteredAllocations.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4" />
                {selectedCategory || 'All Items'}
                {selectedSubcategory && ` / ${selectedSubcategory}`}
                <Badge variant="secondary" className="ml-auto">
                  {filteredAllocations.length} item{filteredAllocations.length !== 1 ? 's' : ''}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredAllocations.map(item => {
                const currentCount = counts[item.item_type_id];
                const systemDistributed = item.distributed_quantity;
                const systemAllocated = item.allocated_quantity;
                
                return (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-muted/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{item.item_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {systemDistributed} / {systemAllocated}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">
                        Remaining:
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={currentCount ?? ''}
                        onChange={(e) => handleCountChange(
                          item.item_type_id,
                          parseInt(e.target.value) || 0
                        )}
                        placeholder="0"
                        className="h-9"
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* No Results After Filtering */}
        {selectedMarketplaceId && !loadingAllocations && allocations.length > 0 && filteredAllocations.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">
                No items match the selected filters.
              </p>
            </CardContent>
          </Card>
        )}

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