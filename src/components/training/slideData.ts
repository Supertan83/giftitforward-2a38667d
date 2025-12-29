// Slide images - all 20 slides (waiting for final 21-22)
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
import slide11Surplus from '@/assets/training/slide-11-surplus.png';
import slide12Ikea from '@/assets/training/slide-12-ikea.png';
import slide13Loccitane from '@/assets/training/slide-13-loccitane.png';
import slide14Emissions from '@/assets/training/slide-14-emissions.png';
import slide15Scope3 from '@/assets/training/slide-15-scope3.png';
import slide16Waste from '@/assets/training/slide-16-waste.png';
import slide17Workplace from '@/assets/training/slide-17-workplace.png';
import slide18Secondlife from '@/assets/training/slide-18-secondlife.png';
import slide19Solutions from '@/assets/training/slide-19-solutions.png';
import slide20Volunteer from '@/assets/training/slide-20-volunteer.png';

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
  {
    id: 11,
    title: "Surplus Isn't Waste, It's a By-Product of Operations",
    image: slide11Surplus,
  },
  {
    id: 12,
    title: 'Case Study - IKEA',
    image: slide12Ikea,
  },
  {
    id: 13,
    title: "Case Study - L'Occitane",
    image: slide13Loccitane,
  },
  {
    id: 14,
    title: '3 Types of Emissions in a Company',
    image: slide14Emissions,
  },
  {
    id: 15,
    title: 'Understanding Scope 3 Emissions',
    image: slide15Scope3,
  },
  {
    id: 16,
    title: "Surplus isn't just a waste problem",
    image: slide16Waste,
  },
  {
    id: 17,
    title: 'Where Scope 3 Emissions Show Up in Your Workplace',
    image: slide17Workplace,
  },
  {
    id: 18,
    title: 'Giving Items a Second Life Avoids New Carbon Emissions',
    image: slide18Secondlife,
  },
  {
    id: 19,
    title: 'How Second-Life Solutions Reduce Waste and Emissions',
    image: slide19Solutions,
  },
  {
    id: 20,
    title: 'Your Role as a Corporate Volunteer and as a Circular Leader at Work',
    image: slide20Volunteer,
  },
];
