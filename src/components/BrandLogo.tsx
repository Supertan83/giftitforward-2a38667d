import { cn } from '@/lib/utils';
import SurplussFullLogo from '@/assets/surpluss-full-logo.svg';

type BrandLogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
}

const sizeClasses: Record<BrandLogoSize, string> = {
  sm: 'h-10',
  md: 'h-10 md:h-12',
  lg: 'h-20 md:h-24'
};

export const BrandLogo = ({
  size = 'md',
  className
}: BrandLogoProps) => {
  return (
    <img 
      src={SurplussFullLogo} 
      alt="Surpluss Logo" 
      className={cn(
        sizeClasses[size],
        'w-auto transition-transform duration-200 hover:scale-105 z-10',
        className
      )}
    />
  );
};
