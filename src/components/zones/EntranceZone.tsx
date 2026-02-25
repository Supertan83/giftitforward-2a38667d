import { useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, QrCode, Users, Scan, Loader2, MapPin, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRScanner } from '@/components/QRScanner';
import { CardStatusDisplay } from '@/components/CardStatusDisplay';
import { FeedbackOverlay } from '@/components/FeedbackOverlay';
import { StatCard } from '@/components/StatCard';
import { useQRCards, useCardOperations, useMarketplaces } from '@/hooks/useSupabaseData';
import { QRCard } from '@/types';
interface EntranceZoneProps {
  selectedMarketplaceId: string;
}

export const EntranceZone = ({ selectedMarketplaceId }: EntranceZoneProps) => {
  const [showScanner, setShowScanner] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    subtitle?: string;
    credits?: number;
    creditLimit?: number;
  } | null>(null);
  const [lastActivatedCard, setLastActivatedCard] = useState<QRCard | null>(null);
  const [lastCreditLimit, setLastCreditLimit] = useState<number>(15);
  const [isProcessing, setIsProcessing] = useState(false);
  const lastScanRef = useRef<{ code: string; timestamp: number } | null>(null);

  const { data: qrCards = [], isLoading } = useQRCards();
  const { activateCard } = useCardOperations();
  const { data: marketplaces = [] } = useMarketplaces();

  // Get selected marketplace details
  const selectedMarketplace = marketplaces.find(m => m.id === selectedMarketplaceId);
  const creditLimit = selectedMarketplace?.beneficiary_credit_limit ?? 15;

  // Calculate stats - all cards and marketplace-specific
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeCards = qrCards.filter(c => c.status === 'active').length;
    const readyCards = qrCards.filter(c => c.status === 'ready').length;

    // Cards activated today for selected marketplace
    const cardsActivatedTodayForMarketplace = selectedMarketplaceId 
      ? qrCards.filter(c => {
          if (c.marketplaceId !== selectedMarketplaceId) return false;
          if (!c.activatedAt) return false;
          const activatedDate = new Date(c.activatedAt);
          activatedDate.setHours(0, 0, 0, 0);
          return activatedDate.getTime() === today.getTime();
        }).length
      : 0;

    // Total cards for selected marketplace
    const totalForMarketplace = selectedMarketplaceId
      ? qrCards.filter(c => c.marketplaceId === selectedMarketplaceId).length
      : 0;

    return {
      activeCards,
      readyCards,
      cardsActivatedTodayForMarketplace,
      totalForMarketplace,
    };
  }, [qrCards, selectedMarketplaceId]);

  const handleScan = useCallback(async (code: string) => {
    setShowScanner(false);

    // Duplicate scan guard: ignore same card within 5 seconds
    const now = Date.now();
    if (lastScanRef.current && lastScanRef.current.code === code && now - lastScanRef.current.timestamp < 5000) {
      setFeedback({
        type: 'warning',
        title: 'Already Scanned',
        subtitle: 'This card was just processed. Please wait.',
      });
      return;
    }

    setIsProcessing(true);
    lastScanRef.current = { code, timestamp: now };
    try {
      const result = await activateCard.mutateAsync({
        uniqueId: code,
        beneficiaryInfo: {},
        marketplaceId: selectedMarketplaceId || undefined
      });
      
      if (result) {
        const card: QRCard = {
          id: result.id,
          uniqueId: result.unique_id,
          status: 'active',
          creditBalance: result.credit_balance,
          totalItemsCollected: result.total_items_collected,
          transactions: []
        };
        setLastActivatedCard(card);
        setLastCreditLimit(creditLimit);
        setFeedback({
          type: 'success',
          title: 'Card Activated!',
          subtitle: `${creditLimit} Credits Assigned`,
          credits: 0,
          creditLimit,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please check the QR code and try again';
      const isNotFound = message === 'Card not found';
      setFeedback({
        type: isNotFound ? 'error' : 'warning',
        title: isNotFound ? 'Card Not Found' : 'Cannot Activate',
        subtitle: message,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [activateCard, selectedMarketplaceId]);

  return (
    <div className="min-h-full p-4 pb-24 max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 md:mb-6"
      >
        <div className="flex items-center gap-2 text-primary mb-1">
          <LogIn className="w-4 h-4 md:w-5 md:h-5" />
          <span className="text-xs md:text-sm font-medium uppercase tracking-wider">Step 1</span>
        </div>
        <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
          Entrance Zone
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5 md:mt-1">
          Check-in beneficiaries and activate their QR cards
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4 md:mb-6">
        <StatCard
          icon={Users}
          label="Active Cards"
          value={isLoading ? '-' : stats.activeCards}
          variant="success"
        />
        <StatCard
          icon={QrCode}
          label="Cards Ready"
          value={isLoading ? '-' : stats.readyCards}
          variant="default"
        />
      </div>

      {/* Marketplace-specific Stats */}
      {selectedMarketplaceId && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-2 md:gap-3 mb-4 md:mb-6"
        >
          <StatCard
            icon={CalendarCheck}
            label="Today's Check-ins"
            value={isLoading ? '-' : stats.cardsActivatedTodayForMarketplace}
            subValue={selectedMarketplace?.name}
            variant="primary"
          />
          <StatCard
            icon={MapPin}
            label="Total for Marketplace"
            value={isLoading ? '-' : stats.totalForMarketplace}
            subValue="All time"
            variant="warning"
          />
        </motion.div>
      )}

      {/* Main Action */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-6 shadow-card mb-4 md:mb-6"
      >
        <div className="text-center mb-4 md:mb-6">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-primary-soft rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4">
            <Scan className="w-8 h-8 md:w-10 md:h-10 text-primary" />
          </div>
          <h2 className="font-display font-semibold text-base md:text-lg mb-1.5 md:mb-2">
            Ready to Check-In
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground">
            Scan the beneficiary's QR card to activate it with {creditLimit} credits
          </p>
        </div>

        <Button 
          onClick={() => setShowScanner(true)} 
          variant="scan" 
          size="xl" 
          className="w-full"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
          ) : (
            <QrCode className="w-5 h-5 md:w-6 md:h-6" />
          )}
          {isProcessing ? 'Processing...' : 'Scan QR Card'}
        </Button>
      </motion.div>

      {/* Last Activated Card */}
      <AnimatePresence>
        {lastActivatedCard && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Last Activated
            </h3>
            <CardStatusDisplay card={lastActivatedCard} creditLimit={lastCreditLimit} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scanner Modal */}
      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScan}
        title="Activate QR Card"
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
