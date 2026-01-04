import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Package, 
  Plus, 
  Loader2, 
  Trash2, 
  MapPin,
  Calendar
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
import { useItemTypes, useMarketplaces } from '@/hooks/useSupabaseData';
import { useMarketplaceAllocations, useAllocationOperations } from '@/hooks/useMarketplaceAllocations';
import { useToast } from '@/hooks/use-toast';

interface AllocationManagementProps {
  onBack: () => void;
}

export const AllocationManagement = ({ onBack }: AllocationManagementProps) => {
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState('');

  const { data: itemTypes = [], isLoading: loadingItems } = useItemTypes();
  const { data: marketplaces = [], isLoading: loadingMarketplaces } = useMarketplaces();
  const { data: allocations = [], isLoading: loadingAllocations } = useMarketplaceAllocations(
    selectedMarketplaceId || undefined
  );
  const { allocateToMarketplace, deleteAllocation } = useAllocationOperations();
  const { toast } = useToast();

  const activeMarketplaces = marketplaces.filter(m => m.status === 'active' || m.status === 'upcoming');

  const handleAllocate = async () => {
    if (!selectedMarketplaceId || !selectedItemId || !quantity) {
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
      await allocateToMarketplace.mutateAsync({
        marketplaceId: selectedMarketplaceId,
        itemTypeId: selectedItemId,
        quantity: qty,
      });
      toast({
        title: 'Items Allocated',
        description: `${qty} items allocated to marketplace`,
      });
      setShowAllocateModal(false);
      setSelectedItemId('');
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

    try {
      await deleteAllocation.mutateAsync(allocationId);
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

  const selectedMarketplace = marketplaces.find(m => m.id === selectedMarketplaceId);
  const selectedItem = itemTypes.find(i => i.id === selectedItemId);
  const availableStock = selectedItem ? selectedItem.totalStock - selectedItem.distributed : 0;

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
              <p className="text-xs md:text-sm text-muted-foreground">Allocate items to marketplaces</p>
            </div>
            <Button onClick={() => setShowAllocateModal(true)} size="sm" className="shrink-0">
              <Plus className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Allocate</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
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
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {mp.name}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      mp.status === 'active' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'
                    }`}>
                      {mp.status}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedMarketplaceId ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
              <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalAllocated.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Allocated</p>
                  </div>
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalDistributed.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Distributed</p>
                  </div>
                </div>
              </div>
              <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{(totalAllocated - totalDistributed).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Remaining</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Allocations List */}
            <div className="bg-card rounded-xl md:rounded-2xl border border-border shadow-card">
              <div className="p-4 md:p-6 border-b border-border">
                <h2 className="font-display font-bold text-lg">
                  Allocations for {selectedMarketplace?.name}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {allocations.length} item types allocated
                </p>
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
                <div className="divide-y divide-border">
                  {allocations.map((alloc, index) => (
                    <motion.div
                      key={alloc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-4 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center shrink-0 text-xl">
                          {alloc.itemIcon || '📦'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{alloc.itemName || 'Unknown Item'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden w-32">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${alloc.allocatedQuantity > 0 ? (alloc.distributedQuantity / alloc.allocatedQuantity) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {alloc.distributedQuantity}/{alloc.allocatedQuantity}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right mr-2">
                          <p className="text-sm font-semibold text-amber-600">
                            {alloc.allocatedQuantity - alloc.distributedQuantity}
                          </p>
                          <p className="text-xs text-muted-foreground">remaining</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(alloc.id)}
                          disabled={deleteAllocation.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
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

      {/* Allocate Modal */}
      <Dialog open={showAllocateModal} onOpenChange={setShowAllocateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Allocate Items</DialogTitle>
            <DialogDescription>
              Allocate inventory items to a marketplace
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Marketplace Selection */}
            <div className="space-y-2">
              <Label>Marketplace</Label>
              <Select value={selectedMarketplaceId} onValueChange={setSelectedMarketplaceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select marketplace..." />
                </SelectTrigger>
                <SelectContent>
                  {activeMarketplaces.map(mp => (
                    <SelectItem key={mp.id} value={mp.id}>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {mp.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Item Selection */}
            <div className="space-y-2">
              <Label>Item Type</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select item..." />
                </SelectTrigger>
                <SelectContent>
                  {itemTypes.map(item => (
                    <SelectItem key={item.id} value={item.id}>
                      <div className="flex items-center gap-2">
                        <span>{item.icon}</span>
                        {item.name}
                        <span className="text-muted-foreground text-xs">
                          ({(item.totalStock - item.distributed).toLocaleString()} available)
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedItem && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="text-muted-foreground">
                  Available: <span className="font-semibold text-foreground">{availableStock.toLocaleString()}</span> of {selectedItem.totalStock.toLocaleString()}
                </p>
              </div>
            )}

            {/* Quantity */}
            <div className="space-y-2">
              <Label>Quantity to Allocate</Label>
              <Input
                type="number"
                placeholder="Enter quantity..."
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={1}
                max={availableStock}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowAllocateModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAllocate} 
              disabled={allocateToMarketplace.isPending || !selectedMarketplaceId || !selectedItemId || !quantity}
            >
              {allocateToMarketplace.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Allocate Items
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
