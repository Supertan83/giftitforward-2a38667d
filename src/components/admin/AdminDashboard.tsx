import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, BarChart3, QrCode, ArrowRight, Building, Calendar, TrendingUp, Loader2, Users, Store, Webhook, ClipboardList, Database, UserPlus, GraduationCap, FileQuestion, Award, RefreshCw, UserCheck, PieChart, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { ItemCard } from '@/components/ItemCard';
import { StatCard } from '@/components/StatCard';
import { QRCodeGenerator } from '@/components/admin/QRCodeGenerator';
import { StatisticsDashboard } from '@/components/admin/StatisticsDashboard';
import { UserManagement } from '@/components/admin/UserManagement';
import { MarketplaceManagement } from '@/components/admin/MarketplaceManagement';
import { InventoryManagement } from '@/components/admin/InventoryManagement';
import { WebhookEventsViewer } from '@/components/admin/WebhookEventsViewer';
import { PartnerRegistrations } from '@/components/admin/PartnerRegistrations';
import { ExternalItemsViewer } from '@/components/admin/ExternalItemsViewer';
import { PendingVolunteers } from '@/components/admin/PendingVolunteers';
import { TrainingAssessmentBuilder } from '@/components/admin/TrainingAssessmentBuilder';
import { TrainingCompletionViewer } from '@/components/admin/TrainingCompletionViewer';
import { VolunteerQRCodeGenerator } from '@/components/admin/VolunteerQRCodeGenerator';
import { MarketplaceSyncPanel } from '@/components/admin/MarketplaceSyncPanel';
import { MarketplaceReports } from '@/components/admin/MarketplaceReports';
import { AllocationManagement } from '@/components/admin/AllocationManagement';
import { VolunteerQRCardsViewer } from '@/components/admin/VolunteerQRCardsViewer';
import { useAuth } from '@/contexts/AuthContext';
import { useItemTypes, useInventoryOperations, useMarketplaces } from '@/hooks/useSupabaseData';
import { useMarketplaceAllocations, useAllocationOperations } from '@/hooks/useMarketplaceAllocations';
import { useToast } from '@/hooks/use-toast';
type AdminView = 'dashboard' | 'qr-generator' | 'statistics' | 'users' | 'marketplaces' | 'inventory' | 'webhooks' | 'partner-registrations' | 'external-items' | 'pending-volunteers' | 'training-assessments' | 'training-completion' | 'volunteer-qr' | 'marketplace-sync' | 'marketplace-reports' | 'allocations' | 'volunteer-qr-cards';
export const AdminDashboard = () => {
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [allocationQuantity, setAllocationQuantity] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingStock, setEditingStock] = useState('');
  const [editingAllocation, setEditingAllocation] = useState<{ id: string; field: 'allocated' | 'distributed'; value: string } | null>(null);
  const [expandedMarketplace, setExpandedMarketplace] = useState<string | null>(null);
  const [fullEditItem, setFullEditItem] = useState<{ id: string; name: string; icon: string; totalStock: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const navigate = useNavigate();
  const {
    signOut
  } = useAuth();
  const {
    data: itemTypes = [],
    isLoading
  } = useItemTypes();
  const {
    data: marketplaces = []
  } = useMarketplaces();
  const {
    data: allocations = [],
    isLoading: allocationsLoading
  } = useMarketplaceAllocations();
  const {
    allocateItems,
    updateItemStock,
    updateItemType,
    deleteItemType
  } = useInventoryOperations();
  const {
    updateAllocationQuantities
  } = useAllocationOperations();
  const {
    toast
  } = useToast();
  
  const handleSaveStock = async (itemId: string) => {
    const newStock = parseInt(editingStock);
    if (isNaN(newStock) || newStock < 0) {
      toast({
        title: 'Invalid Value',
        description: 'Please enter a valid positive number',
        variant: 'destructive'
      });
      return;
    }
    try {
      await updateItemStock.mutateAsync({ id: itemId, totalStock: newStock });
      toast({
        title: 'Stock Updated',
        description: `Warehouse stock updated to ${newStock.toLocaleString()}`
      });
      setEditingItemId(null);
      setEditingStock('');
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update stock',
        variant: 'destructive'
      });
    }
  };

  const handleSaveAllocation = async () => {
    if (!editingAllocation) return;
    const newValue = parseInt(editingAllocation.value);
    if (isNaN(newValue) || newValue < 0) {
      toast({
        title: 'Invalid Value',
        description: 'Please enter a valid positive number',
        variant: 'destructive'
      });
      return;
    }
    try {
      await updateAllocationQuantities.mutateAsync({
        allocationId: editingAllocation.id,
        ...(editingAllocation.field === 'allocated' 
          ? { allocatedQuantity: newValue }
          : { distributedQuantity: newValue })
      });
      toast({
        title: 'Allocation Updated',
        description: `${editingAllocation.field === 'allocated' ? 'Allocated' : 'Distributed'} quantity updated to ${newValue.toLocaleString()}`
      });
      setEditingAllocation(null);
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update allocation',
        variant: 'destructive'
      });
    }
  };

  const handleSaveFullEdit = async () => {
    if (!fullEditItem) return;
    const newStock = parseInt(fullEditItem.totalStock);
    if (isNaN(newStock) || newStock < 0) {
      toast({
        title: 'Invalid Value',
        description: 'Please enter a valid positive number for stock',
        variant: 'destructive'
      });
      return;
    }
    if (!fullEditItem.name.trim()) {
      toast({
        title: 'Invalid Name',
        description: 'Please enter a valid item name',
        variant: 'destructive'
      });
      return;
    }
    try {
      await updateItemType.mutateAsync({
        id: fullEditItem.id,
        name: fullEditItem.name.trim(),
        icon: fullEditItem.icon || '📦',
        totalStock: newStock
      });
      toast({
        title: 'Item Updated',
        description: `${fullEditItem.name} has been updated successfully`
      });
      setFullEditItem(null);
    } catch (error) {
      toast({
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Failed to update item',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteConfirm || deleteInput.toLowerCase() !== 'delete') return;
    try {
      await deleteItemType.mutateAsync(deleteConfirm.id);
      toast({
        title: 'Item Deleted',
        description: `${deleteConfirm.name} has been deleted`
      });
      setDeleteConfirm(null);
      setDeleteInput('');
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete item',
        variant: 'destructive'
      });
    }
  };

  // Calculate stats from marketplace allocations (where distribution actually happens)
  const totalStock = itemTypes.reduce((sum, item) => sum + item.totalStock, 0);
  const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocatedQuantity, 0);
  const totalDistributed = allocations.reduce((sum, alloc) => sum + alloc.distributedQuantity, 0);
  const totalRemaining = totalAllocated - totalDistributed;
  
  // Group allocations by marketplace for breakdown
  const marketplaceStats = marketplaces.map(mp => {
    const mpAllocations = allocations.filter(a => a.marketplaceId === mp.id);
    const allocated = mpAllocations.reduce((sum, a) => sum + a.allocatedQuantity, 0);
    const distributed = mpAllocations.reduce((sum, a) => sum + a.distributedQuantity, 0);
    return {
      id: mp.id,
      name: mp.name,
      location: mp.location,
      status: mp.status,
      allocated,
      distributed,
      remaining: allocated - distributed,
    };
  }).filter(mp => mp.allocated > 0 || mp.distributed > 0);
  
  const selectedItem = itemTypes.find(i => i.id === selectedItemId);
  const handleAllocate = async () => {
    if (!selectedItemId || !selectedEventId || !allocationQuantity) return;
    const quantity = parseInt(allocationQuantity);
    if (isNaN(quantity) || quantity <= 0) return;
    try {
      await allocateItems.mutateAsync({
        itemId: selectedItemId,
        quantity
      });
      toast({
        title: 'Items Allocated Successfully',
        description: `${quantity} ${selectedItem?.name} allocated to marketplace`
      });
      setShowAllocationModal(false);
      setAllocationQuantity('');
      setSelectedItemId(null);
    } catch (error) {
      toast({
        title: 'Allocation Failed',
        description: error instanceof Error ? error.message : 'Not enough stock available',
        variant: 'destructive'
      });
    }
  };

  // Show QR Generator view
  if (currentView === 'qr-generator') {
    return <QRCodeGenerator onBack={() => setCurrentView('dashboard')} />;
  }

  // Show Statistics Dashboard view
  if (currentView === 'statistics') {
    return <StatisticsDashboard onBack={() => setCurrentView('dashboard')} />;
  }

  // Show User Management view
  if (currentView === 'users') {
    return <UserManagement onBack={() => setCurrentView('dashboard')} />;
  }

  // Show Marketplace Management view
  if (currentView === 'marketplaces') {
    return <MarketplaceManagement onBack={() => setCurrentView('dashboard')} />;
  }

  // Show Inventory Management view
  if (currentView === 'inventory') {
    return <InventoryManagement onBack={() => setCurrentView('dashboard')} />;
  }

  // Show Webhook Events view
  if (currentView === 'webhooks') {
    return <WebhookEventsViewer onBack={() => setCurrentView('dashboard')} />;
  }

  // Show Partner Registrations view
  if (currentView === 'partner-registrations') {
    return <PartnerRegistrations onBack={() => setCurrentView('dashboard')} />;
  }

  // Show External Items view
  if (currentView === 'external-items') {
    return <ExternalItemsViewer onBack={() => setCurrentView('dashboard')} />;
  }

  // Show Pending Volunteers view
  if (currentView === 'pending-volunteers') {
    return <PendingVolunteers onBack={() => setCurrentView('dashboard')} />;
  }

  // Show Training Assessment Builder view
  if (currentView === 'training-assessments') {
    return <TrainingAssessmentBuilder onBack={() => setCurrentView('dashboard')} />;
  }

  // Show Training Completion view
  if (currentView === 'training-completion') {
    return <TrainingCompletionViewer onBack={() => setCurrentView('dashboard')} />;
  }

  // Show Volunteer QR Generator view
  if (currentView === 'volunteer-qr') {
    return <VolunteerQRCodeGenerator onBack={() => setCurrentView('dashboard')} />;
  }

  // Show Marketplace Sync view
  if (currentView === 'marketplace-sync') {
    return <MarketplaceSyncPanel onBack={() => setCurrentView('dashboard')} />;
  }

  // Show Marketplace Reports view
  if (currentView === 'marketplace-reports') {
    return <MarketplaceReports onBack={() => setCurrentView('dashboard')} />;
  }

  // Show Allocations view
  if (currentView === 'allocations') {
    return <AllocationManagement onBack={() => setCurrentView('dashboard')} />;
  }

  // Show Volunteer QR Cards view
  if (currentView === 'volunteer-qr-cards') {
    return <VolunteerQRCardsViewer onBack={() => setCurrentView('dashboard')} />;
  }
  if (isLoading || allocationsLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-3 md:py-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <BrandLogo size="md" />
              <div>
                <h1 className="font-display font-bold text-base md:text-lg">GIF (Gift it Forward)</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Admin Dashboard</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} className="text-xs md:text-sm">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <StatCard icon={Package} label="Total Inventory" value={totalStock.toLocaleString()} subValue="items in warehouse" />
          <StatCard icon={Building} label="Allocated" value={totalAllocated.toLocaleString()} subValue={totalStock > 0 ? `${Math.round(totalAllocated / totalStock * 100)}% of inventory` : '0% of inventory'} variant="primary" />
          <StatCard icon={BarChart3} label="Distributed" value={totalDistributed.toLocaleString()} subValue={totalAllocated > 0 ? `${Math.round(totalDistributed / totalAllocated * 100)}% of allocated` : '0% of allocated'} variant="success" />
          <StatCard icon={TrendingUp} label="Remaining" value={totalRemaining.toLocaleString()} subValue="items to distribute" variant="warning" />
        </div>

        {/* Per-Marketplace Breakdown */}
        {marketplaceStats.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-4 md:p-6 mb-6 md:mb-8"
          >
            <h2 className="font-display font-semibold text-base md:text-lg mb-4 flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              Distribution by Marketplace
              <span className="text-xs text-muted-foreground font-normal">(click row to expand)</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Marketplace</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Allocated</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Distributed</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Remaining</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {marketplaceStats.map(mp => {
                    const mpAllocations = allocations.filter(a => a.marketplaceId === mp.id);
                    const isExpanded = expandedMarketplace === mp.id;
                    return (
                      <>
                        <tr 
                          key={mp.id} 
                          className="border-b border-border/50 hover:bg-muted/50 cursor-pointer"
                          onClick={() => setExpandedMarketplace(isExpanded ? null : mp.id)}
                        >
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
                              <div>
                                <div className="font-medium">{mp.name}</div>
                                <div className="text-xs text-muted-foreground">{mp.location}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-right py-2 px-3">{mp.allocated.toLocaleString()}</td>
                          <td className="text-right py-2 px-3 text-emerald-600">{mp.distributed.toLocaleString()}</td>
                          <td className="text-right py-2 px-3">{mp.remaining.toLocaleString()}</td>
                          <td className="text-right py-2 px-3">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${mp.allocated > 0 ? (mp.distributed / mp.allocated) * 100 : 0}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-10">
                                {mp.allocated > 0 ? Math.round((mp.distributed / mp.allocated) * 100) : 0}%
                              </span>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && mpAllocations.map(alloc => (
                          <tr key={alloc.id} className="bg-muted/30 border-b border-border/30">
                            <td className="py-2 px-3 pl-10">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <span>{alloc.itemIcon || '📦'}</span>
                                <span>{alloc.itemName || 'Unknown Item'}</span>
                              </div>
                            </td>
                            <td className="text-right py-2 px-3">
                              {editingAllocation?.id === alloc.id && editingAllocation.field === 'allocated' ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    type="number"
                                    value={editingAllocation.value}
                                    onChange={(e) => setEditingAllocation({ ...editingAllocation, value: e.target.value })}
                                    className="w-20 h-7 text-right text-sm"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      e.stopPropagation();
                                      if (e.key === 'Enter') handleSaveAllocation();
                                      if (e.key === 'Escape') setEditingAllocation(null);
                                    }}
                                  />
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleSaveAllocation(); }}>✓</Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setEditingAllocation(null); }}>✕</Button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingAllocation({ id: alloc.id, field: 'allocated', value: alloc.allocatedQuantity.toString() });
                                  }}
                                  className="hover:text-primary hover:underline cursor-pointer"
                                >
                                  {alloc.allocatedQuantity.toLocaleString()}
                                </button>
                              )}
                            </td>
                            <td className="text-right py-2 px-3">
                              {editingAllocation?.id === alloc.id && editingAllocation.field === 'distributed' ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Input
                                    type="number"
                                    value={editingAllocation.value}
                                    onChange={(e) => setEditingAllocation({ ...editingAllocation, value: e.target.value })}
                                    className="w-20 h-7 text-right text-sm"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      e.stopPropagation();
                                      if (e.key === 'Enter') handleSaveAllocation();
                                      if (e.key === 'Escape') setEditingAllocation(null);
                                    }}
                                  />
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleSaveAllocation(); }}>✓</Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setEditingAllocation(null); }}>✕</Button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingAllocation({ id: alloc.id, field: 'distributed', value: alloc.distributedQuantity.toString() });
                                  }}
                                  className="text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                                >
                                  {alloc.distributedQuantity.toLocaleString()}
                                </button>
                              )}
                            </td>
                            <td className="text-right py-2 px-3 text-muted-foreground">
                              {(alloc.allocatedQuantity - alloc.distributedQuantity).toLocaleString()}
                            </td>
                            <td className="text-right py-2 px-3">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${alloc.allocatedQuantity > 0 ? (alloc.distributedQuantity / alloc.allocatedQuantity) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-10">
                                  {alloc.allocatedQuantity > 0 ? Math.round((alloc.distributedQuantity / alloc.allocatedQuantity) * 100) : 0}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Item Stock Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border border-border p-4 md:p-6 mb-6 md:mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-base md:text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Item Stock Overview
            </h2>
            <Button variant="outline" size="sm" onClick={() => setCurrentView('inventory')}>
              Manage Inventory
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">Item</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Warehouse Stock</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Allocated</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Distributed</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Unallocated</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {itemTypes.map(item => {
                  const itemAllocations = allocations.filter(a => a.itemTypeId === item.id);
                  const itemAllocated = itemAllocations.reduce((sum, a) => sum + a.allocatedQuantity, 0);
                  const itemDistributed = itemAllocations.reduce((sum, a) => sum + a.distributedQuantity, 0);
                  const unallocated = item.totalStock - itemAllocated;
                  const isEditing = editingItemId === item.id;
                  return (
                    <tr key={item.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{item.icon}</span>
                          <span className="font-medium">{item.name}</span>
                        </div>
                      </td>
                      <td className="text-right py-2 px-3">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Input
                              type="number"
                              value={editingStock}
                              onChange={(e) => setEditingStock(e.target.value)}
                              className="w-24 h-7 text-right text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveStock(item.id);
                                if (e.key === 'Escape') {
                                  setEditingItemId(null);
                                  setEditingStock('');
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => handleSaveStock(item.id)}
                              disabled={updateItemStock.isPending}
                            >
                              ✓
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setEditingItemId(null);
                                setEditingStock('');
                              }}
                            >
                              ✕
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditingStock(item.totalStock.toString());
                            }}
                            className="font-medium hover:text-primary hover:underline cursor-pointer"
                          >
                            {item.totalStock.toLocaleString()}
                          </button>
                        )}
                      </td>
                      <td className="text-right py-2 px-3 text-primary">{itemAllocated.toLocaleString()}</td>
                      <td className="text-right py-2 px-3 text-emerald-600">{itemDistributed.toLocaleString()}</td>
                      <td className="text-right py-2 px-3 text-muted-foreground">{unallocated.toLocaleString()}</td>
                      <td className="text-right py-2 px-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setFullEditItem({
                              id: item.id,
                              name: item.name,
                              icon: item.icon,
                              totalStock: item.totalStock.toString()
                            })}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm({ id: item.id, name: item.name })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Edit Item Dialog */}
        <Dialog open={!!fullEditItem} onOpenChange={(open) => !open && setFullEditItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Item</DialogTitle>
              <DialogDescription>Update item details below.</DialogDescription>
            </DialogHeader>
            {fullEditItem && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-icon">Icon (emoji)</Label>
                  <Input
                    id="edit-icon"
                    value={fullEditItem.icon}
                    onChange={(e) => setFullEditItem({ ...fullEditItem, icon: e.target.value })}
                    placeholder="📦"
                    className="w-20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input
                    id="edit-name"
                    value={fullEditItem.name}
                    onChange={(e) => setFullEditItem({ ...fullEditItem, name: e.target.value })}
                    placeholder="Item name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-stock">Warehouse Stock</Label>
                  <Input
                    id="edit-stock"
                    type="number"
                    value={fullEditItem.totalStock}
                    onChange={(e) => setFullEditItem({ ...fullEditItem, totalStock: e.target.value })}
                    placeholder="0"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setFullEditItem(null)}>Cancel</Button>
              <Button onClick={handleSaveFullEdit} disabled={updateItemType.isPending}>
                {updateItemType.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) { setDeleteConfirm(null); setDeleteInput(''); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{deleteConfirm?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the item and all its data.
                <br /><br />
                Type <strong>delete</strong> to confirm:
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Input
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="Type 'delete' to confirm"
              className="mt-2"
            />
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setDeleteConfirm(null); setDeleteInput(''); }}>
                Cancel
              </AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleDeleteItem}
                disabled={deleteInput.toLowerCase() !== 'delete' || deleteItemType.isPending}
              >
                {deleteItemType.isPending ? 'Deleting...' : 'Delete Item'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('qr-generator')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-primary-soft flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0">
                <QrCode className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Generate QR Cards</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  Create and print new beneficiary cards
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.1
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('inventory')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-accent-soft flex items-center justify-center group-hover:bg-accent/20 transition-colors shrink-0">
                <Package className="w-5 h-5 md:w-6 md:h-6 text-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Manage Inventory</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  Add and manage item types
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.15
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('allocations')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors shrink-0">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-teal-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Allocate Items</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  Assign inventory to marketplaces
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.2
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('statistics')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors shrink-0">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Live Statistics</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  View real-time distribution analytics
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.3
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('users')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors shrink-0">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Manage Users</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  Create and manage volunteer accounts
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.4
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('marketplaces')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors shrink-0">
                <Store className="w-5 h-5 md:w-6 md:h-6 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Marketplaces</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  Manage distribution events
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.5
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('webhooks')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors shrink-0">
                <Webhook className="w-5 h-5 md:w-6 md:h-6 text-cyan-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Webhook Events</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  View incoming webhook logs
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.6
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('partner-registrations')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-pink-500/10 flex items-center justify-center group-hover:bg-pink-500/20 transition-colors shrink-0">
                <ClipboardList className="w-5 h-5 md:w-6 md:h-6 text-pink-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Dubai Holdings</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  View event registrations & dependents
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.7
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('external-items')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-teal-500/10 flex items-center justify-center group-hover:bg-teal-500/20 transition-colors shrink-0">
                <Database className="w-5 h-5 md:w-6 md:h-6 text-teal-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">External Items</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  Partner database items & companies
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.8
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('pending-volunteers')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors shrink-0">
                <UserPlus className="w-5 h-5 md:w-6 md:h-6 text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Pending Volunteers</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  Approve volunteer applications
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.9
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => navigate('/training')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors shrink-0">
                <GraduationCap className="w-5 h-5 md:w-6 md:h-6 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Training Module</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  Preview & edit CE training slides
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 1.0
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('training-assessments')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors shrink-0">
                <FileQuestion className="w-5 h-5 md:w-6 md:h-6 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Training Assessments</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  Create training knowledge assessments
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 1.1
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('training-completion')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors shrink-0">
                <Award className="w-5 h-5 md:w-6 md:h-6 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Training Completion</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  View certificate status
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 1.2
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('volunteer-qr-cards')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors shrink-0">
                <UserCheck className="w-5 h-5 md:w-6 md:h-6 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Volunteer QR Cards</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  View all volunteer & family QR cards
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 1.3
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('marketplace-sync')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-500/20 transition-colors shrink-0">
                <RefreshCw className="w-5 h-5 md:w-6 md:h-6 text-rose-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Sync & Reset Cards</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  Archive data between marketplaces
                </p>
              </div>
            </div>
          </motion.button>

          <motion.button initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 1.4
        }} whileHover={{
          scale: 1.01
        }} whileTap={{
          scale: 0.99
        }} onClick={() => setCurrentView('marketplace-reports')} className="bg-card rounded-xl md:rounded-2xl border border-border p-3 md:p-5 shadow-card text-left hover:border-primary/50 transition-colors group">
            <div className="flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors shrink-0">
                <PieChart className="w-5 h-5 md:w-6 md:h-6 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-semibold text-sm md:text-base">Marketplace Reports</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 hidden md:block">
                  Detailed insights per marketplace
                </p>
              </div>
            </div>
          </motion.button>
        </div>

        {/* Inventory Section */}
        
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
                {itemTypes.map(item => <button key={item.id} onClick={() => setSelectedItemId(item.id)} className={`p-3 rounded-lg border-2 text-left transition-all ${selectedItemId === item.id ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/50'}`}>
                    <span className="text-xl mr-2">{item.icon}</span>
                    <span className="text-sm font-medium">{item.name}</span>
                  </button>)}
              </div>
            </div>

            {selectedItem && <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="text-muted-foreground">
                  Available: <span className="font-semibold text-foreground">{(selectedItem.totalStock - selectedItem.distributed).toLocaleString()}</span> of {selectedItem.totalStock.toLocaleString()}
                </p>
              </div>}

            {/* Event Selection */}
            <div className="space-y-2">
              <Label>Select Marketplace Event</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an event..." />
                </SelectTrigger>
                <SelectContent>
                  {marketplaces.map(event => <SelectItem key={event.id} value={event.id}>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {event.name}
                      </div>
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Quantity Input */}
            <div className="space-y-2">
              <Label>Quantity to Add to Stock</Label>
              <Input type="number" placeholder="Enter quantity..." value={allocationQuantity} onChange={e => setAllocationQuantity(e.target.value)} min={1} />
              <p className="text-xs text-muted-foreground">
                This will add items to the total stock
              </p>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowAllocationModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAllocate} disabled={!selectedItemId || !selectedEventId || !allocationQuantity || allocateItems.isPending}>
              {allocateItems.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Allocation
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
};