export type SlideType = 'hero' | 'content' | 'statistics' | 'final';

export interface StatItem {
  value: string;
  label: string;
  icon?: string;
}

export interface Slide {
  id: number;
  type: SlideType;
  title: string;
  subtitle?: string;
  content?: string[];
  bulletPoints?: string[];
  stats?: StatItem[];
  imageUrl?: string;
  buttonText?: string;
}

export const slides: Slide[] = [
  {
    id: 1,
    type: 'hero',
    title: 'Your Role in the Circular Economy',
    subtitle: 'CE Module Training',
    content: ['Learn how you can make a difference through Gift It Forward'],
    buttonText: 'Get Started',
  },
  {
    id: 2,
    type: 'content',
    title: 'What is Gift It Forward?',
    content: [
      'Gift It Forward (GIF) is a humanitarian aid distribution program that connects surplus goods with communities in need.',
      'Through our marketplace model, we ensure dignified access to essential items while promoting sustainability.',
    ],
    bulletPoints: [
      'Dignified shopping experience for beneficiaries',
      'Reduces waste by redistributing surplus goods',
      'Empowers communities through choice',
    ],
  },
  {
    id: 3,
    type: 'statistics',
    title: 'Gift It Forward: Cumulative Impact Over The Years',
    subtitle: 'Making a difference together',
    stats: [
      { value: '50,000+', label: 'Items Distributed', icon: '📦' },
      { value: '10,000+', label: 'Families Served', icon: '👨‍👩‍👧‍👦' },
      { value: '500+', label: 'Volunteers', icon: '🤝' },
      { value: '100+', label: 'Partner Organizations', icon: '🏢' },
    ],
  },
  {
    id: 4,
    type: 'content',
    title: 'History of Donation Culture',
    content: [
      'Traditional donation models often lack dignity and choice for recipients.',
      'Gift It Forward transforms this by creating a marketplace experience.',
    ],
    bulletPoints: [
      'From handouts to empowerment',
      'Respecting individual preferences',
      'Building sustainable communities',
    ],
  },
  {
    id: 5,
    type: 'content',
    title: 'Why It Matters',
    content: [
      'Every year, millions of usable items end up in landfills while communities struggle to access basic necessities.',
    ],
    bulletPoints: [
      'Environmental sustainability',
      'Social equity and dignity',
      'Community empowerment',
      'Reducing waste and consumption',
    ],
  },
  {
    id: 6,
    type: 'content',
    title: 'What is The Circular Economy?',
    content: [
      'A circular economy is an economic system aimed at eliminating waste and promoting the continual use of resources.',
    ],
    bulletPoints: [
      'Design out waste and pollution',
      'Keep products and materials in use',
      'Regenerate natural systems',
      'Create value through redistribution',
    ],
  },
  {
    id: 7,
    type: 'content',
    title: 'Product Categories',
    content: [
      'Gift It Forward distributes a wide range of essential items:',
    ],
    bulletPoints: [
      'Clothing and footwear',
      'Household items and furniture',
      'Electronics and appliances',
      'Books and educational materials',
      'Personal care and hygiene products',
    ],
  },
  {
    id: 8,
    type: 'content',
    title: 'Your Role as a Volunteer',
    content: [
      'As a volunteer, you are the heart of Gift It Forward. Your role is crucial in creating a positive experience for beneficiaries.',
    ],
    bulletPoints: [
      'Welcome and guide beneficiaries',
      'Manage QR card check-in/check-out',
      'Assist with item selection',
      'Maintain a dignified environment',
    ],
  },
  {
    id: 9,
    type: 'content',
    title: 'Key Responsibilities',
    content: [
      'Understanding your responsibilities ensures smooth operations:',
    ],
    bulletPoints: [
      'Entrance Zone: Activate cards, assign credits',
      'Marketplace Zone: Assist with selections, process returns',
      'Exit Zone: Complete checkout, reset cards',
      'Always maintain respect and dignity',
    ],
  },
  {
    id: 10,
    type: 'content',
    title: 'Best Practices',
    content: [
      'Follow these guidelines for the best experience:',
    ],
    bulletPoints: [
      'Greet everyone with a smile',
      'Be patient and understanding',
      'Respect cultural differences',
      'Maintain confidentiality',
      'Ask for help when needed',
    ],
  },
  {
    id: 11,
    type: 'final',
    title: 'Ready to Make an Impact?',
    subtitle: 'You are now prepared to start your volunteer journey',
    content: [
      'Thank you for completing the CE Module training.',
      'Your contribution makes a real difference in our community.',
    ],
    buttonText: 'Complete Training',
  },
];
