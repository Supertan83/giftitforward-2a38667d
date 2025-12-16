import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, Plus, Loader2, Trash2, Edit2 } from 'lucide-react';
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
import { z } from 'zod';

interface InventoryManagementProps {
  onBack: () => void;
}

const AVAILABLE_ICONS = [
  { icon: '🛏️', name: 'Bed/Duvet' },
  { icon: '🍳', name: 'Kitchen' },
  { icon: '🧥', name: 'Clothing' },
  { icon: '🧴', name: 'Hygiene' },
  { icon: '🧸', name: 'Toys' },
  { icon: '📚', name: 'Books' },
  { icon: '🎒', name: 'Bags' },
  { icon: '👟', name: 'Shoes' },
  { icon: '🧹', name: 'Cleaning' },
  { icon: '💊', name: 'Medical' },
  { icon: '🔧', name: 'Tools' },
  { icon: '📦', name: 'General' },
];

const createItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  icon: z.string().min(1, 'Please select an icon'),
  totalStock: z.number().min(0, 'Stock must be 0 or greater'),
});

export const InventoryManagement = ({ onBack }: InventoryManagementProps) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; name: string; totalStock: number } | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [totalStock, setTotalStock] = useState('');
  const [editStock, setEditStock] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: itemTypes = [], isLoading } = useItemTypes();
  const { addItemType, deleteItemType, updateItemStock } = useInventoryOperations();
  const { toast } = useToast();

  const handleCreate = async () => {
    setErrors({});
    
    const stockNum = parseInt(totalStock) || 0;
    const result = createItemSchema.safeParse({ name, icon, totalStock: stockNum });
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      await addItemType.mutateAsync({ name, icon, totalStock: stockNum });
      toast({
        title: 'Item Type Created',
        description: `${name} has been added to inventory`,
      });
      setShowCreateModal(false);
      setName('');
      setIcon('📦');
      setTotalStock('');
    } catch (error) {
      toast({
        title: 'Failed to Create Item',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string, itemName: string) => {
    if (!confirm(`Are you sure you want to delete "${itemName}"?`)) return;
    
    try {
      await deleteItemType.mutateAsync(id);
      toast({
        title: 'Item Deleted',
        description: `${itemName} has been removed`,
      });
    } catch (error) {
      toast({
        title: 'Failed to Delete',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleEditStock = async () => {
    if (!editingItem) return;
    
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
      await updateItemStock.mutateAsync({ id: editingItem.id, totalStock: stockNum });
      toast({
        title: 'Stock Updated',
        description: `${editingItem.name} stock updated to ${stockNum}`,
      });
      setShowEditModal(false);
      setEditingItem(null);
      setEditStock('');
    } catch (error) {
      toast({
        title: 'Failed to Update',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const openEditModal = (item: { id: string; name: string; totalStock: number }) => {
    setEditingItem(item);
    setEditStock(item.totalStock.toString());
    setShowEditModal(true);
  };

  const totalItems = itemTypes.reduce((sum, item) => sum + item.totalStock, 0);
  const totalAllocated = itemTypes.reduce((sum, item) => sum + item.allocatedToMarketplace, 0);
  const totalDistributed = itemTypes.reduce((sum, item) => sum + item.distributed, 0);

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
              <h1 className="font-display font-bold text-base md:text-lg truncate">Inventory Management</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Manage item types and stock</p>
            </div>
            <Button onClick={() => setShowCreateModal(true)} size="sm" className="shrink-0">
              <Plus className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Add Item</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalItems.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Total Stock</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-soft flex items-center justify-center">
                <Package className="w-5 h-5 text-accent-foreground" />
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
        </div>

        {/* Items List */}
        <div className="bg-card rounded-xl md:rounded-2xl border border-border shadow-card">
          <div className="p-4 md:p-6 border-b border-border">
            <h2 className="font-display font-bold text-lg">Item Types</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {itemTypes.length} item types
            </p>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div>
          ) : itemTypes.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No item types yet</p>
              <p className="text-sm">Create your first item type to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {itemTypes.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center shrink-0 text-xl">
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>Stock: {item.totalStock.toLocaleString()}</span>
                        <span>Allocated: {item.allocatedToMarketplace.toLocaleString()}</span>
                        <span>Distributed: {item.distributed.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => openEditModal({ id: item.id, name: item.name, totalStock: item.totalStock })}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(item.id, item.name)}
                      disabled={deleteItemType.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Item Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add Item Type</DialogTitle>
            <DialogDescription>
              Create a new item type for distribution
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Item Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Duvets, Kitchen Items"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="grid grid-cols-6 gap-2">
                {AVAILABLE_ICONS.map((item) => (
                  <button
                    key={item.icon}
                    type="button"
                    onClick={() => setIcon(item.icon)}
                    className={`p-2 rounded-lg border-2 text-2xl transition-all ${
                      icon === item.icon
                        ? 'border-primary bg-primary-soft'
                        : 'border-border hover:border-primary/50'
                    }`}
                    title={item.name}
                  >
                    {item.icon}
                  </button>
                ))}
              </div>
              {errors.icon && (
                <p className="text-sm text-destructive">{errors.icon}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalStock">Initial Stock</Label>
              <Input
                id="totalStock"
                type="number"
                placeholder="0"
                value={totalStock}
                onChange={(e) => setTotalStock(e.target.value)}
                min="0"
              />
              {errors.totalStock && (
                <p className="text-sm text-destructive">{errors.totalStock}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={addItemType.isPending}>
              {addItemType.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Stock Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Update Stock</DialogTitle>
            <DialogDescription>
              Update the total stock for {editingItem?.name}
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
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditStock} disabled={updateItemStock.isPending}>
              {updateItemStock.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Stock
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
