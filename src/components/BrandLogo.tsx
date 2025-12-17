import { cn } from '@/lib/utils';
import SurplussFullLogo from '@/assets/surpluss-full-logo.svg';

type BrandLogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
}

const sizeClasses: Record<BrandLogoSize, string> = {
  sm: 'h-12',
  md: 'h-16 md:h-20',
  lg: 'h-48 md:h-64'
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
