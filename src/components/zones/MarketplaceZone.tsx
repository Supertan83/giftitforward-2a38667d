import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, QrCode, RotateCcw, Package, Loader2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRScanner } from '@/components/QRScanner';
import { FeedbackOverlay } from '@/components/FeedbackOverlay';
import { StatCard } from '@/components/StatCard';
import { useCardOperations, useMarketplaces } from '@/hooks/useSupabaseData';
import { useMarketplaceDistributionCount } from '@/hooks/useMarketplaceAllocations';
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
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    subtitle?: string;
    credits?: number;
    creditLimit?: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: allocations = [], isLoading: loadingAllocations } = useMarketplaceAllocations(selectedMarketplaceId || undefined);
  const { data: trueDistributionCount = 0, isLoading: loadingCount } = useMarketplaceDistributionCount(selectedMarketplaceId || undefined);
  const { distributeItemSimple, returnItemSimple, distributeItemBatch, returnItemBatch } = useCardOperations();
  const { data: marketplaces = [] } = useMarketplaces();
  const queryClient = useQueryClient();

  const selectedMarketplace = marketplaces.find(m => m.id === selectedMarketplaceId);
  const creditLimit = selectedMarketplace?.beneficiary_credit_limit ?? 15;

  // Calculate totals - use transaction-based count as source of truth for scanned
  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedQuantity, 0);
  const totalScanned = trueDistributionCount;

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
        // Use batch RPC if quantity > 1, otherwise use simple single-item RPC
        const result = quantity > 1
          ? await distributeItemBatch.mutateAsync({
              uniqueId: code,
              marketplaceId: selectedMarketplaceId,
              quantity,
            })
          : await distributeItemSimple.mutateAsync({
              uniqueId: code,
              marketplaceId: selectedMarketplaceId,
            });

        queryClient.invalidateQueries({ queryKey: ['marketplace_distribution_count', selectedMarketplaceId] });

        const distributed = (result as any).quantity ?? 1;
        setFeedback({
          type: 'success',
          title: distributed > 1 ? `${distributed} Items Distributed!` : 'Item Distributed!',
          subtitle: `Credits remaining: ${creditLimit - result.creditBalance}/${creditLimit}`,
          credits: result.creditBalance,
          creditLimit,
        });
      } else {
        const result = quantity > 1
          ? await returnItemBatch.mutateAsync({
              uniqueId: code,
              marketplaceId: selectedMarketplaceId,
              quantity,
            })
          : await returnItemSimple.mutateAsync({
              uniqueId: code,
              marketplaceId: selectedMarketplaceId,
            });

        queryClient.invalidateQueries({ queryKey: ['marketplace_distribution_count', selectedMarketplaceId] });

        const returned = (result as any).quantity ?? 1;
        setFeedback({
          type: 'success',
          title: returned > 1 ? `${returned} Items Returned!` : 'Item Returned!',
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
      setQuantity(1); // Reset quantity after each scan
    }
  }, [selectedMarketplaceId, mode, quantity, distributeItemSimple, returnItemSimple, distributeItemBatch, returnItemBatch, queryClient, creditLimit]);

  const isLoading = loadingAllocations || loadingCount;

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
              onClick={() => { setMode('distribute'); setQuantity(1); }}
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
              onClick={() => { setMode('return'); setQuantity(1); }}
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

          {/* Quantity Selector */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-4 mb-4 shadow-card"
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-3 text-center">
              {mode === 'distribute' ? 'Items to Distribute Per Scan' : 'Items to Return Per Scan'}
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                className="h-16 w-16 rounded-full shrink-0"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="w-7 h-7" />
              </Button>
              <div className="min-w-[4rem] text-center">
                <span className={cn(
                  "text-5xl font-bold tabular-nums",
                  quantity > 1 ? "text-primary" : "text-foreground"
                )}>
                  {quantity}
                </span>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-16 w-16 rounded-full shrink-0"
                onClick={() => setQuantity(q => Math.min(creditLimit, q + 1))}
                disabled={quantity >= creditLimit}
              >
                <Plus className="w-7 h-7" />
              </Button>
            </div>
            {/* Quick-select presets */}
            <div className="flex items-center justify-center gap-2 mt-3">
              {[1, 3, 5, 10].filter(v => v <= creditLimit).map(value => (
                <button
                  key={value}
                  onClick={() => setQuantity(value)}
                  className={cn(
                    "min-h-[44px] min-w-[44px] px-4 rounded-full text-sm font-semibold transition-all",
                    quantity === value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            {quantity > 1 && (
              <p className="text-xs text-primary text-center mt-2 font-medium">
                {mode === 'distribute' ? 'Distributing' : 'Returning'} {quantity} items per scan
              </p>
            )}
          </motion.div>

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
                  ? quantity > 1 ? `Scan to Distribute ${quantity} Items` : 'Scan to Distribute Item'
                  : quantity > 1 ? `Scan to Return ${quantity} Items` : 'Scan to Return Item'
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
        title={`${mode === 'distribute' ? 'Distribute' : 'Return'} ${quantity > 1 ? `${quantity} Items` : 'Item'}`}
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
