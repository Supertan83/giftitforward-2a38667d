import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Loader2, Store, Package, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useMarketplaces } from '@/hooks/useSupabaseData';

interface MarketplaceDeletionProps {
  onBack: () => void;
}

export const MarketplaceDeletion = ({ onBack }: MarketplaceDeletionProps) => {
  const { toast } = useToast();
  const { data: marketplaces = [] } = useMarketplaces();
  const [selectedId, setSelectedId] = useState<string>('');
  const [allocations, setAllocations] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const selectedMarketplace = marketplaces.find(m => m.id === selectedId);

  const fetchAllocations = async () => {
    if (!selectedId) { setAllocations([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('marketplace_item_allocations')
        .select('*, item_types(name, icon)')
        .eq('marketplace_id', selectedId)
        .is('deleted_at', null);
      if (error) throw error;
      setAllocations(data || []);
      setSelectedIds(new Set());
    } catch (err: any) {
      toast({ title: 'Failed to load allocations', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAllocations(); }, [selectedId]);

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === allocations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allocations.map(a => a.id)));
    }
  };

  const selectedAllocations = allocations.filter(a => selectedIds.has(a.id));
  const totalAllocated = selectedAllocations.reduce((s, a) => s + (a.allocated_quantity || 0), 0);
  const totalDistributed = selectedAllocations.reduce((s, a) => s + (a.distributed_quantity || 0), 0);

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('marketplace_item_allocations')
        .update({ deleted_at: now })
        .in('id', Array.from(selectedIds));
      if (error) throw error;

      toast({
        title: 'Allocations soft-deleted',
        description: `${selectedIds.size} allocation(s) marked as deleted.`,
      });
      setShowConfirm(false);
      setConfirmInput('');
      fetchAllocations();
    } catch (err: any) {
      toast({ title: 'Deletion failed', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-display font-bold">Allocation Deletion</h2>
          <p className="text-sm text-muted-foreground">Select and soft-delete individual item allocations</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Marketplace</CardTitle>
          <CardDescription>Choose the marketplace whose allocations you want to manage.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Choose a marketplace..." />
            </SelectTrigger>
            <SelectContent>
              {marketplaces.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex items-center gap-2">
                    <Store className="h-4 w-4 text-muted-foreground" />
                    <span>{m.name}</span>
                    {m.event_date && <span className="text-xs text-muted-foreground">({m.event_date})</span>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && selectedId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Allocations — {selectedMarketplace?.name}
                </CardTitle>
                <CardDescription>
                  {allocations.length === 0
                    ? 'No active allocations found.'
                    : `${allocations.length} allocation(s) · ${selectedIds.size} selected`}
                </CardDescription>
              </div>
              {allocations.length > 0 && (
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedIds.size === allocations.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
          </CardHeader>
          {allocations.length > 0 && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {allocations.map(a => {
                  const checked = selectedIds.has(a.id);
                  return (
                    <label
                      key={a.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${checked ? 'bg-destructive/5 border-destructive/30' : 'bg-muted/30 hover:bg-muted/50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox checked={checked} onCheckedChange={() => toggleId(a.id)} />
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{a.item_types?.name || 'Unknown'}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Allocated: <strong>{a.allocated_quantity}</strong> · Distributed: <strong>{a.distributed_quantity}</strong>
                      </div>
                    </label>
                  );
                })}
              </div>

              {selectedIds.size > 0 && (
                <>
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm font-semibold text-destructive">
                      {selectedIds.size} item(s) selected — {totalAllocated} allocated, {totalDistributed} distributed
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="destructive" onClick={() => setShowConfirm(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected ({selectedIds.size})
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          )}
        </Card>
      )}

      <AlertDialog open={showConfirm} onOpenChange={open => { if (!open) { setShowConfirm(false); setConfirmInput(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Allocation Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to soft-delete <strong>{selectedIds.size}</strong> allocation(s) for <strong>{selectedMarketplace?.name}</strong>.
              <br /><br />
              Type <strong>DELETE</strong> to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="confirm-delete">Confirmation</Label>
            <Input id="confirm-delete" value={confirmInput} onChange={e => setConfirmInput(e.target.value)} placeholder="DELETE" className="mt-1" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={confirmInput !== 'DELETE' || deleting}>
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</> : 'Confirm Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
