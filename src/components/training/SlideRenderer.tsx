import { motion, Variants, Easing } from 'framer-motion';
import { Slide } from './slideData';
import { Button } from '@/components/ui/button';
import { ArrowRight, CheckCircle } from 'lucide-react';

interface SlideRendererProps {
  slide: Slide;
  onNext: () => void;
  isLast: boolean;
}

const SlideRenderer = ({ slide, onNext, isLast }: SlideRendererProps) => {
  const easeOut: Easing = [0.4, 0, 0.2, 1];
  
  const containerVariants: Variants = {
    hidden: { opacity: 0, x: 50 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { duration: 0.5, ease: easeOut }
    },
    exit: { 
      opacity: 0, 
      x: -50,
      transition: { duration: 0.3 }
    }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.4 }
    })
  };

  if (slide.type === 'hero') {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="flex flex-col items-center justify-center text-center h-full px-6"
      >
        <motion.span 
          custom={0}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="text-primary font-display text-sm uppercase tracking-wider mb-4"
        >
          {slide.subtitle}
        </motion.span>
        <motion.h1 
          custom={1}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground mb-6"
        >
          {slide.title}
        </motion.h1>
        {slide.content?.map((text, i) => (
          <motion.p 
            key={i}
            custom={i + 2}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="text-lg text-muted-foreground max-w-2xl mb-8"
          >
            {text}
          </motion.p>
        ))}
        <motion.div
          custom={4}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
        >
          <Button size="xl" variant="hero" onClick={onNext}>
            {slide.buttonText || 'Get Started'}
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  if (slide.type === 'statistics') {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="flex flex-col h-full px-6 py-8"
      >
        <motion.span 
          custom={0}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="text-primary font-display text-sm uppercase tracking-wider mb-2 text-center"
        >
          {slide.subtitle}
        </motion.span>
        <motion.h2 
          custom={1}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="text-3xl md:text-4xl font-display font-bold text-foreground mb-8 text-center"
        >
          {slide.title}
        </motion.h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 flex-1 items-center max-w-4xl mx-auto w-full">
          {slide.stats?.map((stat, i) => (
            <motion.div
              key={i}
              custom={i + 2}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              className="bg-card border border-border rounded-xl p-6 text-center shadow-card hover:shadow-elevated transition-shadow"
            >
              <span className="text-4xl mb-3 block">{stat.icon}</span>
              <span className="text-2xl md:text-3xl font-display font-bold text-primary block mb-1">
                {stat.value}
              </span>
              <span className="text-sm text-muted-foreground">{stat.label}</span>
            </motion.div>
          ))}
        </div>

        <motion.div
          custom={6}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="flex justify-center mt-8"
        >
          <Button size="lg" onClick={onNext}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  if (slide.type === 'final') {
    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="flex flex-col items-center justify-center text-center h-full px-6"
      >
        <motion.div
          custom={0}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mb-6"
        >
          <CheckCircle className="w-10 h-10 text-success" />
        </motion.div>
        <motion.span 
          custom={1}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="text-primary font-display text-sm uppercase tracking-wider mb-4"
        >
          {slide.subtitle}
        </motion.span>
        <motion.h2 
          custom={2}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-foreground mb-6"
        >
          {slide.title}
        </motion.h2>
        {slide.content?.map((text, i) => (
          <motion.p 
            key={i}
            custom={i + 3}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="text-lg text-muted-foreground max-w-2xl mb-4"
          >
            {text}
          </motion.p>
        ))}
        <motion.div
          custom={5}
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="mt-4"
        >
          <Button size="xl" variant="success" onClick={onNext}>
            {slide.buttonText || 'Complete Training'}
            <CheckCircle className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  // Default content slide
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="flex flex-col h-full px-6 py-8"
    >
      <motion.h2 
        custom={0}
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        className="text-3xl md:text-4xl font-display font-bold text-foreground mb-6 text-center"
      >
        {slide.title}
      </motion.h2>
      
      <div className="flex-1 max-w-3xl mx-auto w-full">
        {slide.content?.map((text, i) => (
          <motion.p 
            key={i}
            custom={i + 1}
            variants={itemVariants}
            initial="hidden"
            animate="visible"
            className="text-lg text-muted-foreground mb-6"
          >
            {text}
          </motion.p>
        ))}
        
        {slide.bulletPoints && (
          <motion.ul className="space-y-3">
            {slide.bulletPoints.map((point, i) => (
              <motion.li
                key={i}
                custom={i + (slide.content?.length || 0) + 1}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                className="flex items-start gap-3 text-foreground"
              >
                <span className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                <span>{point}</span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>

      <motion.div
        custom={10}
        variants={itemVariants}
        initial="hidden"
        animate="visible"
        className="flex justify-center mt-8"
      >
        <Button size="lg" onClick={onNext}>
          {isLast ? 'Complete' : 'Next'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </motion.div>
    </motion.div>
  );
};

export default SlideRenderer;
