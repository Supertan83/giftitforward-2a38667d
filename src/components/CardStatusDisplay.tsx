import { motion } from 'framer-motion';
import { QRCard } from '@/types';
import { CreditCard, Package, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardStatusDisplayProps {
  card: QRCard;
  compact?: boolean;
  creditLimit?: number;
}

export const CardStatusDisplay = ({ card, compact = false, creditLimit = 15 }: CardStatusDisplayProps) => {
  const statusConfig = {
    ready: { label: 'Ready', color: 'bg-muted text-muted-foreground' },
    active: { label: 'Active', color: 'bg-success-soft text-success' },
    checked_out: { label: 'Checked Out', color: 'bg-warning-soft text-warning' },
  };

  const status = statusConfig[card.status];
  const creditPercent = creditLimit > 0 ? (card.creditBalance / creditLimit) * 100 : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', status.color)}>
          {status.label}
        </span>
        <span className="text-sm font-mono text-muted-foreground">
          {card.uniqueId}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-4 shadow-card"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <span className="font-mono font-semibold">{card.uniqueId}</span>
        </div>
        <span className={cn('px-3 py-1 rounded-full text-sm font-medium', status.color)}>
          {status.label}
        </span>
      </div>

      {/* Credit Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-muted-foreground">Credits Remaining</span>
          <span className="font-semibold">{card.creditBalance}/{creditLimit}</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${creditPercent}%` }}
            className={cn(
              'h-full rounded-full',
              creditPercent > 50 ? 'bg-success' : creditPercent > 20 ? 'bg-warning' : 'bg-danger'
            )}
          />
        </div>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Package className="w-4 h-4" />
          <span>{card.totalItemsCollected} items collected</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{card.transactions.length} transactions</span>
        </div>
      </div>
    </motion.div>
  );
};
