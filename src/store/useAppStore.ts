import { create } from 'zustand';
import { QRCard, ItemType, User, Transaction, TransactionType } from '@/types';
import { mockQRCards, mockItemTypes, mockUser, mockAdmin } from '@/data/mockData';

interface AppState {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  
  // Data
  qrCards: QRCard[];
  itemTypes: ItemType[];
  
  // Actions
  login: (role: 'admin' | 'volunteer') => void;
  logout: () => void;
  
  // QR Card operations
  findCardByUniqueId: (uniqueId: string) => QRCard | undefined;
  activateCard: (uniqueId: string) => QRCard | null;
  distributeItem: (uniqueId: string, itemId: string) => { success: boolean; message: string; card?: QRCard };
  returnItem: (uniqueId: string, itemId: string) => { success: boolean; message: string; card?: QRCard };
  checkoutCard: (uniqueId: string) => { success: boolean; message: string; card?: QRCard };
  addCards: (uniqueIds: string[]) => number;
  importCards: (uniqueIds: string[]) => number;
  
  // Inventory operations
  allocateItemsToMarketplace: (itemId: string, quantity: number) => boolean;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  qrCards: mockQRCards,
  itemTypes: mockItemTypes,
  
  login: (role) => {
    const user = role === 'admin' ? mockAdmin : mockUser;
    set({ currentUser: user, isAuthenticated: true });
  },
  
  logout: () => {
    set({ currentUser: null, isAuthenticated: false });
  },
  
  findCardByUniqueId: (uniqueId) => {
    return get().qrCards.find(card => card.uniqueId.toLowerCase() === uniqueId.toLowerCase());
  },
  
  activateCard: (uniqueId) => {
    const { qrCards } = get();
    const cardIndex = qrCards.findIndex(card => card.uniqueId.toLowerCase() === uniqueId.toLowerCase());
    
    if (cardIndex === -1) return null;
    
    const card = qrCards[cardIndex];
    if (card.status === 'active') return card;
    
    const transaction: Transaction = {
      id: `t-${Date.now()}`,
      cardId: card.id,
      type: 'check_in',
      timestamp: new Date(),
    };
    
    const updatedCard: QRCard = {
      ...card,
      status: 'active',
      creditBalance: 15,
      totalItemsCollected: 0,
      transactions: [transaction],
    };
    
    const updatedCards = [...qrCards];
    updatedCards[cardIndex] = updatedCard;
    
    set({ qrCards: updatedCards });
    return updatedCard;
  },
  
  distributeItem: (uniqueId, itemId) => {
    const { qrCards, itemTypes } = get();
    const cardIndex = qrCards.findIndex(card => card.uniqueId.toLowerCase() === uniqueId.toLowerCase());
    
    if (cardIndex === -1) {
      return { success: false, message: 'Card not found' };
    }
    
    const card = qrCards[cardIndex];
    
    if (card.status !== 'active') {
      return { success: false, message: 'Card is not active. Please check in first.' };
    }
    
    if (card.creditBalance <= 0) {
      return { success: false, message: 'LIMIT REACHED (0/15). No more items allowed.' };
    }
    
    const item = itemTypes.find(i => i.id === itemId);
    if (!item) {
      return { success: false, message: 'Item not found' };
    }
    
    const transaction: Transaction = {
      id: `t-${Date.now()}`,
      cardId: card.id,
      itemId: itemId,
      itemName: item.name,
      type: 'distribution',
      timestamp: new Date(),
    };
    
    const updatedCard: QRCard = {
      ...card,
      creditBalance: card.creditBalance - 1,
      totalItemsCollected: card.totalItemsCollected + 1,
      transactions: [...card.transactions, transaction],
    };
    
    const updatedCards = [...qrCards];
    updatedCards[cardIndex] = updatedCard;
    
    // Update item distributed count
    const itemIndex = itemTypes.findIndex(i => i.id === itemId);
    const updatedItems = [...itemTypes];
    updatedItems[itemIndex] = { ...item, distributed: item.distributed + 1 };
    
    set({ qrCards: updatedCards, itemTypes: updatedItems });
    return { success: true, message: `${item.name} distributed. Remaining: ${updatedCard.creditBalance}/15`, card: updatedCard };
  },
  
