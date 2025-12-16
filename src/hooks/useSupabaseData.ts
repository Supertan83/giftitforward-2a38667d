import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QRCard, ItemType, Transaction, CardStatus, TransactionType } from '@/types';
import { useEffect } from 'react';
import { Json } from '@/integrations/supabase/types';

// Type helpers for database mapping
type DbCardStatus = 'inactive' | 'active' | 'checked_out';
type DbTransactionType = 'CheckIn' | 'Distribution' | 'Return' | 'CheckOut';

const mapDbStatusToApp = (status: DbCardStatus): CardStatus => {
  if (status === 'inactive') return 'ready';
  if (status === 'checked_out') return 'checked_out';
  return 'active';
};

const mapAppStatusToDb = (status: CardStatus): DbCardStatus => {
  if (status === 'ready') return 'inactive';
  if (status === 'checked_out') return 'checked_out';
  return 'active';
};

const mapDbTransactionTypeToApp = (type: DbTransactionType): TransactionType => {
  const map: Record<DbTransactionType, TransactionType> = {
    'CheckIn': 'check_in',
    'Distribution': 'distribution',
    'Return': 'return',
    'CheckOut': 'check_out'
  };
  return map[type];
};

const mapAppTransactionTypeToDb = (type: TransactionType): DbTransactionType => {
  const map: Record<TransactionType, DbTransactionType> = {
    'check_in': 'CheckIn',
    'distribution': 'Distribution',
    'return': 'Return',
    'check_out': 'CheckOut'
  };
  return map[type];
};

// QR Cards
export const useQRCards = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['qr_cards'],
    queryFn: async (): Promise<QRCard[]> => {
      const { data, error } = await supabase
        .from('qr_cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map(card => ({
        id: card.id,
        uniqueId: card.unique_id,
        status: mapDbStatusToApp(card.status as DbCardStatus),
        creditBalance: card.credit_balance,
        totalItemsCollected: card.total_items_collected,
        transactions: [] // Transactions are fetched separately if needed
      }));
    }
  });

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('qr_cards_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qr_cards' }, () => {
        queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
};

