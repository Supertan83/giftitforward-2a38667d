import { motion } from 'framer-motion';
import { ItemType } from '@/types';
import { cn } from '@/lib/utils';

interface ItemCardProps {
  item: ItemType;
  isSelected?: boolean;
  onClick?: () => void;
  showStats?: boolean;
}

export const ItemCard = ({ item, isSelected, onClick, showStats = false }: ItemCardProps) => {
  const available = item.allocatedToMarketplace - item.distributed;
  
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-xl border-2 text-left transition-all duration-200',
        isSelected 
          ? 'border-primary bg-primary-soft shadow-soft' 
          : 'border-border bg-card hover:border-primary/50 hover:shadow-card'
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center text-2xl',
          isSelected ? 'bg-primary/20' : 'bg-muted'
        )}>
          {item.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-semibold text-foreground truncate">
            {item.name}
          </h3>
          {showStats && (
            <p className="text-sm text-muted-foreground">
              {available.toLocaleString()} available
            </p>
          )}
        </div>
        {showStats && (
          <div className="text-right">
            <p className="text-sm font-semibold text-foreground">
              {item.distributed.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">distributed</p>
          </div>
        )}
      </div>
    </motion.button>
  );
};
