import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { slides } from './slideData';
import SlideRenderer from './SlideRenderer';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ChevronLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const TrainingSlideshow = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  const progress = ((currentSlide + 1) / slides.length) * 100;
  const isFirstSlide = currentSlide === 0;
  const isLastSlide = currentSlide === slides.length - 1;

  const handleNext = () => {
    if (isLastSlide) {
      // Training complete - placeholder for certification
      toast({
        title: "Training Complete!",
        description: "Congratulations! You've completed the CE Module training. Certification coming soon.",
      });
      navigate('/');
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstSlide) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const handleClose = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header with progress */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            {!isFirstSlide && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevious}
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            <span className="text-sm font-medium text-muted-foreground">
              {currentSlide + 1} of {slides.length}
            </span>
          </div>

          <div className="flex-1 max-w-xs mx-4">
            <Progress value={progress} className="h-2" />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            aria-label="Close training"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Slide content */}
      <main className="flex-1 flex items-center justify-center overflow-hidden">
        <div className="w-full max-w-5xl mx-auto h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              className="h-full"
            >
              <SlideRenderer
                slide={slides[currentSlide]}
                onNext={handleNext}
                isLast={isLastSlide}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Slide indicators */}
      <footer className="py-4 px-4">
        <div className="flex justify-center gap-1.5 max-w-5xl mx-auto">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentSlide 
                  ? 'bg-primary w-6' 
                  : index < currentSlide 
                    ? 'bg-primary/50' 
                    : 'bg-muted'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </footer>
    </div>
  );
};

export default TrainingSlideshow;
