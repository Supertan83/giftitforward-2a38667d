import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subValue?: string;
  variant?: 'default' | 'primary' | 'warning' | 'success';
  className?: string;
}

export const StatCard = ({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  variant = 'default',
  className 
}: StatCardProps) => {
  const variants = {
    default: 'bg-card border-border',
    primary: 'bg-primary-soft border-primary/20',
    warning: 'bg-warning-soft border-warning/20',
    success: 'bg-success-soft border-success/20',
  };

  const iconVariants = {
    default: 'bg-muted text-muted-foreground',
    primary: 'bg-primary/10 text-primary',
    warning: 'bg-warning/10 text-warning',
    success: 'bg-success/10 text-success',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'p-3 md:p-4 rounded-lg md:rounded-xl border shadow-card',
        variants[variant],
        className
      )}
    >
      <div className="flex items-start gap-2 md:gap-3">
        <div className={cn('p-2 md:p-2.5 rounded-md md:rounded-lg shrink-0', iconVariants[variant])}>
          <Icon className="w-4 h-4 md:w-5 md:h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm text-muted-foreground mb-0.5 truncate">{label}</p>
          <p className="text-xl md:text-2xl font-display font-bold text-foreground">
            {value}
          </p>
          {subValue && (
            <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 truncate">{subValue}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};
