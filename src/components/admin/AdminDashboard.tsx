import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, BarChart3, QrCode, ArrowRight, Building, Calendar, TrendingUp, Loader2, Store, ChevronDown, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
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
import { SurplussSyncPanel } from '@/components/admin/SurplussSyncPanel';
import { AllocationManagement } from '@/components/admin/AllocationManagement';
import { SurplussAllocationControl } from '@/components/admin/SurplussAllocationControl';
import { VolunteerQRCardsViewer } from '@/components/admin/VolunteerQRCardsViewer';
import { HubSpotEmailConfig } from '@/components/admin/HubSpotEmailConfig';
import { EmailLogsViewer } from '@/components/admin/EmailLogsViewer';
import { useAuth } from '@/contexts/AuthContext';
import { useItemTypes, useInventoryOperations, useMarketplaces } from '@/hooks/useSupabaseData';
import { useMarketplaceAllocations, useAllocationOperations } from '@/hooks/useMarketplaceAllocations';
import { useToast } from '@/hooks/use-toast';
import { EmailManagement } from '@/components/admin/EmailManagement';
import { BulkVolunteerUpload } from '@/components/admin/BulkVolunteerUpload';
import { TraceabilityLogsViewer } from '@/components/admin/TraceabilityLogsViewer';
import { EmailTemplateCenter } from '@/components/admin/EmailTemplateCenter';
import { ItemListViewer } from '@/components/admin/ItemListViewer';
import { EmailCampaignManager } from '@/components/admin/EmailCampaignManager';
import { SurplussSyncMonitor } from '@/components/admin/SurplussSyncMonitor';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

type AdminView = 'dashboard' | 'qr-generator' | 'statistics' | 'users' | 'marketplaces' | 'inventory' | 'webhooks' | 'partner-registrations' | 'external-items' | 'pending-volunteers' | 'training-assessments' | 'training-completion' | 'volunteer-qr' | 'marketplace-sync' | 'marketplace-reports' | 'allocations' | 'volunteer-qr-cards' | 'surpluss-sync' | 'surpluss-allocation-control' | 'surpluss-sync-monitor' | 'hubspot-email-config' | 'email-logs' | 'email-management' | 'bulk-volunteer-upload' | 'traceability-logs' | 'email-templates' | 'item-list' | 'email-campaigns';

