import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Loader2, AlertTriangle, Store, CreditCard, ArrowRightLeft, Package, ScrollText, Users, FileText } from 'lucide-react';
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

const TABLE_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  marketplace_events: { label: 'Marketplace', icon: Store },
  qr_cards: { label: 'QR Cards', icon: CreditCard },
  transactions: { label: 'Transactions', icon: ArrowRightLeft },
  marketplace_item_allocations: { label: 'Item Allocations', icon: Package },
  marketplace_manual_counts: { label: 'Manual Counts', icon: FileText },
  archived_card_data: { label: 'Archived Cards', icon: CreditCard },
  allocation_traceability_logs: { label: 'Traceability Logs', icon: ScrollText },
  volunteer_qr_cards: { label: 'Volunteer QR Cards', icon: Users },
  volunteer_attendance: { label: 'Volunteer Attendance', icon: Users },
  external_survey_responses: { label: 'Survey Responses', icon: FileText },
  pending_beneficiaries: { label: 'Pending Beneficiaries', icon: Users },
};

export const MarketplaceDeletion = ({ onBack }: MarketplaceDeletionProps) => {
  const { toast } = useToast();
  const { data: marketplaces = [] } = useMarketplaces();
  const [selectedId, setSelectedId] = useState<string>('');
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const selectedMarketplace = marketplaces.find(m => m.id === selectedId);

  useEffect(() => {
    if (!selectedId) {
      setStats(null);
      return;
    }
    const fetchPreview = async () => {
      setLoadingPreview(true);
      try {
        const { data, error } = await supabase.functions.invoke('soft-delete-marketplace', {
          body: { marketplace_id: selectedId, mode: 'preview' },
        });
        if (error) throw error;
        setStats(data.stats);
      } catch (err: any) {
        toast({ title: 'Preview failed', description: err.message, variant: 'destructive' });
      } finally {
        setLoadingPreview(false);
      }
    };
    fetchPreview();
  }, [selectedId]);

  const totalRecords = stats ? Object.values(stats).reduce((sum, v) => sum + v, 0) : 0;

  const handleDelete = async () => {
    if (!selectedId || !selectedMarketplace) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('soft-delete-marketplace', {
        body: { marketplace_id: selectedId, mode: 'delete' },
      });
      if (error) throw error;
      const deletedCount = Object.values(data.results as Record<string, number>).reduce((s, v) => s + v, 0);
      toast({
        title: 'Marketplace soft-deleted',
        description: `${selectedMarketplace.name}: ${deletedCount} records marked as deleted.`,
      });
      setSelectedId('');
      setStats(null);
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
          <h2 className="text-2xl font-display font-bold">Marketplace Deletion</h2>
          <p className="text-sm text-muted-foreground">Soft delete a marketplace and all related data</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Marketplace</CardTitle>
          <CardDescription>Choose the marketplace you want to remove. This will NOT permanently delete data — it will be hidden from the UI.</CardDescription>
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

      {loadingPreview && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {stats && !loadingPreview && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Impact Preview — {selectedMarketplace?.name}
              </CardTitle>
              <CardDescription>
                The following records will be soft-deleted (marked with a timestamp, not permanently removed).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(stats).map(([table, count]) => {
                  const meta = TABLE_LABELS[table] || { label: table, icon: FileText };
                  const Icon = meta.icon;
                  return (
                    <div key={table} className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{meta.label}</p>
                        <p className="text-xl font-bold text-foreground">{count.toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm font-semibold text-destructive">
                  Total: {totalRecords.toLocaleString()} records will be soft-deleted
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              variant="destructive"
              size="lg"
              onClick={() => setShowConfirm(true)}
              disabled={totalRecords === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Marketplace
            </Button>
          </div>
        </>
      )}

      <AlertDialog open={showConfirm} onOpenChange={open => { if (!open) { setShowConfirm(false); setConfirmInput(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Soft Delete</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to soft-delete <strong>{selectedMarketplace?.name}</strong> and {totalRecords.toLocaleString()} related records.
              <br /><br />
              Type the marketplace name to confirm:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="confirm-name">Marketplace Name</Label>
            <Input
              id="confirm-name"
              value={confirmInput}
              onChange={e => setConfirmInput(e.target.value)}
              placeholder={selectedMarketplace?.name}
              className="mt-1"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowConfirm(false); setConfirmInput(''); }}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmInput !== selectedMarketplace?.name || deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Confirm Delete'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
