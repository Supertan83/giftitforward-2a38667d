import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { slides } from './slideData';
import SlideRenderer from './SlideRenderer';
import TrainingQuiz from './TrainingQuiz';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import type { TrainingUserInfo } from '@/pages/TrainingPage';

interface TrainingSlideshowProps {
  userInfo: TrainingUserInfo;
}

const TrainingSlideshow = ({ userInfo }: TrainingSlideshowProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const progress = ((currentSlide + 1) / slides.length) * 100;
  const isFirstSlide = currentSlide === 0;
  const isLastSlide = currentSlide === slides.length - 1;

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      // Show quiz instead of navigating away
      setShowQuiz(true);
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  }, [isLastSlide]);

  const handlePrevious = useCallback(() => {
    if (!isFirstSlide) {
      setCurrentSlide((prev) => prev - 1);
    }
  }, [isFirstSlide]);

  const handleClose = () => {
    // Navigate to completion page instead of home
    navigate('/training/complete');
  };

  const handleQuizComplete = () => {
    navigate('/training/complete');
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrevious]);

  // Show quiz after completing slides
  if (showQuiz) {
    return <TrainingQuiz userInfo={userInfo} onComplete={handleQuizComplete} />;
  }

  return (
    <div className="h-screen bg-[#1a1a1a] flex flex-col overflow-hidden">
      {/* Header with progress */}
      <header className="flex-shrink-0 bg-[#1a1a1a]/95 backdrop-blur border-b border-white/10 px-4 py-2">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              disabled={isFirstSlide}
              className="text-white/70 hover:text-white hover:bg-white/10 disabled:opacity-30"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium text-white/70 min-w-[60px] text-center">
              {currentSlide + 1} / {slides.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="text-white/70 hover:text-white hover:bg-white/10"
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 max-w-md mx-4">
            <Progress value={progress} className="h-1.5 bg-white/10" />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-white/70 hover:text-white hover:bg-white/10"
            aria-label="Close training"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Slide content */}
      <main className="flex-1 min-h-0 flex items-center justify-center p-4">
        <AnimatePresence mode="wait">
          <SlideRenderer
            key={currentSlide}
            slide={slides[currentSlide]}
            onNext={handleNext}
            onPrevious={handlePrevious}
            isLast={isLastSlide}
            isFirst={isFirstSlide}
          />
        </AnimatePresence>
      </main>

      {/* Slide indicators */}
      <footer className="flex-shrink-0 py-3 px-4 bg-[#1a1a1a]">
        <div className="flex justify-center gap-1.5 max-w-7xl mx-auto flex-wrap">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-1.5 rounded-full transition-all ${
                index === currentSlide 
                  ? 'bg-white w-6' 
                  : index < currentSlide 
                    ? 'bg-white/50 w-1.5' 
                    : 'bg-white/20 w-1.5'
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
