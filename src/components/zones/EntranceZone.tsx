import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, QrCode, CheckCircle2, Users, Scan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRScanner } from '@/components/QRScanner';
import { CardStatusDisplay } from '@/components/CardStatusDisplay';
import { FeedbackOverlay } from '@/components/FeedbackOverlay';
import { StatCard } from '@/components/StatCard';
import { useAppStore } from '@/store/useAppStore';

export const EntranceZone = () => {
  const [showScanner, setShowScanner] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    subtitle?: string;
    credits?: number;
  } | null>(null);
  const [lastActivatedCard, setLastActivatedCard] = useState<ReturnType<typeof activateCard>>(null);

  const { activateCard, qrCards } = useAppStore();

  const activeCards = qrCards.filter(c => c.status === 'active').length;
  const readyCards = qrCards.filter(c => c.status === 'ready').length;

  const handleScan = useCallback((code: string) => {
    setShowScanner(false);
    const card = activateCard(code);
    
    if (card) {
      setLastActivatedCard(card);
      setFeedback({
        type: 'success',
        title: 'Card Activated!',
        subtitle: '15 Credits Assigned',
        credits: 15,
      });
    } else {
      setFeedback({
        type: 'error',
        title: 'Card Not Found',
        subtitle: 'Please check the QR code and try again',
      });
    }
  }, [activateCard]);

  return (
    <div className="min-h-full p-4 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 text-primary mb-1">
          <LogIn className="w-5 h-5" />
          <span className="text-sm font-medium uppercase tracking-wider">Step 1</span>
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Entrance Zone
        </h1>
        <p className="text-muted-foreground mt-1">
          Check-in beneficiaries and activate their QR cards
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          icon={Users}
          label="Active Cards"
          value={activeCards}
          variant="success"
        />
        <StatCard
          icon={QrCode}
          label="Cards Ready"
          value={readyCards}
          variant="default"
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
          <div className="w-20 h-20 bg-primary-soft rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Scan className="w-10 h-10 text-primary" />
          </div>
          <h2 className="font-display font-semibold text-lg mb-2">
            Ready to Check-In
          </h2>
          <p className="text-sm text-muted-foreground">
            Scan the beneficiary's QR card to activate it with 15 credits
          </p>
        </div>

        <Button 
          onClick={() => setShowScanner(true)} 
          variant="scan" 
          size="xl" 
          className="w-full"
        >
          <QrCode className="w-6 h-6" />
          Scan QR Card
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
            <CardStatusDisplay card={lastActivatedCard} />
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
            isVisible={!!feedback}
            onComplete={() => setFeedback(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
