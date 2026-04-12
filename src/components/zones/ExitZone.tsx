import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, QrCode, CheckCircle, Package, RefreshCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRScanner } from '@/components/QRScanner';
import { FeedbackOverlay } from '@/components/FeedbackOverlay';
import { StatCard } from '@/components/StatCard';
import { useCardStats, useCardOperations, useMarketplaces } from '@/hooks/useSupabaseData';
import { useQueryClient } from '@tanstack/react-query';

interface ExitZoneProps {
  selectedMarketplaceId: string;
}

export const ExitZone = ({ selectedMarketplaceId }: ExitZoneProps) => {
  const [showScanner, setShowScanner] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    subtitle?: string;
  } | null>(null);
  const [lastCheckout, setLastCheckout] = useState<{
    uniqueId: string;
    itemsCollected: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const { data: cardStats, isLoading } = useCardStats(selectedMarketplaceId);
  const { checkoutCard } = useCardOperations();
  const { data: marketplaces = [] } = useMarketplaces();

  const selectedMarketplace = marketplaces.find(m => m.id === selectedMarketplaceId);
  const creditLimit = selectedMarketplace?.beneficiary_credit_limit ?? 15;

  const handleScan = useCallback(async (code: string) => {
    setShowScanner(false);
    setIsProcessing(true);

    try {
      const result = await checkoutCard.mutateAsync(code);
      const itemsCollected = result.totalCollected;
      
      setLastCheckout({
        uniqueId: code,
        itemsCollected,
      });
      setFeedback({
        type: 'success',
        title: 'Check-Out Complete!',
        subtitle: `Collected ${itemsCollected}/${creditLimit} items. Card is locked until tomorrow.`,
      });
      // Invalidate only lightweight stats
      queryClient.invalidateQueries({ queryKey: ['card_stats', selectedMarketplaceId] });
    } catch (error) {
      setFeedback({
        type: 'error',
        title: 'Check-Out Failed',
        subtitle: error instanceof Error ? error.message : 'Please try again',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [checkoutCard, creditLimit, queryClient, selectedMarketplaceId]);

  return (
    <div className="min-h-full p-4 pb-24 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 md:mb-6"
      >
        <div className="flex items-center gap-2 text-danger mb-1">
          <LogOut className="w-4 h-4 md:w-5 md:h-5" />
          <span className="text-xs md:text-sm font-medium uppercase tracking-wider">Step 3</span>
        </div>
        <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
          Exit Zone
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 md:mt-1">
          Check-out beneficiaries and reset their QR cards
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4 md:mb-6">
        <StatCard
          icon={CheckCircle}
          label="Checked Out"
          value={isLoading ? '-' : cardStats?.checkedOut ?? 0}
          variant="success"
        />
        <StatCard
          icon={Package}
          label="Still Active"
          value={isLoading ? '-' : cardStats?.active ?? 0}
          variant="warning"
        />
      </div>

      {/* Main Action */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-6 shadow-card mb-4 md:mb-6"
      >
        <div className="text-center mb-4 md:mb-6">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-danger-soft rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4">
            <RefreshCcw className="w-8 h-8 md:w-10 md:h-10 text-danger" />
          </div>
          <h2 className="font-display font-semibold text-base md:text-lg mb-1.5 md:mb-2">
            Ready to Check-Out
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            Scan the beneficiary's QR card to view their summary and reset the card
          </p>
        </div>

        <Button 
          onClick={() => setShowScanner(true)} 
          variant="danger" 
          size="xl" 
          className="w-full"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
          ) : (
            <QrCode className="w-5 h-5 md:w-6 md:h-6" />
          )}
          {isProcessing ? 'Processing...' : 'Scan to Check-Out'}
        </Button>
      </motion.div>

      {/* Last Checkout Summary */}
      <AnimatePresence>
        {lastCheckout && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-success-soft rounded-xl md:rounded-2xl border border-success/20 p-4 md:p-6"
          >
            <div className="flex items-center gap-2 md:gap-3 mb-3 md:mb-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-success/20 rounded-lg md:rounded-xl flex items-center justify-center">
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-success" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm md:text-base">Last Check-Out</h3>
                <p className="text-xs md:text-sm text-muted-foreground font-mono">
                  {lastCheckout.uniqueId}
                </p>
              </div>
            </div>
            
            <div className="bg-background/50 rounded-lg md:rounded-xl p-3 md:p-4 text-center">
              <p className="text-xs md:text-sm text-muted-foreground mb-0.5 md:mb-1">Items Collected</p>
              <p className="text-3xl md:text-4xl font-display font-bold text-success">
                {lastCheckout.itemsCollected}
                <span className="text-base md:text-lg text-muted-foreground">/{creditLimit}</span>
              </p>
            </div>

            <p className="text-center text-xs md:text-sm text-muted-foreground mt-3 md:mt-4">
              Card is locked for today and will be available again tomorrow
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanner Modal */}
      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScan}
        title="Check-Out Card"
      />

      {/* Feedback Overlay */}
      <AnimatePresence>
        {feedback && (
          <FeedbackOverlay
            type={feedback.type}
            title={feedback.title}
            subtitle={feedback.subtitle}
            isVisible={!!feedback}
            onComplete={() => setFeedback(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
