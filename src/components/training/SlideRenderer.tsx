import { motion, Variants, Easing } from 'framer-motion';
import { Slide } from './slideData';

interface SlideRendererProps {
  slide: Slide;
  onNext: () => void;
  isLast: boolean;
}

const SlideRenderer = ({ slide, onNext, isLast }: SlideRendererProps) => {
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
      className="relative w-full h-full flex items-center justify-center cursor-pointer"
      onClick={onNext}
    >
      {/* Slide Image */}
      <img
        src={slide.image}
        alt={slide.title}
        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        draggable={false}
      />
      
      {/* Click hint overlay - subtle */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.5 }}
        className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/60 bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm"
      >
        {isLast ? 'Click to complete' : 'Click anywhere to continue →'}
      </motion.div>
    </motion.div>
  );
};

export default SlideRenderer;
