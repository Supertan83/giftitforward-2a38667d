import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, QrCode, RotateCcw, Package, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRScanner } from '@/components/QRScanner';
import { FeedbackOverlay } from '@/components/FeedbackOverlay';
import { StatCard } from '@/components/StatCard';
import { useCardOperations, useMarketplaces } from '@/hooks/useSupabaseData';
import { useMarketplaceAllocations } from '@/hooks/useMarketplaceAllocations';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

type Mode = 'distribute' | 'return';

interface MarketplaceZoneProps {
  selectedMarketplaceId: string;
}

export const MarketplaceZone = ({ selectedMarketplaceId }: MarketplaceZoneProps) => {
  const [showScanner, setShowScanner] = useState(false);
  const [mode, setMode] = useState<Mode>('distribute');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    subtitle?: string;
    credits?: number;
    creditLimit?: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: allocations = [], isLoading: loadingAllocations } = useMarketplaceAllocations(selectedMarketplaceId || undefined);
  const { distributeItemSimple, returnItemSimple } = useCardOperations();
  const { data: marketplaces = [] } = useMarketplaces();
  const queryClient = useQueryClient();

  const selectedMarketplace = marketplaces.find(m => m.id === selectedMarketplaceId);
  const creditLimit = selectedMarketplace?.beneficiary_credit_limit ?? 15;

  // Calculate totals from allocations
  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedQuantity, 0);
  const totalScanned = allocations.reduce((sum, a) => sum + a.distributedQuantity, 0);

  const handleScan = useCallback(async (code: string) => {
    setShowScanner(false);
    
    if (!selectedMarketplaceId) {
      setFeedback({
        type: 'warning',
        title: 'Select a Marketplace',
        subtitle: 'Please select a marketplace first',
      });
      return;
    }

    setIsProcessing(true);

    try {
      if (mode === 'distribute') {
        const result = await distributeItemSimple.mutateAsync({
          uniqueId: code,
          marketplaceId: selectedMarketplaceId
        });

        // Optimistic update: increment scanned count locally
        queryClient.setQueryData(
          ['marketplace_allocations', selectedMarketplaceId],
          (old: any[] | undefined) => {
            if (!old || old.length === 0) return old;
            const updated = [...old];
            updated[0] = { ...updated[0], distributedQuantity: updated[0].distributedQuantity + 1 };
            return updated;
          }
        );

        setFeedback({
          type: 'success',
          title: 'Item Distributed!',
          subtitle: `Credits remaining: ${creditLimit - result.creditBalance}/${creditLimit}`,
          credits: result.creditBalance,
          creditLimit,
        });
      } else {
        const result = await returnItemSimple.mutateAsync({
          uniqueId: code,
          marketplaceId: selectedMarketplaceId
        });

        // Optimistic update: decrement distributed count locally
        queryClient.setQueryData(
          ['marketplace_allocations', selectedMarketplaceId],
          (old: any[] | undefined) => {
            if (!old) return old;
            const updated = [...old];
            const idx = updated.findIndex(a => a.distributedQuantity > 0);
            if (idx >= 0) {
              updated[idx] = { ...updated[idx], distributedQuantity: updated[idx].distributedQuantity - 1 };
            }
            return updated;
          }
        );

        setFeedback({
          type: 'success',
          title: 'Item Returned!',
          subtitle: `Credits remaining: ${creditLimit - result.creditBalance}/${creditLimit}`,
          credits: result.creditBalance,
          creditLimit,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Operation failed';
      const isLimit = message.includes('LIMIT');
      setFeedback({
        type: isLimit ? 'error' : 'warning',
        title: isLimit ? 'Limit Reached!' : 'Action Failed',
        subtitle: isLimit ? 'Maximum items already collected.' : message,
        credits: isLimit ? creditLimit : undefined,
        creditLimit: isLimit ? creditLimit : undefined,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedMarketplaceId, mode, distributeItemSimple, returnItemSimple, queryClient]);

  const isLoading = loadingAllocations;

  return (
    <div className="min-h-full p-4 pb-24 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 md:mb-6"
      >
        <div className="flex items-center gap-2 text-warning mb-1">
          <ShoppingBag className="w-4 h-4 md:w-5 md:h-5" />
          <span className="text-xs md:text-sm font-medium uppercase tracking-wider">Step 2</span>
        </div>
        <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
          Marketplace
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 md:mt-1">
          Distribute items to beneficiaries
        </p>
      </motion.div>

      {selectedMarketplaceId ? (
        <>
          {/* Stats - Total Allocated & Total Scanned */}
          <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4 md:mb-6">
            <StatCard
              icon={Package}
              label="Total Allocated"
              value={isLoading ? '-' : totalAllocated.toLocaleString()}
              variant="default"
            />
            <StatCard
              icon={ShoppingBag}
              label="Total Scanned"
              value={isLoading ? '-' : totalScanned.toLocaleString()}
              variant="success"
            />
          </div>

          {/* Total Items Display */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-xl p-6 mb-4 text-center shadow-card"
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Package className="w-8 h-8 text-primary" />
            </div>
            <p className="text-4xl font-bold text-foreground mb-1">
              {isLoading ? '-' : totalScanned.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">
              Total Items Scanned
            </p>
          </motion.div>

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setMode('distribute')}
              className={cn(
                'flex-1 py-2 px-3 md:px-4 rounded-md text-xs md:text-sm font-medium transition-all',
                mode === 'distribute' 
                  ? 'bg-primary text-primary-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Package className="w-3 h-3 md:w-4 md:h-4 inline mr-1.5 md:mr-2" />
              Distribute
            </button>
            <button
              onClick={() => setMode('return')}
              className={cn(
                'flex-1 py-2 px-3 md:px-4 rounded-md text-xs md:text-sm font-medium transition-all',
                mode === 'return' 
                  ? 'bg-warning text-warning-foreground shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <RotateCcw className="w-3 h-3 md:w-4 md:h-4 inline mr-1.5 md:mr-2" />
              Return
            </button>
          </div>

          {/* Scan Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="sticky bottom-20 bg-background pt-2"
          >
            <Button 
              onClick={() => setShowScanner(true)} 
              variant={mode === 'distribute' ? 'scan' : 'warning'} 
              size="xl" 
              className="w-full"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <QrCode className="w-6 h-6" />
              )}
              {isProcessing 
                ? 'Processing...'
                : mode === 'distribute'
                  ? 'Scan to Distribute Item'
                  : 'Scan to Return Item'
              }
            </Button>
          </motion.div>
        </>
      ) : (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">Select a marketplace to start distributing</p>
        </div>
      )}

      {/* Scanner Modal */}
      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScan}
        title={`${mode === 'distribute' ? 'Distribute' : 'Return'} Item`}
      />

      {/* Feedback Overlay */}
      <AnimatePresence>
        {feedback && (
          <FeedbackOverlay
            type={feedback.type}
            title={feedback.title}
            subtitle={feedback.subtitle}
            credits={feedback.credits}
            creditLimit={feedback.creditLimit}
            isVisible={!!feedback}
            onComplete={() => setFeedback(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
