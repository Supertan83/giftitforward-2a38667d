import { cn } from '@/lib/utils';
import SurplussLogo from '@/assets/surpluss-logogram.svg';

type BrandLogoSize = 'sm' | 'md' | 'lg';

interface BrandLogoProps {
  size?: BrandLogoSize;
  className?: string;
}

const sizeClasses: Record<BrandLogoSize, string> = {
  sm: 'w-14 h-10 rounded-lg',
  md: 'w-14 h-10 md:w-16 md:h-12 rounded-lg',
  lg: 'w-56 h-20 md:w-72 md:h-24 rounded-2xl',
};

export const BrandLogo = ({ size = 'md', className }: BrandLogoProps) => {
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-brand-teal shadow-[0_4px_20px_-4px_hsl(181_72%_44%/0.4)] transition-all duration-300 hover:scale-105 hover:shadow-[0_6px_28px_-4px_hsl(181_72%_44%/0.5)]',
        sizeClasses[size],
        className
      )}
    >
      <img
        src={SurplussLogo}
        alt="GIF (Gift it Forward)"
        className={cn('w-auto relative z-10', size === 'lg' ? 'h-[90%]' : 'h-[80%]')}
      />
    </div>
  );
};
