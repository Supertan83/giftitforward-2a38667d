import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Unlock, Calendar, Users, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeedbackOverlay } from '@/components/FeedbackOverlay';
import { useQRCards, useCardOperations, useMarketplaces } from '@/hooks/useSupabaseData';
import { format, isToday, parseISO } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export const UnblockCardsZone = () => {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; title: string; subtitle?: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'today' | 'previous'>('previous');

  const { data: cards = [] } = useQRCards();
  const { data: marketplaces = [] } = useMarketplaces();
  const { unblockCard, bulkUnblockPreviousDays } = useCardOperations();

  // Get blocked cards (active, checked_out, or with marketplace_id)
  const blockedCards = useMemo(() => {
    return cards.filter(card => 
      card.status === 'active' || 
      card.status === 'checked_out' || 
      card.marketplaceId
    );
  }, [cards]);

  // Filter by date
  const filteredCards = useMemo(() => {
    if (filter === 'all') return blockedCards;
    
    return blockedCards.filter(card => {
      if (!card.activatedAt) return filter === 'previous';
      const activatedDate = parseISO(card.activatedAt);
      if (filter === 'today') return isToday(activatedDate);
      return !isToday(activatedDate);
    });
  }, [blockedCards, filter]);

  // Stats
  const stats = useMemo(() => {
    const todayCards = blockedCards.filter(card => 
      card.activatedAt && isToday(parseISO(card.activatedAt))
    );
    const previousCards = blockedCards.filter(card => 
      !card.activatedAt || !isToday(parseISO(card.activatedAt))
    );
    return {
      total: blockedCards.length,
      today: todayCards.length,
      previous: previousCards.length,
    };
  }, [blockedCards]);

  const getMarketplaceName = useCallback((marketplaceId?: string) => {
    if (!marketplaceId) return 'Unknown';
    const marketplace = marketplaces.find(m => m.id === marketplaceId);
    return marketplace?.name || 'Unknown';
  }, [marketplaces]);

  const handleUnblockCard = async (uniqueId: string) => {
    try {
      await unblockCard.mutateAsync(uniqueId);
      setFeedback({ type: 'success', title: 'Card Unblocked!', subtitle: uniqueId });
    } catch (error) {
      setFeedback({ 
        type: 'error', 
        title: 'Unblock Failed',
        subtitle: error instanceof Error ? error.message : 'Failed to unblock card' 
      });
    }
  };

  const handleBulkUnblock = async () => {
    setIsProcessing(true);
    try {
      const result = await bulkUnblockPreviousDays.mutateAsync();
      setFeedback({ 
        type: 'success', 
        title: 'Bulk Unblock Complete!', 
        subtitle: `${result.unblocked} cards from previous days unblocked` 
      });
    } catch (error) {
      setFeedback({ 
        type: 'error', 
        title: 'Bulk Unblock Failed',
        subtitle: error instanceof Error ? error.message : 'Failed to unblock cards' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-warning/10 mb-3">
          <Unlock className="w-6 h-6 text-warning" />
        </div>
        <h2 className="text-xl font-display font-bold">Unblock QR Cards</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Reset cards for reuse • Auto-unblocks at midnight
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg border bg-card"
        >
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-destructive" />
            <span className="text-xs text-muted-foreground">Total Blocked</span>
          </div>
          <p className="text-xl font-bold">{stats.total}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-3 rounded-lg border bg-card"
        >
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-warning" />
            <span className="text-xs text-muted-foreground">Today</span>
          </div>
          <p className="text-xl font-bold">{stats.today}</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-3 rounded-lg border bg-card"
        >
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-success" />
            <span className="text-xs text-muted-foreground">Previous</span>
          </div>
          <p className="text-xl font-bold">{stats.previous}</p>
        </motion.div>
      </div>

      {/* Bulk Unblock Button */}
      {stats.previous > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
        >
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="w-full h-14 text-base font-semibold bg-success hover:bg-success/90"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Calendar className="w-5 h-5 mr-2" />
                )}
                Unblock All Previous Day Cards ({stats.previous})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Unblock All Previous Day Cards</AlertDialogTitle>
                <AlertDialogDescription>
                  This will unblock {stats.previous} cards from previous days, 
                  making them available for reuse at future events.
                  <br /><br />
                  Cards used today will not be affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkUnblock} className="bg-success hover:bg-success/90">
                  Unblock {stats.previous} Cards
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Show:</span>
        <Select value={filter} onValueChange={(v) => setFilter(v as 'all' | 'today' | 'previous')}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="previous">Previous ({stats.previous})</SelectItem>
            <SelectItem value="today">Today ({stats.today})</SelectItem>
            <SelectItem value="all">All ({stats.total})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Blocked Cards List */}
      <div className="space-y-2">
        <AnimatePresence>
          {filteredCards.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8 text-muted-foreground"
            >
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-success" />
              <p>No blocked cards to show</p>
            </motion.div>
          ) : (
            filteredCards.slice(0, 50).map((card, index) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.02 }}
                className="flex items-center justify-between p-3 bg-card rounded-lg border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium truncate">
                      {card.uniqueId}
                    </span>
                    <Badge variant={card.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                      {card.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {getMarketplaceName(card.marketplaceId)}
                    {card.activatedAt && (
                      <> • {format(parseISO(card.activatedAt), 'MMM d, HH:mm')}</>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUnblockCard(card.uniqueId)}
                  className="ml-2 gap-1"
                >
                  <Unlock className="w-4 h-4" />
                  Unblock
                </Button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        
        {filteredCards.length > 50 && (
          <p className="text-center text-sm text-muted-foreground py-2">
            Showing 50 of {filteredCards.length} cards. Use bulk unblock for all.
          </p>
        )}
      </div>

      {/* Feedback Overlay */}
      <FeedbackOverlay
        type={feedback?.type || 'success'}
        title={feedback?.title || ''}
        subtitle={feedback?.subtitle}
        isVisible={!!feedback}
        onComplete={() => setFeedback(null)}
      />
    </div>
  );
};
