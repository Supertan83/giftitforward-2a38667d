// Slide images - first 10 slides
import slide1Hero from '@/assets/training/slide-1-hero.png';
import slide2Gift from '@/assets/training/slide-2-gift.png';
import slide3Impact from '@/assets/training/slide-3-impact.png';
import slide4Circular from '@/assets/training/slide-4-circular.png';
import slide5Matters from '@/assets/training/slide-5-matters.png';
import slide6Principles from '@/assets/training/slide-6-principles.png';
import slide7Everyday from '@/assets/training/slide-7-everyday.png';
import slide8Butterfly from '@/assets/training/slide-8-butterfly.png';
import slide9Engage from '@/assets/training/slide-9-engage.png';
import slide10Value from '@/assets/training/slide-10-value.png';

export interface Slide {
  id: number;
  title: string;
  image: string;
  hasGetStartedButton?: boolean;
  isLastSlide?: boolean;
}

export const slides: Slide[] = [
  {
    id: 1,
    title: 'Your Role in the Circular Economy',
    image: slide1Hero,
    hasGetStartedButton: true,
  },
  {
    id: 2,
    title: 'What is Gift It Forward?',
    image: slide2Gift,
  },
  {
    id: 3,
    title: 'Gift It Forward: Cumulative Impact Over The Years',
    image: slide3Impact,
  },
  {
    id: 4,
    title: 'What is the Circular Economy?',
    image: slide4Circular,
  },
  {
    id: 5,
    title: 'Why this matters',
    image: slide5Matters,
  },
  {
    id: 6,
    title: 'The 3 Principles of a Circular Economy',
    image: slide6Principles,
  },
  {
    id: 7,
    title: 'What this looks like in everyday life',
    image: slide7Everyday,
  },
  {
    id: 8,
    title: 'The Circular Economy in One Picture',
    image: slide8Butterfly,
  },
  {
    id: 9,
    title: 'Ways to engage in the Circular Economy',
    image: slide9Engage,
  },
  {
    id: 10,
    title: 'But where do companies lose the most value?',
    image: slide10Value,
  },
];
