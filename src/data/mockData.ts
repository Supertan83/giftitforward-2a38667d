import { QRCard, ItemType, User, MarketplaceEvent } from '@/types';

export const mockUser: User = {
  id: '1',
  name: 'Ahmed Hassan',
  email: 'ahmed@charity.org',
  role: 'volunteer',
  currentLocation: 'Entrance Zone',
};

export const mockAdmin: User = {
  id: '2',
  name: 'Sarah Manager',
  email: 'sarah@charity.org',
  role: 'admin',
  currentLocation: 'Admin Office',
};

export const mockMarketplaceEvents: MarketplaceEvent[] = [
  { id: '1', name: 'National Charity School - Dubai', date: 'Jan 15, 2024', location: 'Dubai', status: 'completed' },
  { id: '2', name: 'Community Center - Abu Dhabi', date: 'Jan 22, 2024', location: 'Abu Dhabi', status: 'active' },
  { id: '3', name: 'Relief Distribution - Sharjah', date: 'Feb 5, 2024', location: 'Sharjah', status: 'upcoming' },
];

export const mockQRCards: QRCard[] = [
  { id: '1', uniqueId: 'QR-001-ABC', status: 'ready', creditBalance: 0, totalItemsCollected: 0, transactions: [] },
  { id: '2', uniqueId: 'QR-002-DEF', status: 'active', creditBalance: 12, totalItemsCollected: 3, transactions: [] },
  { id: '3', uniqueId: 'QR-003-GHI', status: 'active', creditBalance: 8, totalItemsCollected: 7, transactions: [] },
  { id: '4', uniqueId: 'QR-004-JKL', status: 'ready', creditBalance: 0, totalItemsCollected: 0, transactions: [] },
  { id: '5', uniqueId: 'QR-005-MNO', status: 'checked_out', creditBalance: 0, totalItemsCollected: 15, transactions: [] },
  { id: '6', uniqueId: 'DEMO-CARD', status: 'ready', creditBalance: 0, totalItemsCollected: 0, transactions: [] },
];

export const mockItemTypes: ItemType[] = [
  { id: '1', name: 'Duvet', icon: '🛏️', totalStock: 1000, distributed: 127 },
  { id: '2', name: 'Chinaware', icon: '🍽️', totalStock: 3500, distributed: 892 },
  { id: '3', name: 'Kitchen Items', icon: '🍳', totalStock: 2000, distributed: 456 },
  { id: '4', name: 'Toys', icon: '🧸', totalStock: 12000, distributed: 3421 },
  { id: '5', name: 'Men Clothing', icon: '👔', totalStock: 6000, distributed: 1876 },
  { id: '6', name: 'Women Clothing', icon: '👗', totalStock: 5000, distributed: 1543 },
  { id: '7', name: 'Kettles', icon: '☕', totalStock: 1500, distributed: 234 },
  { id: '8', name: 'Blankets', icon: '🧣', totalStock: 2500, distributed: 678 },
];
