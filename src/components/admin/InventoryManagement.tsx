import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, Loader2, Edit2, Warehouse } from 'lucide-react';
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
import { useItemTypes, useInventoryOperations } from '@/hooks/useSupabaseData';
import { useToast } from '@/hooks/use-toast';

interface InventoryManagementProps {
  onBack: () => void;
}

export const InventoryManagement = ({ onBack }: InventoryManagementProps) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStock, setEditStock] = useState('');

  const { data: itemTypes = [], isLoading } = useItemTypes();
  const { updateItemStock, addItemType } = useInventoryOperations();
  const { toast } = useToast();

  // We use a single "warehouse" item type for simplified inventory
  const warehouseItem = itemTypes.find(item => item.name === 'Warehouse Stock');
  
  const totalStock = warehouseItem?.totalStock || 0;
  const totalDistributed = warehouseItem?.distributed || 0;
  const totalAvailable = totalStock - totalDistributed;

  const handleUpdateStock = async () => {
    const stockNum = parseInt(editStock) || 0;
    if (stockNum < 0) {
      toast({
        title: 'Invalid Stock',
        description: 'Stock must be 0 or greater',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (warehouseItem) {
        await updateItemStock.mutateAsync({ id: warehouseItem.id, totalStock: stockNum });
      } else {
        // Create the warehouse stock item if it doesn't exist
        await addItemType.mutateAsync({ 
          name: 'Warehouse Stock', 
          icon: '📦', 
          totalStock: stockNum 
        });
      }
      toast({
        title: 'Stock Updated',
        description: `Warehouse stock updated to ${stockNum.toLocaleString()}`,
      });
      setShowEditModal(false);
      setEditStock('');
    } catch (error) {
      toast({
        title: 'Failed to Update',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const openEditModal = () => {
    setEditStock(totalStock.toString());
    setShowEditModal(true);
  };

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
              <h1 className="font-display font-bold text-base md:text-lg truncate">Warehouse Inventory</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Manage total warehouse stock</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-6 md:py-8 px-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Main Warehouse Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border border-border shadow-card overflow-hidden mb-6"
            >
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Warehouse className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-lg font-medium text-muted-foreground mb-2">Total Warehouse Stock</h2>
                <p className="text-5xl font-bold text-foreground mb-4">
                  {totalStock.toLocaleString()}
                </p>
                <Button onClick={openEditModal} variant="outline" size="lg">
                  <Edit2 className="w-4 h-4 mr-2" />
                  Update Stock
                </Button>
              </div>

              <div className="grid grid-cols-2 divide-x divide-border">
                <div className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-accent-soft flex items-center justify-center mx-auto mb-2">
                    <Package className="w-6 h-6 text-accent-foreground" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{totalAvailable.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Available</p>
                </div>
                <div className="p-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                    <Package className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{totalDistributed.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Distributed</p>
                </div>
              </div>
            </motion.div>

            {/* Info Card */}
            <div className="bg-muted/50 rounded-xl p-4 border border-border">
              <h3 className="font-medium text-sm mb-2">How it works</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Set your total warehouse stock above</li>
                <li>• Allocate quantities to marketplaces in Allocation Management</li>
                <li>• Volunteers distribute items by scanning beneficiary QR codes</li>
                <li>• Reports show breakdown by marketplace and demographics</li>
              </ul>
            </div>
          </>
        )}
      </main>

      {/* Edit Stock Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Update Warehouse Stock</DialogTitle>
            <DialogDescription>
              Set the total number of items in your warehouse
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editStock">Total Stock</Label>
              <Input
                id="editStock"
                type="number"
                value={editStock}
                onChange={(e) => setEditStock(e.target.value)}
                min="0"
                placeholder="Enter total stock quantity"
              />
              <p className="text-xs text-muted-foreground">
                This is the total number of items available for allocation to marketplaces
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateStock} 
              disabled={updateItemStock.isPending || addItemType.isPending}
            >
              {(updateItemStock.isPending || addItemType.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Update Stock
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
