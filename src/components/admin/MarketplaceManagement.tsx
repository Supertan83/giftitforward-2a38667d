import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Store, Plus, Loader2, MapPin, Calendar, Clock, Trash2, Pencil, Users, CreditCard, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
'@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter } from
'@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
'@/components/ui/alert-dialog';
import { useMarketplaces, useCreateMarketplace, useDeleteMarketplace, useUpdateMarketplace } from '@/hooks/useSupabaseData';
import { useOutreachPartners } from '@/hooks/useOutreachPartners';
import { OutreachPartnerManager } from '@/components/admin/OutreachPartnerManager';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

interface MarketplaceManagementProps {
  onBack: () => void;
}

const createMarketplaceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  location: z.string().max(200).optional(),
  event_date: z.string().optional(),
  status: z.enum(['upcoming', 'active', 'completed']),
  outreach_partner: z.string().max(200).optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  beneficiary_credit_limit: z.number().int().min(1).max(100).optional()
});

// Helper to format time for display
const formatTime = (time: string | null | undefined) => {
  if (!time) return null;
  // Time comes as HH:MM:SS from database, format as HH:MM AM/PM
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

type StatusFilter = 'all' | 'upcoming' | 'active' | 'completed';

export const MarketplaceManagement = ({ onBack }: MarketplaceManagementProps) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showPartnerManager, setShowPartnerManager] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [editingMarketplace, setEditingMarketplace] = useState<{
    id: string;
    name: string;
    location: string;
    eventDate: string;
    status: 'upcoming' | 'active' | 'completed';
    outreachPartner: string;
    startTime: string;
    endTime: string;
    beneficiaryCreditLimit: number;
    maxItemsPerScan: number;
  } | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [status, setStatus] = useState<'upcoming' | 'active' | 'completed'>('upcoming');
  const [outreachPartner, setOutreachPartner] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [beneficiaryCreditLimit, setBeneficiaryCreditLimit] = useState<number>(15);
  const [maxItemsPerScan, setMaxItemsPerScan] = useState<number>(1);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: marketplaces = [], isLoading } = useMarketplaces();
  const { data: outreachPartners = [] } = useOutreachPartners(true);
  const createMarketplace = useCreateMarketplace();
  const deleteMarketplace = useDeleteMarketplace();
  const updateMarketplace = useUpdateMarketplace();
  const { toast } = useToast();

  // Filter marketplaces based on status filter
  const filteredMarketplaces = useMemo(() => {
    if (statusFilter === 'all') return marketplaces;
    return marketplaces.filter((m) => m.status === statusFilter);
  }, [marketplaces, statusFilter]);

  // Toggle selection for a single marketplace
  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  // Toggle select all (for filtered list)
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredMarketplaces.length && filteredMarketplaces.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMarketplaces.map((m) => m.id)));
    }
  };

  // Get selected marketplaces for display in confirmation dialog
  const selectedMarketplaces = useMemo(() => {
    return marketplaces.filter((m) => selectedIds.has(m.id));
  }, [marketplaces, selectedIds]);

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsDeletingBulk(true);
    let successCount = 0;
    let errorCount = 0;

    for (const id of selectedIds) {
      try {
        await deleteMarketplace.mutateAsync(id);
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`Failed to delete marketplace ${id}:`, error);
      }
    }

    setIsDeletingBulk(false);
    setShowBulkDeleteDialog(false);
    setSelectedIds(new Set());

    if (errorCount === 0) {
      toast({
        title: 'Events Deleted',
        description: `Successfully deleted ${successCount} event${successCount > 1 ? 's' : ''}`
      });
    } else {
      toast({
        title: 'Partial Deletion',
        description: `Deleted ${successCount} events, ${errorCount} failed`,
        variant: 'destructive'
      });
    }
  };

  const handleEdit = (marketplace: {
    id: string;
    name: string;
    location: string | null;
    event_date: string | null;
    status: string;
    outreach_partner: string | null;
    start_time?: string | null;
    end_time?: string | null;
    beneficiary_credit_limit?: number;
  }) => {
    setEditingMarketplace({
      id: marketplace.id,
      name: marketplace.name,
      location: marketplace.location || '',
      eventDate: marketplace.event_date || '',
      status: marketplace.status as 'upcoming' | 'active' | 'completed',
      outreachPartner: marketplace.outreach_partner || '',
      startTime: marketplace.start_time || '',
      endTime: marketplace.end_time || '',
      beneficiaryCreditLimit: marketplace.beneficiary_credit_limit ?? 15,
      maxItemsPerScan: (marketplace as any).max_items_per_scan ?? 1
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingMarketplace) return;

    setErrors({});
    const result = createMarketplaceSchema.safeParse({
      name: editingMarketplace.name,
      location: editingMarketplace.location || undefined,
      event_date: editingMarketplace.eventDate || undefined,
      status: editingMarketplace.status,
      outreach_partner: editingMarketplace.outreachPartner || undefined,
      start_time: editingMarketplace.startTime || undefined,
      end_time: editingMarketplace.endTime || undefined,
      beneficiary_credit_limit: editingMarketplace.beneficiaryCreditLimit
    });

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

    // Determine the original status from the fetched marketplace data
    const originalMarketplace = marketplaces.find((m) => m.id === editingMarketplace.id);
    const originalStatus = originalMarketplace?.status;
    const statusChanged = originalStatus !== editingMarketplace.status;

    // If admin manually changed the status, set the lock flag
    let statusLockedByAdmin: boolean | undefined;
    if (statusChanged) {
      if (editingMarketplace.status === 'completed') {
        statusLockedByAdmin = false; // Release lock so auto-logic can resume
      } else {
        statusLockedByAdmin = true; // Lock it so auto-complete won't override
      }
    }

    try {
      await updateMarketplace.mutateAsync({
        id: editingMarketplace.id,
        name: editingMarketplace.name,
        location: editingMarketplace.location || null,
        event_date: editingMarketplace.eventDate || null,
        status: editingMarketplace.status,
        outreach_partner: editingMarketplace.outreachPartner || null,
        start_time: editingMarketplace.startTime || null,
        end_time: editingMarketplace.endTime || null,
        beneficiary_credit_limit: editingMarketplace.beneficiaryCreditLimit,
        max_items_per_scan: editingMarketplace.maxItemsPerScan,
        ...(statusLockedByAdmin !== undefined && { status_locked_by_admin: statusLockedByAdmin })
      });
      toast({
        title: 'Marketplace Updated',
        description: `${editingMarketplace.name} has been updated`
      });
      setShowEditModal(false);
      setEditingMarketplace(null);
    } catch (error) {
      toast({
        title: 'Failed to Update Marketplace',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const handleCreate = async () => {
    setErrors({});

    const result = createMarketplaceSchema.safeParse({
      name,
      location: location || undefined,
      event_date: eventDate || undefined,
      status,
      outreach_partner: outreachPartner || undefined,
      start_time: startTime || undefined,
      end_time: endTime || undefined,
      beneficiary_credit_limit: beneficiaryCreditLimit
    });

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
      await createMarketplace.mutateAsync({
        name,
        location: location || null,
        event_date: eventDate || null,
        status,
        outreach_partner: outreachPartner || null,
        start_time: startTime || null,
        end_time: endTime || null,
        beneficiary_credit_limit: beneficiaryCreditLimit,
        max_items_per_scan: maxItemsPerScan
      });
      toast({
        title: 'Marketplace Created',
        description: `${name} has been added`
      });
      setShowCreateModal(false);
      setName('');
      setLocation('');
      setEventDate('');
      setStatus('upcoming');
      setOutreachPartner('');
      setStartTime('');
      setEndTime('');
      setBeneficiaryCreditLimit(15);
      setMaxItemsPerScan(1);
    } catch (error) {
      toast({
        title: 'Failed to Create Marketplace',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      await deleteMarketplace.mutateAsync(id);
      toast({
        title: 'Marketplace Deleted',
        description: `${name} has been removed`
      });
    } catch (error) {
      toast({
        title: 'Failed to Delete',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const upcomingCount = marketplaces.filter((m) => m.status === 'upcoming').length;
  const activeCount = marketplaces.filter((m) => m.status === 'active').length;
  const completedCount = marketplaces.filter((m) => m.status === 'completed').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500/20 text-emerald-600 border-emerald-500/30">Active</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      default:
        return <Badge className="bg-primary-soft text-primary border-primary/30">Upcoming</Badge>;
    }
  };

  const isAllSelected = filteredMarketplaces.length > 0 && selectedIds.size === filteredMarketplaces.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < filteredMarketplaces.length;

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
              <h1 className="font-display font-bold text-base md:text-lg truncate">Marketplace Events</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Manage distribution events</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPartnerManager(true)}
              className="hidden md:flex">

              <Settings className="w-4 h-4 mr-2" />
              Manage Partners
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowPartnerManager(true)}
              className="md:hidden">

              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6">
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingCount}</p>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Store className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Calendar className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedCount}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Marketplaces List */}
        <div className="bg-card rounded-xl md:rounded-2xl border border-border shadow-card">
          <div className="p-4 md:p-6 border-b border-border">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="font-display font-bold text-lg">All Events</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {marketplaces.length} total events
                </p>
              </div>
              
              {/* Status Filter Tabs */}
              <Tabs value={statusFilter} onValueChange={(v) => {setStatusFilter(v as StatusFilter);setSelectedIds(new Set());}}>
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="all" className="text-xs sm:text-sm">All ({marketplaces.length})</TabsTrigger>
                  <TabsTrigger value="upcoming" className="text-xs sm:text-sm">Upcoming ({upcomingCount})</TabsTrigger>
                  <TabsTrigger value="active" className="text-xs sm:text-sm">Active ({activeCount})</TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs sm:text-sm">Completed ({completedCount})</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Bulk Actions Bar */}
            {filteredMarketplaces.length > 0 &&
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="flex items-center gap-3">
                  <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all" />

                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                  </span>
                </div>
                
                {selectedIds.size > 0 &&
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
                disabled={isDeletingBulk}>

                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected ({selectedIds.size})
                  </Button>
              }
              </div>
            }
          </div>

          {isLoading ?
          <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div> :
          filteredMarketplaces.length === 0 ?
          <div className="p-8 text-center text-muted-foreground">
              <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No marketplace events {statusFilter !== 'all' ? `with status "${statusFilter}"` : 'yet'}</p>
              {statusFilter === 'all' && <p className="text-sm">Create your first event to get started</p>}
            </div> :

          <div className="divide-y divide-border">
              {filteredMarketplaces.map((marketplace, index) =>
            <motion.div
              key={marketplace.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.02 }}
              className={`p-4 flex items-center justify-between gap-3 ${selectedIds.has(marketplace.id) ? 'bg-primary/5' : ''}`}>

                  <div className="flex items-center gap-3 min-w-0">
                    <Checkbox
                  checked={selectedIds.has(marketplace.id)}
                  onCheckedChange={() => toggleSelection(marketplace.id)}
                  aria-label={`Select ${marketplace.name}`} />

                    <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{marketplace.name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {marketplace.outreach_partner &&
                    <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {marketplace.outreach_partner}
                          </span>
                    }
                        {marketplace.location &&
                    <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {marketplace.location}
                          </span>
                    }
                        {marketplace.event_date &&
                    <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(marketplace.event_date).toLocaleDateString()}
                          </span>
                    }
                        {(marketplace.start_time || marketplace.end_time) &&
                    <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(marketplace.start_time)}{marketplace.start_time && marketplace.end_time && ' - '}{formatTime(marketplace.end_time)}
                          </span>
                    }
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(marketplace.status)}
                    <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                  onClick={() => handleEdit(marketplace)}>

                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(marketplace.id, marketplace.name)}
                  disabled={deleteMarketplace.isPending}>

                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
            )}
            </div>
          }
        </div>
      </main>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Delete {selectedIds.size} Event{selectedIds.size > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>This action cannot be undone. The following events will be permanently deleted:</p>
              <div className="max-h-48 overflow-y-auto bg-muted rounded-lg p-3 space-y-1">
                {selectedMarketplaces.map((m) =>
                <div key={m.id} className="text-sm flex items-center gap-2">
                    <span className="font-medium">{m.name}</span>
                    {m.event_date &&
                  <span className="text-muted-foreground">
                        ({new Date(m.event_date).toLocaleDateString()})
                      </span>
                  }
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingBulk}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeletingBulk}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">

              {isDeletingBulk ?
              <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </> :

              <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete {selectedIds.size} Event{selectedIds.size > 1 ? 's' : ''}
                </>
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Marketplace Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Create Marketplace Event</DialogTitle>
            <DialogDescription>
              Add a new distribution event
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Community Center Distribution"
                value={name}
                onChange={(e) => setName(e.target.value)} />

              {errors.name &&
              <p className="text-sm text-destructive">{errors.name}</p>
              }
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="location"
                  placeholder="e.g., 123 Main Street"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="pl-10" />

              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_date">Event Date</Label>
              <Input
                id="event_date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)} />

            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="start_time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="pl-10" />

                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">End Time</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="end_time"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="pl-10" />

                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="outreach_partner">Outreach Partner</Label>
              <Select value={outreachPartner} onValueChange={setOutreachPartner}>
                <SelectTrigger>
                  <SelectValue placeholder="Select partner..." />
                </SelectTrigger>
                <SelectContent>
                  {outreachPartners.map((partner) =>
                  <SelectItem key={partner.id} value={partner.name}>
                      {partner.name}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="beneficiary_credit_limit">Beneficiary Credit Limit</Label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="beneficiary_credit_limit"
                    type="number"
                    min={15}
                    max={25}
                    value={beneficiaryCreditLimit}
                    onChange={(e) => setBeneficiaryCreditLimit(parseInt(e.target.value) || 15)}
                    className="pl-10" />

                </div>
                <span className="text-sm text-muted-foreground whitespace-nowrap">items/person</span>
              </div>
              <p className="text-xs text-muted-foreground">Default: 15, Range: 15-25</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_items_per_scan">Max Items Per Scan</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="max_items_per_scan"
                  type="number"
                  min={1}
                  max={beneficiaryCreditLimit}
                  value={maxItemsPerScan}
                  onChange={(e) => setMaxItemsPerScan(Math.min(parseInt(e.target.value) || 1, beneficiaryCreditLimit))} />

                <span className="text-sm text-muted-foreground whitespace-nowrap">items/scan</span>
              </div>
              <p className="text-xs text-muted-foreground">Set to 1 to hide quantity selector for volunteers. Range: 1-{beneficiaryCreditLimit}</p>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMarketplace.isPending}>
              {createMarketplace.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Event
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Marketplace Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => {setShowEditModal(open);if (!open) setEditingMarketplace(null);}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Marketplace Event</DialogTitle>
            <DialogDescription>
              Update event details
            </DialogDescription>
          </DialogHeader>

          {editingMarketplace &&
          <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Event Name *</Label>
                <Input
                id="edit-name"
                placeholder="e.g., Community Center Distribution"
                value={editingMarketplace.name}
                onChange={(e) => setEditingMarketplace({ ...editingMarketplace, name: e.target.value })} />

                {errors.name &&
              <p className="text-sm text-destructive">{errors.name}</p>
              }
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                  id="edit-location"
                  placeholder="e.g., 123 Main Street"
                  value={editingMarketplace.location}
                  onChange={(e) => setEditingMarketplace({ ...editingMarketplace, location: e.target.value })}
                  className="pl-10" />

                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-event_date">Event Date</Label>
                <Input
                id="edit-event_date"
                type="date"
                value={editingMarketplace.eventDate}
                onChange={(e) => setEditingMarketplace({ ...editingMarketplace, eventDate: e.target.value })} />

              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-start_time">Start Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                    id="edit-start_time"
                    type="time"
                    value={editingMarketplace.startTime}
                    onChange={(e) => setEditingMarketplace({ ...editingMarketplace, startTime: e.target.value })}
                    className="pl-10" />

                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-end_time">End Time</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                    id="edit-end_time"
                    type="time"
                    value={editingMarketplace.endTime}
                    onChange={(e) => setEditingMarketplace({ ...editingMarketplace, endTime: e.target.value })}
                    className="pl-10" />

                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-outreach_partner">Outreach Partner</Label>
                <Select
                value={editingMarketplace.outreachPartner}
                onValueChange={(v) => setEditingMarketplace({ ...editingMarketplace, outreachPartner: v })}>

                  <SelectTrigger>
                    <SelectValue placeholder="Select partner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {outreachPartners.map((partner) =>
                  <SelectItem key={partner.id} value={partner.name}>
                        {partner.name}
                      </SelectItem>
                  )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-beneficiary_credit_limit">Beneficiary Credit Limit</Label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                    id="edit-beneficiary_credit_limit"
                    type="number"
                    min={15}
                    max={25}
                    value={editingMarketplace.beneficiaryCreditLimit}
                    onChange={(e) => setEditingMarketplace({ ...editingMarketplace, beneficiaryCreditLimit: parseInt(e.target.value) || 15 })}
                    className="pl-10" />

                  </div>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">items/person</span>
                </div>
                <p className="text-xs text-muted-foreground">Default: 15, Range: 15-25</p>
              </div>

              















              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                value={editingMarketplace.status}
                onValueChange={(v) => setEditingMarketplace({ ...editingMarketplace, status: v as 'upcoming' | 'active' | 'completed' })}>

                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          }

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => {setShowEditModal(false);setEditingMarketplace(null);}}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMarketplace.isPending}>
              {updateMarketplace.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Outreach Partner Manager Modal */}
      <OutreachPartnerManager
        isOpen={showPartnerManager}
        onClose={() => setShowPartnerManager(false)} />

    </div>);

};