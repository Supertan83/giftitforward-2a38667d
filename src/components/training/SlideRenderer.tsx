import { motion, Variants, Easing } from 'framer-motion';
import { Slide } from './slideData';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SlideRendererProps {
  slide: Slide;
  onNext: () => void;
  onPrevious: () => void;
  isLast: boolean;
  isFirst: boolean;
}

const SlideRenderer = ({ slide, onNext, onPrevious, isLast, isFirst }: SlideRendererProps) => {
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
      <div className="absolute bottom-8 left-0 right-0 flex justify-between items-center px-8 md:px-16">
        {/* Previous Button - hidden on first slide */}
        {!isFirst ? (
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onPrevious();
            }}
            variant="outline"
            className="bg-white/90 hover:bg-white text-gray-800 border-gray-300 shadow-lg backdrop-blur-sm"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
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
          className="bg-[#DA291C] hover:bg-[#b8221a] text-white shadow-lg"
        >
          {isFirst ? (
            'Get Started'
          ) : isLast ? (
            'Complete Training'
          ) : (
            <>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
};

export default SlideRenderer;