export const AdminDashboard = () => {
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');
  const [expandedSection, setExpandedSection] = useState<'distribution' | 'stockOverview' | null>('distribution');
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [allocationQuantity, setAllocationQuantity] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingStock, setEditingStock] = useState('');
  const [editingAllocation, setEditingAllocation] = useState<{
    id: string;
    field: 'allocated' | 'distributed';
    value: string;
  } | null>(null);
  const [expandedMarketplace, setExpandedMarketplace] = useState<string | null>(null);
  const [fullEditItem, setFullEditItem] = useState<{
    id: string;
    name: string;
    icon: string;
    totalStock: string;
    category: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [isSyncingHubspot, setIsSyncingHubspot] = useState(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: itemTypes = [], isLoading } = useItemTypes();
  const { data: marketplaces = [] } = useMarketplaces();
  const { data: allocations = [], isLoading: allocationsLoading } = useMarketplaceAllocations();
  const { allocateItems, updateItemStock, updateItemType, deleteItemType } = useInventoryOperations();
  const { updateAllocationQuantities } = useAllocationOperations();
  const { toast } = useToast();

  const handleSaveStock = async (itemId: string) => {
    const newStock = parseInt(editingStock);
    if (isNaN(newStock) || newStock < 0) {
      toast({ title: 'Invalid Value', description: 'Please enter a valid positive number', variant: 'destructive' });
      return;
    }
    try {
      await updateItemStock.mutateAsync({ id: itemId, totalStock: newStock });
      toast({ title: 'Stock Updated', description: `Warehouse stock updated to ${newStock.toLocaleString()}` });
      setEditingItemId(null);
      setEditingStock('');
    } catch (error) {
      toast({ title: 'Update Failed', description: error instanceof Error ? error.message : 'Failed to update stock', variant: 'destructive' });
    }
  };

  const handleSaveAllocation = async () => {
    if (!editingAllocation) return;
    const newValue = parseInt(editingAllocation.value);
    if (isNaN(newValue) || newValue < 0) {
      toast({ title: 'Invalid Value', description: 'Please enter a valid positive number', variant: 'destructive' });
      return;
    }
    try {
      await updateAllocationQuantities.mutateAsync({
        allocationId: editingAllocation.id,
        ...(editingAllocation.field === 'allocated' ? { allocatedQuantity: newValue } : { distributedQuantity: newValue })
      });
      toast({ title: 'Allocation Updated', description: `${editingAllocation.field === 'allocated' ? 'Allocated' : 'Distributed'} quantity updated to ${newValue.toLocaleString()}` });
      setEditingAllocation(null);
    } catch (error) {
      toast({ title: 'Update Failed', description: error instanceof Error ? error.message : 'Failed to update allocation', variant: 'destructive' });
    }
  };

  const handleSaveFullEdit = async () => {
    if (!fullEditItem) return;
    const newStock = parseInt(fullEditItem.totalStock);
    if (isNaN(newStock) || newStock < 0) {
      toast({ title: 'Invalid Value', description: 'Please enter a valid positive number for stock', variant: 'destructive' });
      return;
    }
    if (!fullEditItem.name.trim()) {
      toast({ title: 'Invalid Name', description: 'Please enter a valid item name', variant: 'destructive' });
      return;
    }
    try {
      await updateItemType.mutateAsync({
        id: fullEditItem.id,
        name: fullEditItem.name.trim(),
        icon: fullEditItem.icon || '📦',
        totalStock: newStock,
        category: fullEditItem.category || null
      });
      toast({ title: 'Item Updated', description: `${fullEditItem.name} has been updated successfully` });
      setFullEditItem(null);
    } catch (error) {
      toast({ title: 'Update Failed', description: error instanceof Error ? error.message : 'Failed to update item', variant: 'destructive' });
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteConfirm || deleteInput.toLowerCase() !== 'delete') return;
    try {
      await deleteItemType.mutateAsync(deleteConfirm.id);
      toast({ title: 'Item Deleted', description: `${deleteConfirm.name} has been deleted` });
      setDeleteConfirm(null);
      setDeleteInput('');
    } catch (error) {
      toast({ title: 'Delete Failed', description: error instanceof Error ? error.message : 'Failed to delete item', variant: 'destructive' });
    }
  };

  const handleAutoUnblock = async () => {
    toast({ title: 'Running auto-unblock...', description: 'Unblocking cards from previous days' });
    try {
      const { data, error } = await supabase.functions.invoke('auto-unblock-cards');
      if (error) throw error;
      toast({ title: 'Auto-Unblock Complete', description: `${data?.unblocked || 0} cards unblocked successfully` });
    } catch (error) {
      toast({ title: 'Unblock Failed', description: error instanceof Error ? error.message : 'Failed to run auto-unblock', variant: 'destructive' });
    }
  };

  const handleHubspotSync = async () => {
    setIsSyncingHubspot(true);
    toast({ title: 'Syncing to HubSpot...', description: 'Uploading approved volunteers to HubSpot contacts' });
    try {
      const { data, error } = await supabase.functions.invoke('hubspot-sync', { body: { action: 'sync_volunteers' } });
      if (error) throw error;
      toast({ title: 'HubSpot Sync Complete', description: `Created: ${data?.results?.created || 0}, Updated: ${data?.results?.updated || 0}, Errors: ${data?.results?.errors || 0}` });
    } catch (error) {
      toast({ title: 'Sync Failed', description: error instanceof Error ? error.message : 'Failed to sync with HubSpot', variant: 'destructive' });
    } finally {
      setIsSyncingHubspot(false);
    }
  };

  const totalStock = itemTypes.reduce((sum, item) => sum + item.totalStock, 0);
  const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.allocatedQuantity, 0);
  const totalDistributed = allocations.reduce((sum, alloc) => sum + alloc.distributedQuantity, 0);

  const marketplaceStats = marketplaces.map(mp => {
    const mpAllocations = allocations.filter(a => a.marketplaceId === mp.id);
    const allocated = mpAllocations.reduce((sum, a) => sum + a.allocatedQuantity, 0);
    const distributed = mpAllocations.reduce((sum, a) => sum + a.distributedQuantity, 0);
    return { id: mp.id, name: mp.name, location: mp.location, status: mp.status, allocated, distributed, remaining: allocated - distributed };
  }).filter(mp => mp.allocated > 0 || mp.distributed > 0);

  const selectedItem = itemTypes.find(i => i.id === selectedItemId);

  const handleAllocate = async () => {
    if (!selectedItemId || !selectedEventId || !allocationQuantity) return;
    const quantity = parseInt(allocationQuantity);
    if (isNaN(quantity) || quantity <= 0) return;
    try {
      await allocateItems.mutateAsync({ itemId: selectedItemId, quantity });
      toast({ title: 'Items Allocated Successfully', description: `${quantity} ${selectedItem?.name} allocated to marketplace` });
      setShowAllocationModal(false);
      setAllocationQuantity('');
      setSelectedItemId(null);
    } catch (error) {
      toast({ title: 'Allocation Failed', description: error instanceof Error ? error.message : 'Not enough stock available', variant: 'destructive' });
    }
  };

  const renderContent = () => {
    const goBack = () => setCurrentView('dashboard');

    switch (currentView) {
      case 'qr-generator': return <QRCodeGenerator onBack={goBack} />;
      case 'statistics': return <StatisticsDashboard onBack={goBack} />;
      case 'users': return <UserManagement onBack={goBack} />;
      case 'marketplaces': return <MarketplaceManagement onBack={goBack} />;
      case 'inventory': return <InventoryManagement onBack={goBack} />;
      case 'webhooks': return <WebhookEventsViewer onBack={goBack} />;
      case 'partner-registrations': return <PartnerRegistrations onBack={goBack} />;
      case 'external-items': return <ExternalItemsViewer onBack={goBack} />;
      case 'pending-volunteers': return <PendingVolunteers onBack={goBack} />;
      case 'training-assessments': return <TrainingAssessmentBuilder onBack={goBack} />;
      case 'training-completion': return <TrainingCompletionViewer onBack={goBack} />;
      case 'volunteer-qr': return <VolunteerQRCodeGenerator onBack={goBack} />;
      case 'marketplace-sync': return <MarketplaceSyncPanel onBack={goBack} />;
      case 'marketplace-reports': return <MarketplaceReports onBack={goBack} />;
      case 'allocations': return <AllocationManagement onBack={goBack} />;
      case 'volunteer-qr-cards': return <VolunteerQRCardsViewer onBack={goBack} />;
      case 'surpluss-sync': return <SurplussSyncPanel onBack={goBack} />;
      case 'surpluss-allocation-control': return <SurplussAllocationControl onBack={goBack} />;
      case 'hubspot-email-config': return <HubSpotEmailConfig onBack={goBack} />;
      case 'email-logs': return <EmailLogsViewer onBack={goBack} />;
      case 'email-management': return <EmailManagement onBack={goBack} />;
      case 'bulk-volunteer-upload': return <BulkVolunteerUpload onBack={goBack} />;
      case 'traceability-logs': return <TraceabilityLogsViewer onBack={goBack} />;
      case 'email-templates': return <EmailTemplateCenter onBack={goBack} />;
      case 'item-list': return <ItemListViewer onBack={goBack} />;
      case 'surpluss-sync-monitor': return <SurplussSyncMonitor onBack={goBack} />;
      case 'email-campaigns': return <EmailCampaignManager onBack={goBack} />;
      default: return renderDashboardHome();
    }
  };

  const renderDashboardHome = () => (
    <div className="py-4 md:py-6 px-4 max-w-6xl mx-auto">
      {marketplaceStats.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden mb-6">
          <button
            onClick={() => setExpandedSection(expandedSection === 'distribution' ? null : 'distribution')}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Store className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <span className="font-display font-semibold text-sm md:text-base">Distribution by Marketplace</span>
                <span className="text-xs text-muted-foreground ml-2">(click row to expand)</span>
              </div>
            </div>
            {expandedSection === 'distribution' ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
          <AnimatePresence>
            {expandedSection === 'distribution' && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 pt-0">
                  {/* Mobile card view */}
                  <div className="space-y-3 md:hidden">
                    {marketplaceStats.map(mp => {
                      const mpAllocations = allocations.filter(a => a.marketplaceId === mp.id);
                      const isExpanded = expandedMarketplace === mp.id;
                      const pct = mp.allocated > 0 ? Math.round((mp.distributed / mp.allocated) * 100) : 0;
                      return (
                        <div key={mp.id} className="border border-border rounded-lg overflow-hidden">
                          <button
                            onClick={() => setExpandedMarketplace(isExpanded ? null : mp.id)}
                            className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <div className="font-medium text-sm">{mp.name}</div>
                                <div className="text-xs text-muted-foreground">{mp.location}</div>
                              </div>
                              <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div><p className="font-semibold">{mp.allocated.toLocaleString()}</p><p className="text-muted-foreground">Allocated</p></div>
                              <div><p className="font-semibold text-emerald-600">{mp.distributed.toLocaleString()}</p><p className="text-muted-foreground">Distributed</p></div>
                              <div><p className="font-semibold">{mp.remaining.toLocaleString()}</p><p className="text-muted-foreground">Remaining</p></div>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground">{pct}%</span>
                            </div>
                          </button>
                          {isExpanded && mpAllocations.map(alloc => (
                            <div key={alloc.id} className="px-3 py-2 bg-muted/30 border-t border-border/30 flex items-center justify-between text-xs">
                              <span className="truncate">{alloc.itemIcon} {alloc.itemName}</span>
                              <span>{alloc.distributedQuantity}/{alloc.allocatedQuantity}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop table view */}
                  <div className="hidden md:block overflow-x-auto">
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
                                  {alloc.externalMaterialId && (
                                    <span className="text-xs text-muted-foreground/70 ml-2">(ID: {alloc.externalMaterialId})</span>
                                  )}
                                </td>
                                <td className="text-right py-2 px-3">
                                  {editingAllocation?.id === alloc.id && editingAllocation.field === 'allocated' ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <Input
                                        type="number"
                                        value={editingAllocation.value}
                                        onChange={e => setEditingAllocation({ ...editingAllocation, value: e.target.value })}
                                        className="w-20 h-7 text-right text-sm"
                                        autoFocus
                                        onClick={e => e.stopPropagation()}
                                        onKeyDown={e => {
                                          e.stopPropagation();
                                          if (e.key === 'Enter') handleSaveAllocation();
                                          if (e.key === 'Escape') setEditingAllocation(null);
                                        }}
                                      />
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); handleSaveAllocation(); }}>✓</Button>
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); setEditingAllocation(null); }}>✕</Button>
                                    </div>
                                  ) : (
                                    <button onClick={e => { e.stopPropagation(); setEditingAllocation({ id: alloc.id, field: 'allocated', value: alloc.allocatedQuantity.toString() }); }} className="hover:text-primary hover:underline cursor-pointer">
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
                                        onChange={e => setEditingAllocation({ ...editingAllocation, value: e.target.value })}
                                        className="w-20 h-7 text-right text-sm"
                                        autoFocus
                                        onClick={e => e.stopPropagation()}
                                        onKeyDown={e => {
                                          e.stopPropagation();
                                          if (e.key === 'Enter') handleSaveAllocation();
                                          if (e.key === 'Escape') setEditingAllocation(null);
                                        }}
                                      />
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); handleSaveAllocation(); }}>✓</Button>
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={e => { e.stopPropagation(); setEditingAllocation(null); }}>✕</Button>
                                    </div>
                                  ) : (
                                    <button onClick={e => { e.stopPropagation(); setEditingAllocation({ id: alloc.id, field: 'distributed', value: alloc.distributedQuantity.toString() }); }} className="text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer">
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  if (isLoading || allocationsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          onAutoUnblock={handleAutoUnblock}
          onHubspotSync={handleHubspotSync}
          isSyncingHubspot={isSyncingHubspot}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="bg-card border-b border-border sticky top-0 z-20">
            <div className="py-2 md:py-4 px-3 md:px-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <SidebarTrigger className="shrink-0" />
                  <BrandLogo size="md" className="hidden sm:block" />
                  <div className="min-w-0">
                    <h1 className="font-display font-bold text-sm md:text-lg truncate">GIF (Gift it Forward)</h1>
                    <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Admin Dashboard</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={signOut} className="text-xs md:text-sm shrink-0">
                  Sign Out
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            {renderContent()}
          </main>
        </div>
      </div>

      <Dialog open={!!fullEditItem} onOpenChange={open => !open && setFullEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>Update item details below.</DialogDescription>
          </DialogHeader>
          {fullEditItem && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input id="edit-name" value={fullEditItem.name} onChange={e => setFullEditItem({ ...fullEditItem, name: e.target.value })} placeholder="Item name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select value={fullEditItem.category} onValueChange={value => setFullEditItem({ ...fullEditItem, category: value })}>
                  <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Clothing">Clothing</SelectItem>
                    <SelectItem value="Electronics">Electronics</SelectItem>
                    <SelectItem value="Food">Food</SelectItem>
                    <SelectItem value="Furniture">Furniture</SelectItem>
                    <SelectItem value="Household">Household</SelectItem>
                    <SelectItem value="Personal Care">Personal Care</SelectItem>
                    <SelectItem value="Toys">Toys</SelectItem>
                    <SelectItem value="Books">Books</SelectItem>
                    <SelectItem value="Sports">Sports</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-stock">Warehouse Stock</Label>
                <Input id="edit-stock" type="number" value={fullEditItem.totalStock} onChange={e => setFullEditItem({ ...fullEditItem, totalStock: e.target.value })} placeholder="0" />
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

      <AlertDialog open={!!deleteConfirm} onOpenChange={open => { if (!open) { setDeleteConfirm(null); setDeleteInput(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteConfirm?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the item and all its data.
              <br /><br />
              Type <strong>delete</strong> to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={deleteInput} onChange={e => setDeleteInput(e.target.value)} placeholder="Type 'delete' to confirm" className="mt-2" />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteConfirm(null); setDeleteInput(''); }}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDeleteItem} disabled={deleteInput.toLowerCase() !== 'delete' || deleteItemType.isPending}>
              {deleteItemType.isPending ? 'Deleting...' : 'Delete Item'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showAllocationModal} onOpenChange={setShowAllocationModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Allocate Items to Marketplace</DialogTitle>
            <DialogDescription>Select an item type and quantity to assign to a marketplace event</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Item Type</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {itemTypes.map(item => (
                  <button key={item.id} onClick={() => setSelectedItemId(item.id)} className={`p-3 rounded-lg border-2 text-left transition-all ${selectedItemId === item.id ? 'border-primary bg-primary-soft' : 'border-border hover:border-primary/50'}`}>
                    <span className="text-xl mr-2">{item.icon}</span>
                    <span className="text-sm font-medium">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
            {selectedItem && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="text-muted-foreground">
                  Available: <span className="font-semibold text-foreground">{(selectedItem.totalStock - selectedItem.distributed).toLocaleString()}</span> of {selectedItem.totalStock.toLocaleString()}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Select Marketplace Event</Label>
              <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                <SelectTrigger><SelectValue placeholder="Choose an event..." /></SelectTrigger>
                <SelectContent>
                  {marketplaces.map(event => (
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
            <div className="space-y-2">
              <Label>Quantity to Add to Stock</Label>
              <Input type="number" placeholder="Enter quantity..." value={allocationQuantity} onChange={e => setAllocationQuantity(e.target.value)} min={1} />
              <p className="text-xs text-muted-foreground">This will add items to the total stock</p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowAllocationModal(false)}>Cancel</Button>
            <Button onClick={handleAllocate} disabled={!selectedItemId || !selectedEventId || !allocationQuantity || allocateItems.isPending}>
              {allocateItems.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Allocation
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};
