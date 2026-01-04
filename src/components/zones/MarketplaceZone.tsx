import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, QrCode, RotateCcw, Package, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRScanner } from '@/components/QRScanner';
import { FeedbackOverlay } from '@/components/FeedbackOverlay';
import { ItemCard } from '@/components/ItemCard';
import { StatCard } from '@/components/StatCard';
import { useItemTypes, useCardOperations } from '@/hooks/useSupabaseData';
import { cn } from '@/lib/utils';

type Mode = 'distribute' | 'return';

export const MarketplaceZone = () => {
  const [showScanner, setShowScanner] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('distribute');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'warning';
    title: string;
    subtitle?: string;
    credits?: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: itemTypes = [], isLoading } = useItemTypes();
  const { distributeItem, returnItem } = useCardOperations();

  const totalDistributed = itemTypes.reduce((sum, item) => sum + item.distributed, 0);
  const totalStock = itemTypes.reduce((sum, item) => sum + item.totalStock, 0);
  const totalAvailable = totalStock - totalDistributed;

  const handleScan = useCallback(async (code: string) => {
    setShowScanner(false);
    
    if (!selectedItemId) {
      setFeedback({
        type: 'warning',
        title: 'Select an Item',
        subtitle: 'Please select an item type first',
      });
      return;
    }

    const selectedItem = itemTypes.find(i => i.id === selectedItemId);
    if (!selectedItem) return;

    setIsProcessing(true);

    try {
      if (mode === 'distribute') {
        const result = await distributeItem.mutateAsync({
          uniqueId: code,
          itemId: selectedItemId,
          itemName: selectedItem.name
        });
        setFeedback({
          type: 'success',
          title: 'Item Distributed!',
          subtitle: `${result.itemName} distributed. Remaining: ${result.creditBalance}/15`,
          credits: result.creditBalance,
        });
      } else {
        const result = await returnItem.mutateAsync({
          uniqueId: code,
          itemId: selectedItemId,
          itemName: selectedItem.name
        });
        setFeedback({
          type: 'success',
          title: 'Item Returned!',
          subtitle: `${result.itemName} returned. Credits restored: ${result.creditBalance}/15`,
          credits: result.creditBalance,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Operation failed';
      setFeedback({
        type: message.includes('LIMIT') ? 'error' : 'warning',
        title: message.includes('LIMIT') ? 'Limit Reached!' : 'Action Failed',
        subtitle: message,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedItemId, mode, itemTypes, distributeItem, returnItem]);

  const selectedItem = itemTypes.find(i => i.id === selectedItemId);

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

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4 md:mb-6">
        <StatCard
          icon={Package}
          label="Distributed"
          value={isLoading ? '-' : totalDistributed.toLocaleString()}
          subValue={`of ${totalStock.toLocaleString()} total`}
          variant="success"
        />
        <StatCard
          icon={ShoppingBag}
          label="Available"
          value={isLoading ? '-' : totalAvailable.toLocaleString()}
          variant="default"
        />
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-3 md:mb-4 p-1 bg-muted rounded-lg">
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

      {/* Item Selection */}
      <div className="mb-4">
        <h3 className="text-xs md:text-sm font-medium text-muted-foreground mb-2 md:mb-3">
          Select Item Type
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : itemTypes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No item types available</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {itemTypes.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                isSelected={selectedItemId === item.id}
                onClick={() => setSelectedItemId(item.id)}
              />
            ))}
          </div>
        )}
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
          disabled={!selectedItemId || isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <QrCode className="w-6 h-6" />
          )}
          {isProcessing 
            ? 'Processing...'
            : selectedItem 
              ? `${mode === 'distribute' ? 'Give' : 'Return'} ${selectedItem.icon} ${selectedItem.name}`
              : 'Select an Item First'
          }
        </Button>
      </motion.div>

      {/* Scanner Modal */}
      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleScan}
        title={`${mode === 'distribute' ? 'Distribute' : 'Return'} ${selectedItem?.name || 'Item'}`}
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