// Item Types
export const useItemTypes = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['item_types'],
    queryFn: async (): Promise<ItemType[]> => {
      const { data, error } = await supabase
        .from('item_types')
        .select('*')
        .order('name');

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        icon: item.icon,
        totalStock: item.total_stock,
        allocatedToMarketplace: item.allocated_to_marketplace,
        distributed: item.distributed
      }));
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel('item_types_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_types' }, () => {
        queryClient.invalidateQueries({ queryKey: ['item_types'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
};

// Card Operations
export const useCardOperations = () => {
  const queryClient = useQueryClient();

  const findCardByUniqueId = async (uniqueId: string): Promise<QRCard | null> => {
    const { data, error } = await supabase
      .from('qr_cards')
      .select('*')
      .ilike('unique_id', uniqueId)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      uniqueId: data.unique_id,
      status: mapDbStatusToApp(data.status as DbCardStatus),
      creditBalance: data.credit_balance,
      totalItemsCollected: data.total_items_collected,
      transactions: []
    };
  };

  const activateCard = useMutation({
    mutationFn: async (uniqueId: string) => {
      // Find card
      const { data: card, error: findError } = await supabase
        .from('qr_cards')
        .select('*')
        .ilike('unique_id', uniqueId)
        .maybeSingle();

      if (findError || !card) throw new Error('Card not found');
      if (card.status === 'active') return card;

      // Update card
      const { data: updated, error: updateError } = await supabase
        .from('qr_cards')
        .update({
          status: 'active' as DbCardStatus,
          credit_balance: 15,
          total_items_collected: 0,
          collected_items: []
        })
        .eq('id', card.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Create transaction
      await supabase.from('transactions').insert({
        card_id: card.id,
        type: 'CheckIn' as DbTransactionType,
        credit_change: 15
      });

      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
    }
  });

  const distributeItem = useMutation({
    mutationFn: async ({ uniqueId, itemId, itemName }: { uniqueId: string; itemId: string; itemName: string }) => {
      // Find card
      const { data: card, error: findError } = await supabase
        .from('qr_cards')
        .select('*')
        .ilike('unique_id', uniqueId)
        .maybeSingle();

      if (findError || !card) throw new Error('Card not found');
      if (card.status !== 'active') throw new Error('Card is not active. Please check in first.');
      if (card.credit_balance <= 0) throw new Error('LIMIT REACHED (0/15). No more items allowed.');

      // Update card
      const { error: updateError } = await supabase
        .from('qr_cards')
        .update({
          credit_balance: card.credit_balance - 1,
          total_items_collected: card.total_items_collected + 1
        })
        .eq('id', card.id);

      if (updateError) throw updateError;

      // Update item distributed count
      await supabase.rpc('increment_item_distributed', { item_id: itemId });

      // Create transaction
      await supabase.from('transactions').insert({
        card_id: card.id,
        type: 'Distribution' as DbTransactionType,
        item_type: itemName,
        credit_change: -1
      });

      return { creditBalance: card.credit_balance - 1, itemName };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
      queryClient.invalidateQueries({ queryKey: ['item_types'] });
    }
  });

  const returnItem = useMutation({
    mutationFn: async ({ uniqueId, itemId, itemName }: { uniqueId: string; itemId: string; itemName: string }) => {
      const { data: card, error: findError } = await supabase
        .from('qr_cards')
        .select('*')
        .ilike('unique_id', uniqueId)
        .maybeSingle();

      if (findError || !card) throw new Error('Card not found');
      if (card.status !== 'active') throw new Error('Card is not active');
      if (card.total_items_collected <= 0) throw new Error('No items to return');

      const newBalance = Math.min(card.credit_balance + 1, 15);

      const { error: updateError } = await supabase
        .from('qr_cards')
        .update({
          credit_balance: newBalance,
          total_items_collected: card.total_items_collected - 1
        })
        .eq('id', card.id);

      if (updateError) throw updateError;

      await supabase.from('transactions').insert({
        card_id: card.id,
        type: 'Return' as DbTransactionType,
        item_type: itemName,
        credit_change: 1
      });

      return { creditBalance: newBalance, itemName };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
    }
  });

  const checkoutCard = useMutation({
    mutationFn: async (uniqueId: string) => {
      const { data: card, error: findError } = await supabase
        .from('qr_cards')
        .select('*')
        .ilike('unique_id', uniqueId)
        .maybeSingle();

      if (findError || !card) throw new Error('Card not found');

      const totalCollected = card.total_items_collected;

      const { error: updateError } = await supabase
        .from('qr_cards')
        .update({
          status: 'inactive' as DbCardStatus,
          credit_balance: 0,
          total_items_collected: 0,
          collected_items: []
        })
        .eq('id', card.id);

      if (updateError) throw updateError;

      await supabase.from('transactions').insert({
        card_id: card.id,
        type: 'CheckOut' as DbTransactionType,
        credit_change: 0
      });

      return { totalCollected };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
    }
  });

  const addCards = useMutation({
    mutationFn: async (uniqueIds: string[]) => {
      const cards = uniqueIds.map(uniqueId => ({
        unique_id: uniqueId,
        status: 'inactive' as DbCardStatus,
        credit_balance: 0,
        total_items_collected: 0,
        collected_items: [] as Json
      }));

      const { data, error } = await supabase
        .from('qr_cards')
        .insert(cards)
        .select();

      if (error) throw error;
      return data?.length || 0;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
    }
  });

  return {
    findCardByUniqueId,
    activateCard,
    distributeItem,
    returnItem,
    checkoutCard,
    addCards
  };
};

// Inventory Operations
export const useInventoryOperations = () => {
  const queryClient = useQueryClient();

  const allocateItems = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const { data: item, error: findError } = await supabase
        .from('item_types')
        .select('*')
        .eq('id', itemId)
        .single();

      if (findError || !item) throw new Error('Item not found');

      const availableStock = item.total_stock - item.allocated_to_marketplace;
      if (quantity > availableStock) throw new Error('Insufficient stock');

      const { error: updateError } = await supabase
        .from('item_types')
        .update({
          allocated_to_marketplace: item.allocated_to_marketplace + quantity
        })
        .eq('id', itemId);

      if (updateError) throw updateError;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item_types'] });
    }
  });

  const addItemType = useMutation({
    mutationFn: async (item: { name: string; icon: string; totalStock: number }) => {
      const { error } = await supabase
        .from('item_types')
        .insert({
          name: item.name,
          icon: item.icon,
          total_stock: item.totalStock,
          allocated_to_marketplace: 0,
          distributed: 0
        });

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item_types'] });
    }
  });

  return { allocateItems, addItemType };
};
