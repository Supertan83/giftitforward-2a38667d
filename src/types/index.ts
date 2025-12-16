export type UserRole = 'admin' | 'volunteer';

export type CardStatus = 'ready' | 'active' | 'checked_out';

export type TransactionType = 'check_in' | 'distribution' | 'return' | 'check_out';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  currentLocation: string;
}

export interface QRCard {
  id: string;
  uniqueId: string;
  status: CardStatus;
  creditBalance: number;
  totalItemsCollected: number;
  transactions: Transaction[];
}

export interface ItemType {
  id: string;
  name: string;
  icon: string;
  totalStock: number;
  allocatedToMarketplace: number;
  distributed: number;
}

export interface Transaction {
  id: string;
  cardId: string;
  itemId?: string;
  itemName?: string;
  type: TransactionType;
  timestamp: Date;
}

export interface MarketplaceEvent {
  id: string;
  name: string;
  date: string;
  location: string;
}
