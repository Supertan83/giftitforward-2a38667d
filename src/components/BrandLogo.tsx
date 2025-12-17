import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import SurplussFullLogo from '@/assets/surpluss-full-logo.svg';

type BrandLogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
  animate?: boolean;
}

const sizeClasses: Record<BrandLogoSize, string> = {
  sm: 'h-8 md:h-10',
  md: 'h-12 md:h-14',
  lg: 'h-24 md:h-32'
};

export const BrandLogo = ({
  size = 'md',
  className,
  animate = true
}: BrandLogoProps) => {
  if (animate) {
    return (
      <motion.img 
        src={SurplussFullLogo} 
        alt="Surpluss Logo" 
        initial={{ opacity: 0, scale: 0.8, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ 
          type: 'spring', 
          stiffness: 200, 
          damping: 15,
          delay: 0.1 
        }}
        whileHover={{ scale: 1.05 }}
        className={cn(
          sizeClasses[size],
          'w-auto z-10 transition-all duration-300 hover:drop-shadow-[0_0_15px_rgba(32,192,194,0.6)]',
          className
        )}
      />
    );
  }

  return (
    <img 
      src={SurplussFullLogo} 
      alt="Surpluss Logo" 
      className={cn(
        sizeClasses[size],
        'w-auto transition-all duration-300 hover:scale-105 hover:drop-shadow-[0_0_15px_rgba(32,192,194,0.6)] z-10',
        className
      )}
    />
  );
};