  returnItem: (uniqueId, itemId) => {
    const { qrCards, itemTypes } = get();
    const cardIndex = qrCards.findIndex(card => card.uniqueId.toLowerCase() === uniqueId.toLowerCase());
    
    if (cardIndex === -1) {
      return { success: false, message: 'Card not found' };
    }
    
    const card = qrCards[cardIndex];
    
    if (card.status !== 'active') {
      return { success: false, message: 'Card is not active' };
    }
    
    if (card.totalItemsCollected <= 0) {
      return { success: false, message: 'No items to return' };
    }
    
    const item = itemTypes.find(i => i.id === itemId);
    if (!item) {
      return { success: false, message: 'Item not found' };
    }
    
    const transaction: Transaction = {
      id: `t-${Date.now()}`,
      cardId: card.id,
      itemId: itemId,
      itemName: item.name,
      type: 'return',
      timestamp: new Date(),
    };
    
    const updatedCard: QRCard = {
      ...card,
      creditBalance: Math.min(card.creditBalance + 1, 15),
      totalItemsCollected: card.totalItemsCollected - 1,
      transactions: [...card.transactions, transaction],
    };
    
    const updatedCards = [...qrCards];
    updatedCards[cardIndex] = updatedCard;
    
    set({ qrCards: updatedCards });
    return { success: true, message: `${item.name} returned. Credits restored: ${updatedCard.creditBalance}/15`, card: updatedCard };
  },
  
  checkoutCard: (uniqueId) => {
    const { qrCards } = get();
    const cardIndex = qrCards.findIndex(card => card.uniqueId.toLowerCase() === uniqueId.toLowerCase());
    
    if (cardIndex === -1) {
      return { success: false, message: 'Card not found' };
    }
    
    const card = qrCards[cardIndex];
    
    const transaction: Transaction = {
      id: `t-${Date.now()}`,
      cardId: card.id,
      type: 'check_out',
      timestamp: new Date(),
    };
    
    const finalCard = { ...card };
    
    const updatedCard: QRCard = {
      ...card,
      status: 'ready',
      creditBalance: 0,
      totalItemsCollected: 0,
      transactions: [],
    };
    
    const updatedCards = [...qrCards];
    updatedCards[cardIndex] = updatedCard;
    
    set({ qrCards: updatedCards });
    return { 
      success: true, 
      message: `Card reset. Collected ${finalCard.totalItemsCollected}/15 items.`, 
      card: finalCard 
    };
  },
  
  allocateItemsToMarketplace: (itemId, quantity) => {
    const { itemTypes } = get();
    const itemIndex = itemTypes.findIndex(i => i.id === itemId);
    
    if (itemIndex === -1) return false;
    
    const item = itemTypes[itemIndex];
    const availableStock = item.totalStock - item.distributed;
    
    if (quantity > availableStock) return false;
    
    // Just update stock directly (no allocation concept)
    const updatedItems = [...itemTypes];
    updatedItems[itemIndex] = {
      ...item,
      totalStock: item.totalStock + quantity,
    };
    
    set({ itemTypes: updatedItems });
    return true;
  },

  addCards: (uniqueIds) => {
    const { qrCards } = get();
    const existingIds = new Set(qrCards.map(c => c.uniqueId.toLowerCase()));
    
    const newCards: QRCard[] = uniqueIds
      .filter(id => !existingIds.has(id.toLowerCase()))
      .map(uniqueId => ({
        id: crypto.randomUUID(),
        uniqueId,
        status: 'ready' as const,
        creditBalance: 0,
        totalItemsCollected: 0,
        transactions: [],
      }));
    
    if (newCards.length > 0) {
      set({ qrCards: [...qrCards, ...newCards] });
    }
    
    return newCards.length;
  },

  importCards: (uniqueIds) => {
    return get().addCards(uniqueIds);
  },
}));
