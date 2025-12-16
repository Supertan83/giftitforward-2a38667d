import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, QrCode, CheckCircle, Package, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRScanner } from '@/components/QRScanner';
import { FeedbackOverlay } from '@/components/FeedbackOverlay';
import { StatCard } from '@/components/StatCard';
import { useAppStore } from '@/store/useAppStore';
import { QRCard } from '@/types';

export const ExitZone = () => {
  const [showScanner, setShowScanner] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    subtitle?: string;
  } | null>(null);
  const [lastCheckout, setLastCheckout] = useState<{
    card: QRCard;
    itemsCollected: number;
  } | null>(null);

  const { checkoutCard, qrCards } = useAppStore();

  const checkedOutToday = qrCards.filter(c => c.status === 'checked_out').length;
  const activeCards = qrCards.filter(c => c.status === 'active').length;

  const handleScan = useCallback((code: string) => {
    setShowScanner(false);
    const result = checkoutCard(code);

    if (result.success && result.card) {
      setLastCheckout({
        card: result.card,
        itemsCollected: result.card.totalItemsCollected,
      });
      setFeedback({
        type: 'success',
        title: 'Check-Out Complete!',
        subtitle: `Collected ${result.card.totalItemsCollected}/15 items. Card is ready for reuse.`,
      });
    } else {
      setFeedback({
        type: 'error',
        title: 'Check-Out Failed',
        subtitle: result.message,
      });
    }
  }, [checkoutCard]);

  return (
    <div className="min-h-full p-4 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 text-danger mb-1">
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium uppercase tracking-wider">Step 3</span>
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Exit Zone
        </h1>
        <p className="text-muted-foreground mt-1">
          Check-out beneficiaries and reset their QR cards
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          icon={CheckCircle}
          label="Checked Out"
          value={checkedOutToday}
          variant="success"
        />
        <StatCard
          icon={Package}
          label="Still Active"
          value={activeCards}
          variant="warning"
        />
      </div>

      {/* Main Action */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-2xl border border-border p-6 shadow-card mb-6"
      >
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-danger-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
            <RefreshCcw className="w-10 h-10 text-danger" />
          </div>
          <h2 className="font-display font-semibold text-lg mb-2">
            Ready to Check-Out
          </h2>
          <p className="text-sm text-muted-foreground">
            Scan the beneficiary's QR card to view their summary and reset the card
          </p>
        </div>

        <Button 
          onClick={() => setShowScanner(true)} 
          variant="danger" 
          size="xl" 
          className="w-full"
        >
          <QrCode className="w-6 h-6" />
          Scan to Check-Out
        </Button>
      </motion.div>

      {/* Last Checkout Summary */}
      <AnimatePresence>
        {lastCheckout && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-success-soft rounded-2xl border border-success/20 p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-success/20 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <h3 className="font-display font-semibold">Last Check-Out</h3>
                <p className="text-sm text-muted-foreground font-mono">
                  {lastCheckout.card.uniqueId}
                </p>
              </div>
            </div>
            
            <div className="bg-background/50 rounded-xl p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Items Collected</p>
              <p className="text-4xl font-display font-bold text-success">
                {lastCheckout.itemsCollected}
                <span className="text-lg text-muted-foreground">/15</span>
              </p>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Card has been reset and is ready for the next beneficiary
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
