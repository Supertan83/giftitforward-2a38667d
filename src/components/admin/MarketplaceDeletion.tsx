import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Loader2, AlertTriangle, Store, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const selectedMarketplace = marketplaces.find(m => m.id === selectedId);

  useEffect(() => {
    if (!selectedId) {
      setAllocations([]);
      return;
    }
    const fetch = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('marketplace_item_allocations')
          .select('*, item_types(name, icon)')
          .eq('marketplace_id', selectedId)
          .is('deleted_at', null);
        if (error) throw error;
        setAllocations(data || []);
      } catch (err: any) {
        toast({ title: 'Failed to load allocations', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [selectedId]);

  const totalAllocated = allocations.reduce((s, a) => s + (a.allocated_quantity || 0), 0);
  const totalDistributed = allocations.reduce((s, a) => s + (a.distributed_quantity || 0), 0);

  const handleDelete = async () => {
    if (!selectedId) return;
    setDeleting(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('marketplace_item_allocations')
        .update({ deleted_at: now })
        .eq('marketplace_id', selectedId)
        .is('deleted_at', null);
      if (error) throw error;

      toast({
        title: 'Allocations soft-deleted',
        description: `${allocations.length} allocation(s) for ${selectedMarketplace?.name} marked as deleted.`,
      });
      setAllocations([]);
      setShowConfirm(false);
      setConfirmInput('');
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
          <p className="text-sm text-muted-foreground">Soft delete item allocations for a marketplace (marketplace itself is kept)</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Marketplace</CardTitle>
          <CardDescription>Choose the marketplace whose allocations you want to remove.</CardDescription>
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
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Allocations — {selectedMarketplace?.name}
              </CardTitle>
              <CardDescription>
                {allocations.length === 0
                  ? 'No active allocations found for this marketplace.'
                  : `${allocations.length} allocation(s) will be soft-deleted.`}
              </CardDescription>
            </CardHeader>
            {allocations.length > 0 && (
              <CardContent>
                <div className="space-y-2">
                  {allocations.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{a.item_types?.name || 'Unknown'}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Allocated: <strong>{a.allocated_quantity}</strong> · Distributed: <strong>{a.distributed_quantity}</strong>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm font-semibold text-destructive">
                    Total: {totalAllocated} allocated, {totalDistributed} distributed across {allocations.length} item(s)
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {allocations.length > 0 && (
            <div className="flex justify-end">
              <Button variant="destructive" size="lg" onClick={() => setShowConfirm(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Allocations
              </Button>
            </div>
          )}
        </>
      )}

      <AlertDialog open={showConfirm} onOpenChange={open => { if (!open) { setShowConfirm(false); setConfirmInput(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Allocation Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to soft-delete <strong>{allocations.length}</strong> allocation(s) for <strong>{selectedMarketplace?.name}</strong>.
              The marketplace itself will NOT be affected.
              <br /><br />
              Type <strong>DELETE</strong> to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="confirm-delete">Confirmation</Label>
            <Input
              id="confirm-delete"
              value={confirmInput}
              onChange={e => setConfirmInput(e.target.value)}
              placeholder="DELETE"
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmInput !== 'DELETE' || deleting}
            >
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Deleting...</> : 'Confirm Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
