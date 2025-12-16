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
        'p-4 rounded-xl border shadow-card',
        variants[variant],
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('p-2.5 rounded-lg', iconVariants[variant])}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground mb-0.5">{label}</p>
          <p className="text-2xl font-display font-bold text-foreground">
            {value}
          </p>
          {subValue && (
            <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};
