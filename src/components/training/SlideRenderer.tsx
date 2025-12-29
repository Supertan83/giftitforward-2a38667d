import { motion, Variants, Easing } from 'framer-motion';
import { Slide } from './slideData';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useState, useEffect } from 'react';

interface SlideRendererProps {
  slide: Slide;
  onNext: () => void;
  onPrevious: () => void;
  isLast: boolean;
  isFirst: boolean;
}

const SlideRenderer = ({ slide, onNext, onPrevious, isLast, isFirst }: SlideRendererProps) => {
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkOrientation = () => {
      const mobile = window.innerWidth < 768;
      const portrait = window.innerHeight > window.innerWidth;
      setIsMobile(mobile);
      setIsPortrait(mobile && portrait);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const easeOut: Easing = [0.4, 0, 0.2, 1];
  
  const containerVariants: Variants = {
    hidden: { opacity: 0, x: 30 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.4, ease: easeOut }
    },
    exit: { 
      opacity: 0, 
      x: -30,
      transition: { duration: 0.25 }
    }
  };

  // Show rotate prompt for mobile portrait
  if (isPortrait) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full text-white text-center px-6"
      >
        <motion.div
          animate={{ rotate: [0, -90, -90, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
          className="mb-6"
        >
          <RotateCcw className="h-16 w-16 text-[#DA291C]" />
        </motion.div>
        <h2 className="text-xl font-display font-bold mb-3">Rotate Your Device</h2>
        <p className="text-white/70 text-sm max-w-xs">
          For the best training experience, please rotate your device to landscape mode.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="relative w-full h-full flex items-center justify-center"
    >
      {/* Slide Image */}
      <img
        src={slide.image}
        alt={slide.title}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        draggable={false}
      />
      
      {/* Navigation Buttons Overlay */}
      <div className="absolute bottom-4 sm:bottom-8 left-0 right-0 flex justify-between items-center px-4 sm:px-8 md:px-16">
        {/* Previous Button - hidden on first slide */}
        {!isFirst ? (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onPrevious();
            }}
            variant="outline"
            size={isMobile ? "sm" : "default"}
            className="bg-[#54585A] hover:bg-[#3d4042] text-white border-[#54585A] shadow-lg text-xs sm:text-sm"
          >
            <ChevronLeft className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Back</span>
          </Button>
        ) : (
          <div /> // Spacer for layout
        )}

        {/* Next / Get Started / Complete Button */}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          size={isMobile ? "sm" : "default"}
          className="bg-[#DA291C] hover:bg-[#b8221a] text-white shadow-lg text-xs sm:text-sm"
        >
          {isFirst ? (
            'Get Started'
          ) : isLast ? (
            <span className="hidden sm:inline">Complete Training</span>
          ) : (
            <>
              Next
              <ChevronRight className="h-3 w-3 sm:h-4 sm:w-4 ml-0.5 sm:ml-1" />
            </>
          )}
          {isLast && <span className="sm:hidden">Complete</span>}
        </Button>
      </div>
    </motion.div>
  );
};

export default SlideRenderer;
