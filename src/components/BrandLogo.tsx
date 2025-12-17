import { cn } from '@/lib/utils';
import SurplussFullLogo from '@/assets/surpluss-full-logo.svg';

type BrandLogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
}

const sizeClasses: Record<BrandLogoSize, string> = {
  sm: 'h-24',
  md: 'h-28 md:h-32',
  lg: 'h-52 md:h-64'
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
