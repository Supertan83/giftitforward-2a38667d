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
  lg: 'w-56 h-20 md:w-72 md:h-24 rounded-2xl'
};
export const BrandLogo = ({
  size = 'md',
  className
}: BrandLogoProps) => {
  return;
};