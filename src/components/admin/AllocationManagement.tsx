import { useState } from 'react';
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
  X
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
  const [modalMarketplaceId, setModalMarketplaceId] = useState<string>('');
  const [quantity, setQuantity] = useState('');

  // Inline editing state
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null);
  const [editAllocated, setEditAllocated] = useState<number>(0);
  const [editDistributed, setEditDistributed] = useState<number>(0);

  const { data: itemTypes = [], isLoading: loadingItems } = useItemTypes();
  const { data: marketplaces = [], isLoading: loadingMarketplaces } = useMarketplaces();
  const { data: allocations = [], isLoading: loadingAllocations } = useMarketplaceAllocations(
    selectedMarketplaceId || undefined
  );
  const { allocateToMarketplace, deleteAllocation, updateAllocationQuantities } = useAllocationOperations();
  const { toast } = useToast();

  // Get the warehouse stock item
  const warehouseItem = itemTypes.find(item => item.name === 'Warehouse Stock');
  const totalWarehouseStock = warehouseItem?.totalStock || 0;
  const totalWarehouseDistributed = warehouseItem?.distributed || 0;
  const availableForAllocation = totalWarehouseStock - totalWarehouseDistributed;

  const activeMarketplaces = marketplaces.filter(m => m.status === 'active' || m.status === 'upcoming');

  const handleAllocate = async () => {
    const targetMarketplace = modalMarketplaceId || selectedMarketplaceId;
    if (!targetMarketplace || !quantity) {
      toast({
        title: 'Missing Fields',
        description: 'Please select a marketplace and quantity',
        variant: 'destructive',
      });
      return;
    }

    if (!warehouseItem) {
      toast({
        title: 'No Warehouse Stock',
        description: 'Please set warehouse stock in Inventory Management first',
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
        marketplaceId: targetMarketplace,
        itemTypeId: warehouseItem.id,
        quantity: qty,
      });
      toast({
        title: 'Items Allocated',
        description: `${qty.toLocaleString()} items allocated to marketplace`,
      });
      setShowAllocateModal(false);
      setModalMarketplaceId('');
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

  // Start editing an allocation
  const handleStartEdit = (alloc: { id: string; allocatedQuantity: number; distributedQuantity: number }) => {
    setEditingAllocationId(alloc.id);
    setEditAllocated(alloc.allocatedQuantity);
    setEditDistributed(alloc.distributedQuantity);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingAllocationId(null);
    setEditAllocated(0);
    setEditDistributed(0);
  };

  // Save edited allocation
  const handleSaveEdit = async () => {
    if (!editingAllocationId) return;

    try {
      await updateAllocationQuantities.mutateAsync({
        allocationId: editingAllocationId,
        allocatedQuantity: editAllocated,
        distributedQuantity: editDistributed,
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

  const selectedMarketplace = marketplaces.find(m => m.id === selectedMarketplaceId);

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
              <h1 className="font-display font-bold text-base md:text-lg truncate">Marketplace Allocation</h1>
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
        {/* Warehouse Stock Overview */}
        <div className="bg-card rounded-xl border border-border p-4 mb-6 shadow-card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Warehouse className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Warehouse Stock</p>
              <p className="text-2xl font-bold">{totalWarehouseStock.toLocaleString()}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-sm text-muted-foreground">Available for allocation</p>
              <p className="text-lg font-semibold text-primary">{availableForAllocation.toLocaleString()}</p>
            </div>
          </div>
        </div>

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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
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

            {/* Allocation Display */}
            <div className="bg-card rounded-xl md:rounded-2xl border border-border shadow-card">
              <div className="p-4 md:p-6 border-b border-border">
                <h2 className="font-display font-bold text-lg">
                  Allocation for {selectedMarketplace?.name}
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
                <div className="p-6 space-y-4">
                  {allocations.map((alloc) => (
                    <motion.div
                      key={alloc.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border border-border rounded-lg p-4"
                    >
                      {editingAllocationId === alloc.id ? (
                        // Edit Mode
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Edit Allocation</span>
                            <div className="flex gap-2">
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
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="edit-allocated">Allocated Quantity</Label>
                              <Input
                                id="edit-allocated"
                                type="number"
                                min={0}
                                value={editAllocated}
                                onChange={(e) => setEditAllocated(parseInt(e.target.value) || 0)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="edit-distributed">Distributed Quantity</Label>
                              <Input
                                id="edit-distributed"
                                type="number"
                                min={0}
                                max={editAllocated}
                                value={editDistributed}
                                onChange={(e) => setEditDistributed(parseInt(e.target.value) || 0)}
                              />
                            </div>
                          </div>
                          {editDistributed > editAllocated && (
                            <p className="text-sm text-destructive">
                              Warning: Distributed cannot exceed allocated
                            </p>
                          )}
                        </div>
                      ) : (
                        // Display Mode
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm text-muted-foreground">Distribution Progress</span>
                              <span className="text-sm font-medium">
                                {alloc.distributedQuantity.toLocaleString()} / {alloc.allocatedQuantity.toLocaleString()}
                              </span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all ${
                                  alloc.distributedQuantity > alloc.allocatedQuantity 
                                    ? 'bg-destructive' 
                                    : 'bg-emerald-500'
                                }`}
                                style={{ width: `${alloc.allocatedQuantity > 0 ? Math.min((alloc.distributedQuantity / alloc.allocatedQuantity) * 100, 100) : 0}%` }}
                              />
                            </div>
                            <div className="flex justify-between mt-2 text-sm">
                              <span className={alloc.distributedQuantity > alloc.allocatedQuantity ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                                {alloc.allocatedQuantity > 0 
                                  ? `${((alloc.distributedQuantity / alloc.allocatedQuantity) * 100).toFixed(1)}% complete`
                                  : '0% complete'
                                }
                              </span>
                              <span className={`font-medium ${
                                alloc.allocatedQuantity - alloc.distributedQuantity < 0 
                                  ? 'text-destructive' 
                                  : 'text-amber-600'
                              }`}>
                                {(alloc.allocatedQuantity - alloc.distributedQuantity).toLocaleString()} remaining
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => handleStartEdit(alloc)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
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
                        </div>
                      )}
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

      {/* Allocate Modal - Simplified to quantity only */}
      <Dialog open={showAllocateModal} onOpenChange={setShowAllocateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Allocate Items</DialogTitle>
            <DialogDescription>
              Allocate warehouse items to a marketplace
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Warehouse Info */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <Warehouse className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">Warehouse Stock</p>
                  <p className="text-sm text-muted-foreground">
                    {availableForAllocation.toLocaleString()} available for allocation
                  </p>
                </div>
              </div>
            </div>

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
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {mp.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                This will add to any existing allocation for the selected marketplace
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowAllocateModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAllocate} 
              disabled={allocateToMarketplace.isPending || !(modalMarketplaceId || selectedMarketplaceId) || !quantity || !warehouseItem}
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
