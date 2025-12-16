import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, QrCode, RotateCcw, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QRScanner } from '@/components/QRScanner';
import { FeedbackOverlay } from '@/components/FeedbackOverlay';
import { ItemCard } from '@/components/ItemCard';
import { StatCard } from '@/components/StatCard';
import { useAppStore } from '@/store/useAppStore';
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

  const { itemTypes, distributeItem, returnItem } = useAppStore();

  const totalDistributed = itemTypes.reduce((sum, item) => sum + item.distributed, 0);
  const totalAllocated = itemTypes.reduce((sum, item) => sum + item.allocatedToMarketplace, 0);

  const handleScan = useCallback((code: string) => {
    setShowScanner(false);
    
    if (!selectedItemId) {
      setFeedback({
        type: 'warning',
        title: 'Select an Item',
        subtitle: 'Please select an item type first',
      });
      return;
    }

    const result = mode === 'distribute' 
      ? distributeItem(code, selectedItemId)
      : returnItem(code, selectedItemId);

    if (result.success) {
      setFeedback({
        type: 'success',
        title: mode === 'distribute' ? 'Item Distributed!' : 'Item Returned!',
        subtitle: result.message,
        credits: result.card?.creditBalance,
      });
    } else {
      setFeedback({
        type: result.message.includes('LIMIT') ? 'error' : 'warning',
        title: result.message.includes('LIMIT') ? 'Limit Reached!' : 'Action Failed',
        subtitle: result.message,
      });
    }
  }, [selectedItemId, mode, distributeItem, returnItem]);

  const selectedItem = itemTypes.find(i => i.id === selectedItemId);

  return (
    <div className="min-h-full p-4 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 text-warning mb-1">
          <ShoppingBag className="w-5 h-5" />
          <span className="text-sm font-medium uppercase tracking-wider">Step 2</span>
        </div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Marketplace
        </h1>
        <p className="text-muted-foreground mt-1">
          Distribute items to beneficiaries
        </p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          icon={Package}
          label="Distributed"
          value={totalDistributed.toLocaleString()}
          subValue={`of ${totalAllocated.toLocaleString()}`}
          variant="success"
        />
        <StatCard
          icon={ShoppingBag}
          label="Item Types"
          value={itemTypes.length}
          variant="default"
        />
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-4 p-1 bg-muted rounded-lg">
        <button
          onClick={() => setMode('distribute')}
          className={cn(
            'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all',
            mode === 'distribute' 
              ? 'bg-primary text-primary-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Package className="w-4 h-4 inline mr-2" />
          Distribute
        </button>
        <button
          onClick={() => setMode('return')}
          className={cn(
            'flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all',
            mode === 'return' 
              ? 'bg-warning text-warning-foreground shadow-sm' 
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <RotateCcw className="w-4 h-4 inline mr-2" />
          Return
        </button>
      </div>

      {/* Item Selection */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">
          Select Item Type
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {itemTypes.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              isSelected={selectedItemId === item.id}
              onClick={() => setSelectedItemId(item.id)}
            />
          ))}
        </div>
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
          disabled={!selectedItemId}
        >
          <QrCode className="w-6 h-6" />
          {selectedItem 
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
