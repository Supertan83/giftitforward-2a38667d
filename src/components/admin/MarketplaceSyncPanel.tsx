import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Archive, AlertTriangle, CheckCircle, Calendar, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useMarketplaces, useMarketplaceSyncOperations, useArchivedCardData, useQRCards } from '@/hooks/useSupabaseData';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MarketplaceSyncPanelProps {
  onBack: () => void;
}

export const MarketplaceSyncPanel = ({ onBack }: MarketplaceSyncPanelProps) => {
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { toast } = useToast();
  const { data: marketplaces = [] } = useMarketplaces();
  const { data: qrCards = [] } = useQRCards();
  const { data: archivedData = [] } = useArchivedCardData(selectedMarketplace || undefined);
  const { archiveAndResetCards, resetAllCardsForMarketplace } = useMarketplaceSyncOperations();

  const activeCards = qrCards.filter(c => c.status === 'active');
  const usedCards = qrCards.filter(c => c.marketplaceId);

  const handleArchiveAndReset = async () => {
    if (!selectedMarketplace) return;
    
    setIsProcessing(true);
    setShowArchiveConfirm(false);
    
    try {
      const result = await archiveAndResetCards.mutateAsync(selectedMarketplace);
      toast({
        title: 'Sync Complete',
        description: `${result.archivedCount} cards archived and reset for reuse.`
      });
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: error instanceof Error ? error.message : 'Failed to archive and reset cards',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetAll = async () => {
    setIsProcessing(true);
    setShowResetAllConfirm(false);
    
    try {
      const result = await resetAllCardsForMarketplace.mutateAsync();
      toast({
        title: 'Reset Complete',
        description: `${result.resetCount} cards have been reset for reuse.`
      });
    } catch (error) {
      toast({
        title: 'Reset Failed',
        description: error instanceof Error ? error.message : 'Failed to reset cards',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedMarketplaceData = marketplaces.find(m => m.id === selectedMarketplace);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Marketplace Sync & Reset</h1>
          <p className="text-sm text-muted-foreground">Archive data and reset QR cards between marketplaces</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-primary mb-1">
            <Users className="w-4 h-4" />
            <span className="text-sm font-medium">Active Cards</span>
          </div>
          <p className="text-2xl font-bold">{activeCards.length}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-amber-500 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">Used Cards</span>
          </div>
          <p className="text-2xl font-bold">{usedCards.length}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-green-500 mb-1">
            <Archive className="w-4 h-4" />
            <span className="text-sm font-medium">Archived Records</span>
          </div>
          <p className="text-2xl font-bold">{archivedData.length}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-2 text-blue-500 mb-1">
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium">Marketplaces</span>
          </div>
          <p className="text-2xl font-bold">{marketplaces.length}</p>
        </motion.div>
      </div>

      {/* Marketplace Selection */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-card border border-border rounded-xl p-4 md:p-6 mb-6"
      >
        <h2 className="font-semibold mb-4">Select Marketplace to Sync</h2>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Select value={selectedMarketplace} onValueChange={setSelectedMarketplace}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a marketplace..." />
              </SelectTrigger>
              <SelectContent>
                {marketplaces.map((mp) => (
                  <SelectItem key={mp.id} value={mp.id}>
                    <div className="flex items-center gap-2">
                      <span>{mp.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {mp.status}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {selectedMarketplaceData && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {selectedMarketplaceData.location || 'No location'}
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {selectedMarketplaceData.event_date 
                  ? format(new Date(selectedMarketplaceData.event_date), 'MMM d, yyyy')
                  : 'No date'
                }
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            onClick={() => setShowArchiveConfirm(true)}
            disabled={!selectedMarketplace || isProcessing}
            className="flex-1 md:flex-none"
          >
            <Archive className="w-4 h-4 mr-2" />
            Archive & Reset Cards
          </Button>
          <Button
            variant="destructive"
            onClick={() => setShowResetAllConfirm(true)}
            disabled={isProcessing}
            className="flex-1 md:flex-none"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset All Cards
          </Button>
        </div>
      </motion.div>

      {/* Archived Data Table */}
      {archivedData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card border border-border rounded-xl overflow-hidden"
        >
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold">Archived Data</h2>
            <p className="text-sm text-muted-foreground">Historical beneficiary data from completed marketplaces</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Card ID</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Nationality</TableHead>
                <TableHead>Items Collected</TableHead>
                <TableHead>Archived At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {archivedData.slice(0, 20).map((record: any) => (
                <TableRow key={record.id}>
                  <TableCell className="font-mono text-sm">{record.unique_id}</TableCell>
                  <TableCell>{record.marketplace_events?.name || '-'}</TableCell>
                  <TableCell>{record.gender || '-'}</TableCell>
                  <TableCell>{record.nationality || '-'}</TableCell>
                  <TableCell>{record.total_items_collected || 0}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(record.archived_at), 'MMM d, HH:mm')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {archivedData.length > 20 && (
            <div className="p-4 text-center text-sm text-muted-foreground border-t border-border">
              Showing 20 of {archivedData.length} records
            </div>
          )}
        </motion.div>
      )}

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive & Reset Cards?</AlertDialogTitle>
            <AlertDialogDescription>
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Archive all beneficiary data from this marketplace</li>
                <li>Reset card status to inactive</li>
                <li>Clear demographic and collected items data</li>
                <li>Make cards available for reuse at the next marketplace</li>
              </ul>
              <p className="mt-3 text-amber-500 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveAndReset}>
              <Archive className="w-4 h-4 mr-2" />
              Archive & Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset All Confirmation Dialog */}
      <AlertDialog open={showResetAllConfirm} onOpenChange={setShowResetAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Used Cards?</AlertDialogTitle>
            <AlertDialogDescription>
              <p className="text-destructive font-medium flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" />
                Warning: This will NOT archive data!
              </p>
              This will reset all cards that have been used without saving their data. 
              Use "Archive & Reset" instead if you want to preserve the data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetAll} className="bg-destructive hover:bg-destructive/90">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
