import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackOverlayProps {
  type: 'success' | 'error' | 'warning';
  title: string;
  subtitle?: string;
  credits?: number;
  creditLimit?: number;
  isVisible: boolean;
  onComplete?: () => void;
}

export const FeedbackOverlay = ({ 
  type, 
  title, 
  subtitle, 
  credits,
  creditLimit,
  isVisible, 
  onComplete 
}: FeedbackOverlayProps) => {
  if (!isVisible) return null;

  const config = {
    success: {
      bg: 'bg-success',
      icon: CheckCircle2,
      iconBg: 'bg-success-foreground/20',
    },
    error: {
      bg: 'bg-danger',
      icon: XCircle,
      iconBg: 'bg-danger-foreground/20',
    },
    warning: {
      bg: 'bg-warning',
      icon: AlertCircle,
      iconBg: 'bg-warning-foreground/20',
    },
  }[type];

  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onAnimationComplete={() => {
        setTimeout(() => onComplete?.(), 1500);
      }}
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        config.bg
      )}
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 400 }}
          className={cn('w-32 h-32 rounded-full mx-auto mb-6 flex items-center justify-center', config.iconBg)}
        >
          <Icon className="w-20 h-20 text-current" strokeWidth={2.5} />
        </motion.div>
        
        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-3xl font-display font-bold mb-2"
        >
          {title}
        </motion.h2>
        
        {subtitle && (
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-xl opacity-90"
          >
            {subtitle}
          </motion.p>
        )}
        
        {credits !== undefined && creditLimit !== undefined && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-6"
          >
            <div className="text-6xl font-display font-bold">
              {creditLimit - credits}/{creditLimit}
            </div>
            <div className="text-lg opacity-80">Credits Remaining</div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
};
