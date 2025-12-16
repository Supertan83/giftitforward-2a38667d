import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Package, 
  BarChart3, 
  Settings, 
  QrCode,
  Plus,
  ArrowRight,
  Building,
  Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ItemCard } from '@/components/ItemCard';
import { StatCard } from '@/components/StatCard';
import { useAppStore } from '@/store/useAppStore';
import { mockMarketplaceEvents } from '@/data/mockData';
import { useToast } from '@/hooks/use-toast';

export const AdminDashboard = () => {
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [allocationQuantity, setAllocationQuantity] = useState('');

  const { itemTypes, allocateItemsToMarketplace, logout } = useAppStore();
  const { toast } = useToast();

  const totalStock = itemTypes.reduce((sum, item) => sum + item.totalStock, 0);
  const totalAllocated = itemTypes.reduce((sum, item) => sum + item.allocatedToMarketplace, 0);
  const totalDistributed = itemTypes.reduce((sum, item) => sum + item.distributed, 0);

  const selectedItem = itemTypes.find(i => i.id === selectedItemId);
  const availableToAllocate = selectedItem 
    ? selectedItem.totalStock - selectedItem.allocatedToMarketplace 
    : 0;

  const handleAllocate = () => {
    if (!selectedItemId || !selectedEventId || !allocationQuantity) return;

    const quantity = parseInt(allocationQuantity);
    if (isNaN(quantity) || quantity <= 0) return;

    const success = allocateItemsToMarketplace(selectedItemId, quantity);

    if (success) {
      toast({
        title: 'Items Allocated Successfully',
        description: `${quantity} ${selectedItem?.name} allocated to marketplace`,
      });
      setShowAllocationModal(false);
      setAllocationQuantity('');
      setSelectedItemId(null);
    } else {
      toast({
        title: 'Allocation Failed',
        description: 'Not enough stock available',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
                <Package className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg">Charity Marketplace</h1>
                <p className="text-sm text-muted-foreground">Admin Dashboard</p>
              </div>
            </div>
            <Button variant="outline" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={Package}
            label="Total Inventory"
            value={totalStock.toLocaleString()}
            subValue="items in warehouse"
          />
          <StatCard
            icon={Building}
            label="Allocated to Events"
            value={totalAllocated.toLocaleString()}
            subValue={`${Math.round((totalAllocated / totalStock) * 100)}% of inventory`}
            variant="primary"
          />
          <StatCard
            icon={BarChart3}
            label="Total Distributed"
            value={totalDistributed.toLocaleString()}
            subValue={`${Math.round((totalDistributed / totalAllocated) * 100)}% of allocated`}
            variant="success"
          />
        </div>

        {/* Inventory Section */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display font-bold text-xl">Inventory Management</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Allocate items to marketplace events
              </p>
            </div>
            <Button onClick={() => setShowAllocationModal(true)}>
              <Plus className="w-4 h-4" />
              Allocate Items
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {itemTypes.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ItemCard item={item} showStats />
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      {/* Allocation Modal */}
      <Dialog open={showAllocationModal} onOpenChange={setShowAllocationModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Allocate Items to Marketplace
            </DialogTitle>
            <DialogDescription>
              Select an item type and quantity to assign to a marketplace event
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Item Selection */}
            <div className="space-y-2">
              <Label>Select Item Type</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {itemTypes.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItemId(item.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      selectedItemId === item.id
                        ? 'border-primary bg-primary-soft'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <span className="text-xl mr-2">{item.icon}</span>
                    <span className="text-sm font-medium">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedItem && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="text-muted-foreground">
                  Available: <span className="font-semibold text-foreground">{availableToAllocate.toLocaleString()}</span> of {selectedItem.totalStock.toLocaleString()}
                </p>
              </div>
            )}

            {/* Event Selection */}
            <div className="space-y-2">
              <Label>Select Marketplace Event</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an event..." />
                </SelectTrigger>
                <SelectContent>
                  {mockMarketplaceEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {event.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity Input */}
            <div className="space-y-2">
              <Label>Quantity to Allocate</Label>
              <Input
                type="number"
                placeholder="Enter quantity..."
                value={allocationQuantity}
                onChange={(e) => setAllocationQuantity(e.target.value)}
                max={availableToAllocate}
              />
              {availableToAllocate > 0 && (
                <p className="text-xs text-muted-foreground">
                  Maximum: {availableToAllocate.toLocaleString()} items
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowAllocationModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAllocate}
              disabled={!selectedItemId || !selectedEventId || !allocationQuantity}
            >
              Confirm Allocation
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
