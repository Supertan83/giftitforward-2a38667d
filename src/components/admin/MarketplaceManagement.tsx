import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Store, Plus, Loader2, MapPin, Calendar, Clock, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useMarketplaces, useCreateMarketplace, useDeleteMarketplace, useUpdateMarketplace } from '@/hooks/useSupabaseData';
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
});

export const MarketplaceManagement = ({ onBack }: MarketplaceManagementProps) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMarketplace, setEditingMarketplace] = useState<{ id: string; name: string; location: string; eventDate: string; status: 'upcoming' | 'active' | 'completed' } | null>(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [status, setStatus] = useState<'upcoming' | 'active' | 'completed'>('upcoming');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: marketplaces = [], isLoading } = useMarketplaces();
  const createMarketplace = useCreateMarketplace();
  const deleteMarketplace = useDeleteMarketplace();
  const updateMarketplace = useUpdateMarketplace();
  const { toast } = useToast();

  const handleEdit = (marketplace: { id: string; name: string; location: string | null; event_date: string | null; status: string }) => {
    setEditingMarketplace({
      id: marketplace.id,
      name: marketplace.name,
      location: marketplace.location || '',
      eventDate: marketplace.event_date || '',
      status: marketplace.status as 'upcoming' | 'active' | 'completed',
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
      status: editingMarketplace.status 
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
      await updateMarketplace.mutateAsync({
        id: editingMarketplace.id,
        name: editingMarketplace.name,
        location: editingMarketplace.location || null,
        event_date: editingMarketplace.eventDate || null,
        status: editingMarketplace.status,
      });
      toast({
        title: 'Marketplace Updated',
        description: `${editingMarketplace.name} has been updated`,
      });
      setShowEditModal(false);
      setEditingMarketplace(null);
    } catch (error) {
      toast({
        title: 'Failed to Update Marketplace',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleCreate = async () => {
    setErrors({});
    
    const result = createMarketplaceSchema.safeParse({ 
      name, 
      location: location || undefined, 
      event_date: eventDate || undefined, 
      status 
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
      });
      toast({
        title: 'Marketplace Created',
        description: `${name} has been added`,
      });
      setShowCreateModal(false);
      setName('');
      setLocation('');
      setEventDate('');
      setStatus('upcoming');
    } catch (error) {
      toast({
        title: 'Failed to Create Marketplace',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    
    try {
      await deleteMarketplace.mutateAsync(id);
      toast({
        title: 'Marketplace Deleted',
        description: `${name} has been removed`,
      });
    } catch (error) {
      toast({
        title: 'Failed to Delete',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const upcomingCount = marketplaces.filter(m => m.status === 'upcoming').length;
  const activeCount = marketplaces.filter(m => m.status === 'active').length;
  const completedCount = marketplaces.filter(m => m.status === 'completed').length;

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
            <Button onClick={() => setShowCreateModal(true)} size="sm" className="shrink-0">
              <Plus className="w-4 h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Add Event</span>
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
            <h2 className="font-display font-bold text-lg">All Events</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {marketplaces.length} total events
            </p>
          </div>

          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
            </div>
          ) : marketplaces.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Store className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No marketplace events yet</p>
              <p className="text-sm">Create your first event to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {marketplaces.map((marketplace, index) => (
                <motion.div
                  key={marketplace.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center shrink-0">
                      <Store className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{marketplace.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {marketplace.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {marketplace.location}
                          </span>
                        )}
                        {marketplace.event_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(marketplace.event_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(marketplace.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-primary"
                      onClick={() => handleEdit(marketplace)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(marketplace.id, marketplace.name)}
                      disabled={deleteMarketplace.isPending}
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
                onChange={(e) => setName(e.target.value)}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
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
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event_date">Event Date</Label>
              <Input
                id="event_date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
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
      <Dialog open={showEditModal} onOpenChange={(open) => { setShowEditModal(open); if (!open) setEditingMarketplace(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Edit Marketplace Event</DialogTitle>
            <DialogDescription>
              Update event details
            </DialogDescription>
          </DialogHeader>

          {editingMarketplace && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Event Name *</Label>
                <Input
                  id="edit-name"
                  placeholder="e.g., Community Center Distribution"
                  value={editingMarketplace.name}
                  onChange={(e) => setEditingMarketplace({ ...editingMarketplace, name: e.target.value })}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name}</p>
                )}
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
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-event_date">Event Date</Label>
                <Input
                  id="edit-event_date"
                  type="date"
                  value={editingMarketplace.eventDate}
                  onChange={(e) => setEditingMarketplace({ ...editingMarketplace, eventDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={editingMarketplace.status} 
                  onValueChange={(v) => setEditingMarketplace({ ...editingMarketplace, status: v as 'upcoming' | 'active' | 'completed' })}
                >
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
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => { setShowEditModal(false); setEditingMarketplace(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateMarketplace.isPending}>
              {updateMarketplace.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
