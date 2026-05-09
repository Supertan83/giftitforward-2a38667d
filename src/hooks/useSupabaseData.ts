import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QRCard, ItemType, Transaction, CardStatus, TransactionType } from '@/types';
import { useEffect } from 'react';
import { Json } from '@/integrations/supabase/types';
import { mapDatabaseError, SafeError } from '@/lib/errorUtils';

/** Strip whitespace and ASCII control characters that QR scanners may append */
const sanitizeQRCode = (code: string): string =>
  code.trim().replace(/[\r\n\x00-\x1F\x7F]/g, '');

// Extract unique dependents from volunteer's events_json for family card name mapping
const extractFamilyDependents = (eventsJson: unknown): Array<{ name: string; type: string }> => {
  if (!eventsJson || !Array.isArray(eventsJson)) return [];
  const dependentsMap = new Map<string, { name: string; type: string }>();
  for (const event of eventsJson) {
    if (event.dependents && Array.isArray(event.dependents)) {
      for (const dep of event.dependents) {
        const key = dep.name?.toLowerCase()?.trim();
        if (key && !dependentsMap.has(key)) {
          dependentsMap.set(key, { name: dep.name, type: dep.type || 'adult' });
        }
      }
    }
  }
  return Array.from(dependentsMap.values());
};

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
    staleTime: 30000, // 30s - reduce re-fetch frequency under load
    queryFn: async (): Promise<QRCard[]> => {
      const allData: any[] = [];
      const pageSize = 1000;
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('qr_cards')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw new SafeError(mapDatabaseError(error), error);
        if (!data || data.length === 0) break;

        allData.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      return allData.map(card => ({
        id: card.id,
        uniqueId: card.unique_id,
        status: mapDbStatusToApp(card.status as DbCardStatus),
        creditBalance: card.credit_balance,
        totalItemsCollected: card.total_items_collected,
        transactions: [],
        marketplaceId: card.marketplace_id || undefined,
        activatedAt: card.activated_at || undefined,
        gender: card.gender || undefined,
        maritalStatus: card.marital_status || undefined,
        childrenCount: card.children_count || undefined,
        nationality: card.nationality || undefined,
        registrationBatch: (card as any).registration_batch || undefined,
        createdAt: card.created_at || undefined,
      }));
    }
  });

  // Subscribe to realtime updates (debounced to coalesce scan bursts)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleInvalidate = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
      }, 1500);
    };
    const channel = supabase
      .channel('qr_cards_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qr_cards' }, scheduleInvalidate)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
};

// Lightweight card stats (counts only) for zone components
export const useCardStats = (marketplaceId: string) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!marketplaceId) return;
    // Debounce realtime invalidations: bursts of qr_cards updates from a single
    // batch scan would otherwise trigger N count queries per client.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleInvalidate = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        queryClient.invalidateQueries({ queryKey: ['card_stats', marketplaceId] });
      }, 1500);
    };
    const channel = supabase
      .channel(`card_stats_${marketplaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qr_cards' }, scheduleInvalidate)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [marketplaceId, queryClient]);

  return useQuery({
    queryKey: ['card_stats', marketplaceId],
    staleTime: 0,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_marketplace_kiosk_stats', {
        p_marketplace_id: marketplaceId,
      });
      if (error) throw error;
      const stats = (data ?? {}) as {
        active?: number;
        ready?: number;
        today_check_ins?: number;
        checked_out?: number;
      };
      return {
        active: stats.active ?? 0,
        checkedOut: stats.checked_out ?? 0,
        ready: stats.ready ?? 0,
        todayCheckIns: stats.today_check_ins ?? 0,
      };
    },
    enabled: !!marketplaceId,
  });
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

      if (error) throw new SafeError(mapDatabaseError(error), error);

      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        icon: item.icon,
        totalStock: item.total_stock,
        distributed: item.distributed,
        category: item.category || null,
        subcategory: item.subcategory || null,
        externalMaterialId: item.external_material_id ?? null,
        surplussUrl: item.surpluss_url ?? null
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
    const cleanId = sanitizeQRCode(uniqueId);
    const { data, error } = await supabase
      .from('qr_cards')
      .select('*')
      .ilike('unique_id', cleanId)
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
    mutationFn: async ({
      uniqueId,
      beneficiaryInfo,
      marketplaceId
    }: {
      uniqueId: string;
      beneficiaryInfo?: {
        gender?: string;
        maritalStatus?: string;
        childrenCount?: number;
        nationality?: string;
      };
      marketplaceId?: string;
    }) => {
      const cleanId = sanitizeQRCode(uniqueId);
      // Single atomic RPC: lookup + status guard + update + transaction insert.
      // Replaces 3 sequential roundtrips and a non-indexed ILIKE that scanned all cards.
      const { data, error } = await supabase.rpc('activate_beneficiary_card', {
        p_unique_id: cleanId,
        p_marketplace_id: marketplaceId ?? null,
        p_gender: beneficiaryInfo?.gender ?? null,
        p_marital_status: beneficiaryInfo?.maritalStatus ?? null,
        p_nationality: beneficiaryInfo?.nationality ?? null,
        p_children_count: beneficiaryInfo?.childrenCount ?? null,
      });

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return data as {
        id: string;
        unique_id: string;
        credit_balance: number;
        total_items_collected: number;
        marketplace_id: string | null;
      };
    },
    onSuccess: () => {
      // Stats refresh is handled by the caller (lightweight card_stats query).
      // Skip the heavy ['qr_cards'] invalidation here — it triggers a 2k+ row refetch
      // on every scan and was a major contributor to scan latency.
    }
  });

  const distributeItem = useMutation({
    mutationFn: async ({ uniqueId, itemId, itemName }: { uniqueId: string; itemId: string; itemName: string }) => {
      const cleanId = sanitizeQRCode(uniqueId);
      // Find card
      const { data: card, error: findError } = await supabase
        .from('qr_cards')
        .select('*')
        .ilike('unique_id', cleanId)
        .maybeSingle();

      if (findError || !card) throw new SafeError('Card not found');
      if (card.status !== 'active') throw new SafeError('Card is not active. Please check in first.');
      // Get credit limit from marketplace
      let creditLimitValue = 15;
      if (card.marketplace_id) {
        const { data: mp } = await supabase
          .from('marketplace_events')
          .select('beneficiary_credit_limit')
          .eq('id', card.marketplace_id)
          .maybeSingle();
        if (mp) creditLimitValue = mp.beneficiary_credit_limit;
      }
      if (card.credit_balance >= creditLimitValue) throw new SafeError(`LIMIT REACHED (${creditLimitValue}/${creditLimitValue}). Maximum items already collected.`);

      // Check item availability from global stock
      const { data: item, error: itemError } = await supabase
        .from('item_types')
        .select('total_stock, distributed')
        .eq('id', itemId)
        .single();
      
      if (itemError || !item) throw new SafeError('Item not found');
      if (item.distributed >= item.total_stock) throw new SafeError('Item out of stock');

      // Check marketplace allocation if card has marketplace_id
      if (card.marketplace_id) {
        const { data: allocation } = await supabase
          .from('marketplace_item_allocations')
          .select('*')
          .eq('marketplace_id', card.marketplace_id)
          .eq('item_type_id', itemId)
          .maybeSingle();

        if (allocation) {
          if (allocation.distributed_quantity >= allocation.allocated_quantity) {
            throw new SafeError('Item allocation exhausted for this marketplace');
          }

          // Update marketplace allocation
          await supabase
            .from('marketplace_item_allocations')
            .update({ distributed_quantity: allocation.distributed_quantity + 1 })
            .eq('id', allocation.id);
        }
      }

      // Update card - ADD to credit_balance (items collected count)
      const { error: updateError } = await supabase
        .from('qr_cards')
        .update({
          credit_balance: card.credit_balance + 1,
          total_items_collected: card.total_items_collected + 1
        })
        .eq('id', card.id);

      if (updateError) throw new SafeError(mapDatabaseError(updateError), updateError);

      // Update global item distributed count
      await supabase
        .from('item_types')
        .update({ distributed: item.distributed + 1 })
        .eq('id', itemId);

      // Create transaction
      await supabase.from('transactions').insert({
        card_id: card.id,
        type: 'Distribution' as DbTransactionType,
        item_type: itemName,
        credit_change: 1
      });

      return { creditBalance: card.credit_balance + 1, itemName };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
      queryClient.invalidateQueries({ queryKey: ['item_types'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace_allocations'] });
    }
  });

  const returnItem = useMutation({
    mutationFn: async ({ uniqueId, itemId, itemName }: { uniqueId: string; itemId: string; itemName: string }) => {
      const cleanId = sanitizeQRCode(uniqueId);
      const { data: card, error: findError } = await supabase
        .from('qr_cards')
        .select('*')
        .ilike('unique_id', cleanId)
        .maybeSingle();

      if (findError || !card) throw new SafeError('Card not found');
      if (card.status !== 'active') throw new SafeError('Card is not active');
      if (card.credit_balance <= 0) throw new SafeError('No items to return');

      const newBalance = Math.max(card.credit_balance - 1, 0);

      // Update marketplace allocation if card has marketplace_id
      if (card.marketplace_id) {
        const { data: allocation } = await supabase
          .from('marketplace_item_allocations')
          .select('*')
          .eq('marketplace_id', card.marketplace_id)
          .eq('item_type_id', itemId)
          .maybeSingle();

        if (allocation && allocation.distributed_quantity > 0) {
          await supabase
            .from('marketplace_item_allocations')
            .update({ distributed_quantity: allocation.distributed_quantity - 1 })
            .eq('id', allocation.id);
        }
      }

      const { error: updateError } = await supabase
        .from('qr_cards')
        .update({
          credit_balance: newBalance,
          total_items_collected: card.total_items_collected - 1
        })
        .eq('id', card.id);

      if (updateError) throw new SafeError(mapDatabaseError(updateError), updateError);

      // Return item back to global stock (decrease distributed count)
      const { data: item } = await supabase
        .from('item_types')
        .select('distributed')
        .eq('id', itemId)
        .single();
      
      if (item && item.distributed > 0) {
        await supabase
          .from('item_types')
          .update({ distributed: item.distributed - 1 })
          .eq('id', itemId);
      }

      await supabase.from('transactions').insert({
        card_id: card.id,
        type: 'Return' as DbTransactionType,
        item_type: itemName,
        credit_change: -1
      });

      return { creditBalance: newBalance, itemName };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
      queryClient.invalidateQueries({ queryKey: ['item_types'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace_allocations'] });
    }
  });

  const checkoutCard = useMutation({
    mutationFn: async (uniqueId: string) => {
      const cleanId = sanitizeQRCode(uniqueId);
      const { data, error } = await supabase.rpc('checkout_beneficiary_card', {
        p_unique_id: cleanId
      });

      if (error) throw new SafeError(mapDatabaseError(error), error);

      const result = data as { totalCollected: number; cardId: string; uniqueId: string };
      return { totalCollected: result.totalCollected, cardId: result.cardId, uniqueId: result.uniqueId };
    },
    onSuccess: (_data, uniqueId) => {
      // Optimistic cache update: mark this single card as checked_out locally
      const cleanId = sanitizeQRCode(uniqueId).toLowerCase();
      queryClient.setQueryData<QRCard[]>(['qr_cards'], (old) => {
        if (!old) return old;
        return old.map(card =>
          card.uniqueId.toLowerCase() === cleanId
            ? { ...card, status: 'checked_out' as CardStatus, creditBalance: 0, totalItemsCollected: 0 }
            : card
        );
      });
      // Background refetch for consistency
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
    }
  });

  // Unblock card - reset to inactive and clear marketplace association
  const unblockCard = useMutation({
    mutationFn: async (uniqueId: string) => {
      const cleanId = sanitizeQRCode(uniqueId);
      const { data: card, error: findError } = await supabase
        .from('qr_cards')
        .select('*')
        .ilike('unique_id', cleanId)
        .maybeSingle();

      if (findError || !card) throw new SafeError('Card not found');
      
      // Only allow unblocking cards that are checked_out or active (blocked)
      if (card.status === 'inactive' && !card.marketplace_id) {
        throw new SafeError('Card is already unblocked and ready to use');
      }

      // Preserve marketplace_id for today's cards so transaction counts remain accurate
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isFromToday = card.activated_at && new Date(card.activated_at) >= today;

      const { error: updateError } = await supabase
        .from('qr_cards')
        .update({
          status: 'inactive' as DbCardStatus,
          credit_balance: 0,
          total_items_collected: 0,
          collected_items: [],
          marketplace_id: isFromToday ? card.marketplace_id : null,
          activated_at: isFromToday ? card.activated_at : null
        })
        .eq('id', card.id);

      if (updateError) throw new SafeError(mapDatabaseError(updateError), updateError);

      return { uniqueId: card.unique_id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
    }
  });

  // Get blocked cards (cards used today or previously that need unblocking)
  const getBlockedCards = async (): Promise<QRCard[]> => {
    const { data, error } = await supabase
      .from('qr_cards')
      .select('*')
      .or('status.eq.checked_out,status.eq.active,marketplace_id.not.is.null')
      .order('activated_at', { ascending: false });

    if (error) throw new SafeError(mapDatabaseError(error), error);

    return (data || []).map(card => ({
      id: card.id,
      uniqueId: card.unique_id,
      status: mapDbStatusToApp(card.status as DbCardStatus),
      creditBalance: card.credit_balance,
      totalItemsCollected: card.total_items_collected,
      transactions: [],
      marketplaceId: card.marketplace_id || undefined,
      activatedAt: card.activated_at || undefined,
    }));
  };

  // Bulk unblock all cards from previous days
  const bulkUnblockPreviousDays = useMutation({
    mutationFn: async () => {
      // Get start of today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISOString = today.toISOString();

      // Find cards activated before today with marketplace_id
      const { data: blockedCards, error: fetchError } = await supabase
        .from('qr_cards')
        .select('id, unique_id')
        .not('marketplace_id', 'is', null)
        .lt('activated_at', todayISOString);

      if (fetchError) throw new SafeError(mapDatabaseError(fetchError), fetchError);

      if (!blockedCards || blockedCards.length === 0) {
        return { unblocked: 0 };
      }

      const cardIds = blockedCards.map(card => card.id);

      const { error: updateError } = await supabase
        .from('qr_cards')
        .update({
          status: 'inactive' as DbCardStatus,
          credit_balance: 0,
          total_items_collected: 0,
          collected_items: [],
          marketplace_id: null,
          activated_at: null,
        })
        .in('id', cardIds);

      if (updateError) throw new SafeError(mapDatabaseError(updateError), updateError);

      return { unblocked: blockedCards.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
    }
  });

  // Simplified distribute - single atomic RPC call
  const distributeItemSimple = useMutation({
    mutationFn: async ({ uniqueId, marketplaceId }: { uniqueId: string; marketplaceId: string }) => {
      const { data, error } = await supabase
        .rpc('distribute_marketplace_item', {
          p_unique_id: uniqueId,
          p_marketplace_id: marketplaceId
        });

      if (error) throw new SafeError(error.message);
      return data as { creditBalance: number; cardId: string };
    },
    retry: 1,
    onSuccess: () => {
      // Non-blocking background refresh of allocations
      queryClient.invalidateQueries({ queryKey: ['marketplace_allocations'] });
    }
  });

  // Simplified return - single atomic RPC call
  const returnItemSimple = useMutation({
    mutationFn: async ({ uniqueId, marketplaceId }: { uniqueId: string; marketplaceId: string }) => {
      const { data, error } = await supabase
        .rpc('return_marketplace_item', {
          p_unique_id: uniqueId,
          p_marketplace_id: marketplaceId
        });

      if (error) throw new SafeError(error.message);
      return data as { creditBalance: number; cardId: string };
    },
    retry: 1,
    onSuccess: () => {
      // Non-blocking background refresh of allocations
      queryClient.invalidateQueries({ queryKey: ['marketplace_allocations'] });
    }
  });

  // Batch distribute - distribute N items in one atomic operation
  const distributeItemBatch = useMutation({
    mutationFn: async ({ uniqueId, marketplaceId, quantity }: { uniqueId: string; marketplaceId: string; quantity: number }) => {
      const { data, error } = await supabase
        .rpc('distribute_marketplace_items_batch', {
          p_unique_id: uniqueId,
          p_marketplace_id: marketplaceId,
          p_quantity: quantity
        });

      if (error) throw new SafeError(error.message);
      return data as { creditBalance: number; cardId: string; quantity: number };
    },
    retry: 1,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace_allocations'] });
    }
  });

  // Batch return - return N items in one atomic operation
  const returnItemBatch = useMutation({
    mutationFn: async ({ uniqueId, marketplaceId, quantity }: { uniqueId: string; marketplaceId: string; quantity: number }) => {
      const { data, error } = await supabase
        .rpc('return_marketplace_items_batch', {
          p_unique_id: uniqueId,
          p_marketplace_id: marketplaceId,
          p_quantity: quantity
        });

      if (error) throw new SafeError(error.message);
      return data as { creditBalance: number; cardId: string; quantity: number };
    },
    retry: 1,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace_allocations'] });
    }
  });

  const addCards = useMutation({
    mutationFn: async (uniqueIds: string[]) => {
      const batchId = crypto.randomUUID();
      const cards = uniqueIds.map(uniqueId => ({
        unique_id: uniqueId,
        status: 'inactive' as DbCardStatus,
        credit_balance: 0,
        total_items_collected: 0,
        collected_items: [] as Json,
        registration_batch: batchId
      }));

      const { data, error } = await supabase
        .from('qr_cards')
        .insert(cards)
        .select();

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return data?.length || 0;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
    }
  });

  const unregisterCard = useMutation({
    mutationFn: async (uniqueId: string) => {
      const cleanId = sanitizeQRCode(uniqueId);
      // First delete associated transactions
      const { data: card } = await supabase
        .from('qr_cards')
        .select('id')
        .ilike('unique_id', cleanId)
        .maybeSingle();

      if (card) {
        await supabase
          .from('transactions')
          .delete()
          .eq('card_id', card.id);
      }

      // Then delete the card
      const { error } = await supabase
        .from('qr_cards')
        .delete()
        .ilike('unique_id', cleanId);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
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
    distributeItemSimple,
    returnItemSimple,
    distributeItemBatch,
    returnItemBatch,
    checkoutCard,
    unblockCard,
    bulkUnblockPreviousDays,
    getBlockedCards,
    addCards,
    unregisterCard
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

      if (findError || !item) throw new SafeError('Item not found');

      const availableStock = item.total_stock - item.allocated_to_marketplace;
      if (quantity > availableStock) throw new SafeError('Insufficient stock');

      const { error: updateError } = await supabase
        .from('item_types')
        .update({
          allocated_to_marketplace: item.allocated_to_marketplace + quantity
        })
        .eq('id', itemId);

      if (updateError) throw new SafeError(mapDatabaseError(updateError), updateError);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item_types'] });
    }
  });

  const addItemType = useMutation({
    mutationFn: async (item: { name: string; icon: string; totalStock: number; category?: string }) => {
      const { error } = await supabase
        .from('item_types')
        .insert({
          name: item.name,
          icon: item.icon,
          total_stock: item.totalStock,
          allocated_to_marketplace: 0,
          distributed: 0,
          category: item.category || null
        });

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item_types'] });
    }
  });

  const deleteItemType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('item_types')
        .delete()
        .eq('id', id);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item_types'] });
    }
  });

  const updateItemStock = useMutation({
    mutationFn: async ({ id, totalStock }: { id: string; totalStock: number }) => {
      const { error } = await supabase
        .from('item_types')
        .update({ total_stock: totalStock })
        .eq('id', id);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item_types'] });
    }
  });

  const updateItemType = useMutation({
    mutationFn: async ({ id, name, icon, totalStock, category }: { id: string; name: string; icon: string; totalStock: number; category?: string | null }) => {
      const { error } = await supabase
        .from('item_types')
        .update({ name, icon, total_stock: totalStock, category: category || null })
        .eq('id', id);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item_types'] });
    }
  });

  return { allocateItems, addItemType, deleteItemType, updateItemStock, updateItemType };
};

// Users Management
export interface UserWithRole {
  id: string;
  email: string;
  role: 'admin' | 'volunteer' | 'employee';
  created_at: string;
  first_name: string | null;
  last_name: string | null;
  qr_codes: string[];
  pending_volunteer_id: string | null;
  assigned_zone: 'entrance' | 'marketplace' | 'exit' | null;
  marketplace_id: string | null;
  marketplace_ids: string[];
  volunteer_status: string | null;
  // Extended volunteer data from pending_volunteers
  phone_number: string | null;
  gender: string | null;
  events_json: unknown;
  events_list: string | null;
  employee_vertical: string | null;
  employee_number: string | null;
  external_company: string | null;
  is_employee: boolean | null;
  source: string | null;
}

export const useUsers = () => {
  return useQuery({
    queryKey: ['users_with_roles'],
    queryFn: async (): Promise<UserWithRole[]> => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users');
      }

      return data.users.map((user: { 
        id: string; 
        email: string; 
        role: string; 
        created_at: string; 
        first_name: string | null; 
        last_name: string | null;
        qr_codes?: string[];
        pending_volunteer_id?: string | null;
        assigned_zone?: string | null;
        marketplace_id?: string | null;
        marketplace_ids?: string[];
        volunteer_status?: string | null;
        phone_number?: string | null;
        gender?: string | null;
        events_json?: unknown;
        events_list?: string | null;
        employee_vertical?: string | null;
        employee_number?: string | null;
        external_company?: string | null;
        is_employee?: boolean | null;
        source?: string | null;
      }) => ({
        id: user.id,
        email: user.email,
        role: user.role as 'admin' | 'volunteer' | 'employee',
        created_at: user.created_at,
        first_name: user.first_name,
        last_name: user.last_name,
        qr_codes: user.qr_codes || [],
        pending_volunteer_id: user.pending_volunteer_id || null,
        assigned_zone: user.assigned_zone as 'entrance' | 'marketplace' | 'exit' | null,
        marketplace_id: user.marketplace_id || null,
        marketplace_ids: user.marketplace_ids || [],
        volunteer_status: user.volunteer_status || null,
        phone_number: user.phone_number || null,
        gender: user.gender || null,
        events_json: user.events_json || null,
        events_list: user.events_list || null,
        employee_vertical: user.employee_vertical || null,
        employee_number: user.employee_number || null,
        external_company: user.external_company || null,
        is_employee: user.is_employee ?? null,
        source: user.source || null,
      }));
    }
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password, role, marketplaceId }: { email: string; password: string; role: 'admin' | 'volunteer' | 'employee'; marketplaceId?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email, password, role, marketplaceId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      return data.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users_with_roles'] });
    }
  });
};

export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, role, firstName, lastName, email }: { userId: string; role: 'admin' | 'volunteer' | 'employee'; firstName?: string; lastName?: string; email?: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId, role, firstName, lastName, email }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user role');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users_with_roles'] });
    }
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Delete pending_volunteers record if exists (cleanup volunteer data)
      await supabase
        .from('pending_volunteers')
        .delete()
        .eq('created_user_id', userId);

      // Delete the auth user via edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users_with_roles'] });
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
      queryClient.invalidateQueries({ queryKey: ['bulk-uploaded-volunteers-count'] });
    }
  });
};

// Generate volunteer QR code for existing user
export const useGenerateVolunteerQR = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, email, firstName, lastName }: { userId: string; email: string; firstName?: string; lastName?: string }) => {
      // Generate unique QR code ID
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      const uniqueId = `VOL-${timestamp}-${random}`;

      // First check if a pending_volunteers record exists for this user
      let { data: existingPV } = await supabase
        .from('pending_volunteers')
        .select('id')
        .eq('created_user_id', userId)
        .maybeSingle();

      // If no pending_volunteers record exists, create one
      if (!existingPV) {
        const { data: newPV, error: pvError } = await supabase
          .from('pending_volunteers')
          .insert({
            email: email,
            first_name: firstName || email.split('@')[0],
            last_name: lastName || '',
            status: 'approved',
            created_user_id: userId
          })
          .select('id')
          .single();
        
        if (pvError) throw new SafeError(mapDatabaseError(pvError), pvError);
        existingPV = newPV;
      }

      // Check if user already has a QR card
      const { data: existingQR } = await supabase
        .from('volunteer_qr_cards')
        .select('id, unique_id')
        .eq('volunteer_id', existingPV.id)
        .maybeSingle();

      if (existingQR) {
        // Return existing QR code instead of throwing error
        return { unique_id: existingQR.unique_id, existing: true };
      }

      // Create the volunteer QR card linked to pending_volunteers record
      const { data, error } = await supabase
        .from('volunteer_qr_cards')
        .insert({
          unique_id: uniqueId,
          volunteer_id: existingPV.id,
          status: 'inactive'
        })
        .select()
        .single();

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return { unique_id: data.unique_id, existing: false };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users_with_roles'] });
      queryClient.invalidateQueries({ queryKey: ['volunteer_qr_cards'] });
    }
  });
};

// Update volunteer assignment (zone and marketplaces - supports multiple)
export const useUpdateVolunteerAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      pendingVolunteerId, 
      assignedZone, 
      marketplaceIds,
      status
    }: { 
      pendingVolunteerId: string; 
      assignedZone?: 'entrance' | 'marketplace' | 'exit' | null; 
      marketplaceIds?: string[];
      status?: 'inactive' | 'checked_in' | 'checked_out';
    }) => {
      // Get all existing QR cards for this volunteer
      const { data: existingCards, error: findError } = await supabase
        .from('volunteer_qr_cards')
        .select('id, marketplace_id, unique_id')
        .eq('volunteer_id', pendingVolunteerId);

      if (findError) throw new SafeError(mapDatabaseError(findError), findError);

      const existingMarketplaceIds = new Set(existingCards?.map(c => c.marketplace_id).filter(Boolean) || []);
      const newMarketplaceIds = new Set(marketplaceIds || []);

      // Cards to update (existing that should remain)
      const cardsToUpdate = existingCards?.filter(c => 
        c.marketplace_id && newMarketplaceIds.has(c.marketplace_id)
      ) || [];

      // Cards to remove marketplace from (existing that are no longer selected)
      const cardsToUnassign = existingCards?.filter(c => 
        c.marketplace_id && !newMarketplaceIds.has(c.marketplace_id)
      ) || [];

      // Marketplaces to add (new selections not in existing)
      const marketplacesToAdd = [...newMarketplaceIds].filter(id => !existingMarketplaceIds.has(id));

      // Update zone on all existing cards
      if (existingCards && existingCards.length > 0 && assignedZone !== undefined) {
        const updateData: Record<string, unknown> = { assigned_zone: assignedZone };
        if (status !== undefined) updateData.status = status;

        for (const card of existingCards) {
          await supabase
            .from('volunteer_qr_cards')
            .update(updateData)
            .eq('id', card.id);
        }
      }

      // Unassign marketplace from cards that should no longer have it
      for (const card of cardsToUnassign) {
        await supabase
          .from('volunteer_qr_cards')
          .update({ marketplace_id: null })
          .eq('id', card.id);
      }

      // For new marketplaces, either reuse an unassigned card or create a new one
      const unassignedCards = existingCards?.filter(c => !c.marketplace_id) || [];
      let unassignedIndex = 0;

      for (const marketplaceId of marketplacesToAdd) {
        if (unassignedIndex < unassignedCards.length) {
          // Reuse an unassigned card
          await supabase
            .from('volunteer_qr_cards')
            .update({ 
              marketplace_id: marketplaceId,
              assigned_zone: assignedZone || null 
            })
            .eq('id', unassignedCards[unassignedIndex].id);
          unassignedIndex++;
        } else {
          // Create a new QR card for this marketplace
          const uniqueId = `VOL-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          await supabase
            .from('volunteer_qr_cards')
            .insert({
              volunteer_id: pendingVolunteerId,
              unique_id: uniqueId,
              marketplace_id: marketplaceId,
              assigned_zone: assignedZone || null,
              status: status || 'inactive'
            });
        }
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users_with_roles'] });
      queryClient.invalidateQueries({ queryKey: ['volunteer_qr_cards'] });
      queryClient.invalidateQueries({ queryKey: ['volunteer_check_in_status'] });
    }
  });
};

// Marketplace Events
interface MarketplaceEvent {
  id: string;
  name: string;
  location: string | null;
  event_date: string | null;
  status: 'upcoming' | 'active' | 'completed';
  outreach_partner: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: string;
  beneficiary_credit_limit: number;
  external_id: number | null;
}

export const useMarketplaces = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['marketplace_events'],
    queryFn: async (): Promise<MarketplaceEvent[]> => {
      const { data, error } = await supabase
        .from('marketplace_events')
        .select('*')
        .is('deleted_at', null)
        .order('event_date', { ascending: true });

      if (error) throw new SafeError(mapDatabaseError(error), error);
      const now = new Date();
      return (data || []).map(item => {
        let computedStatus = item.status as 'upcoming' | 'active' | 'completed';
        // Client-side guard: if marketplace is "active" but event has ended, show as "completed"
        if (!(item as any).status_locked_by_admin && (computedStatus === 'active' || computedStatus === 'upcoming') && item.event_date) {
          const [year, month, day] = item.event_date.split('-').map(Number);

          // Build end datetime
          const endDateTime = new Date(year, month - 1, day);
          if (item.end_time) {
            const [eh, em] = item.end_time.split(':').map(Number);
            endDateTime.setHours(eh, em, 0, 0);
          } else {
            endDateTime.setHours(23, 59, 59, 999);
          }

          // Build start datetime
          const startDateTime = new Date(year, month - 1, day);
          if (item.start_time) {
            const [sh, sm] = item.start_time.split(':').map(Number);
            startDateTime.setHours(sh, sm, 0, 0);
          } else {
            startDateTime.setHours(0, 0, 0, 0);
          }

          if (now > endDateTime) {
            computedStatus = 'completed';
          } else if (computedStatus === 'upcoming' && now >= startDateTime) {
            computedStatus = 'active';
          }
        }
        return { ...item, status: computedStatus };
      });
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel('marketplace_events_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_events' }, () => {
        queryClient.invalidateQueries({ queryKey: ['marketplace_events'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
};

export const useCreateMarketplace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (marketplace: { 
      name: string; 
      location: string | null; 
      event_date: string | null; 
      status: 'upcoming' | 'active' | 'completed';
      outreach_partner?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      beneficiary_credit_limit?: number;
      max_items_per_scan?: number;
    }) => {
      const { error } = await supabase
        .from('marketplace_events')
        .insert(marketplace);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace_events'] });
    }
  });
};

export const useDeleteMarketplace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketplace_events')
        .delete()
        .eq('id', id);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace_events'] });
    }
  });
};

export const useUpdateMarketplace = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (marketplace: { 
      id: string;
      name: string; 
      location: string | null; 
      event_date: string | null; 
      status: 'upcoming' | 'active' | 'completed';
      outreach_partner?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      beneficiary_credit_limit?: number;
      max_items_per_scan?: number;
      status_locked_by_admin?: boolean;
    }) => {
      const { id, ...updates } = marketplace;
      const { error } = await supabase
        .from('marketplace_events')
        .update(updates)
        .eq('id', id);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace_events'] });
    }
  });
};

// Beneficiary Demographics
interface DemographicsData {
  genderBreakdown: { gender: string; count: number }[];
  maritalBreakdown: { status: string; count: number }[];
  nationalityBreakdown: { nationality: string; count: number }[];
  totalChildren: number;
}

export const useBeneficiaryDemographics = () => {
  return useQuery({
    queryKey: ['beneficiary_demographics'],
    queryFn: async (): Promise<DemographicsData> => {
      const { data, error } = await supabase
        .from('qr_cards')
        .select('gender, marital_status, children_count, nationality')
        .not('gender', 'is', null);

      if (error) throw new SafeError(mapDatabaseError(error), error);

      const genderCounts: Record<string, number> = {};
      const maritalCounts: Record<string, number> = {};
      const nationalityCounts: Record<string, number> = {};
      let totalChildren = 0;

      (data || []).forEach(card => {
        if (card.gender) {
          genderCounts[card.gender] = (genderCounts[card.gender] || 0) + 1;
        }
        if (card.marital_status) {
          maritalCounts[card.marital_status] = (maritalCounts[card.marital_status] || 0) + 1;
        }
        if (card.nationality) {
          nationalityCounts[card.nationality] = (nationalityCounts[card.nationality] || 0) + 1;
        }
        totalChildren += card.children_count || 0;
      });

      return {
        genderBreakdown: Object.entries(genderCounts).map(([gender, count]) => ({ gender, count })),
        maritalBreakdown: Object.entries(maritalCounts).map(([status, count]) => ({ status, count })),
        nationalityBreakdown: Object.entries(nationalityCounts)
          .map(([nationality, count]) => ({ nationality, count }))
          .sort((a, b) => b.count - a.count),
        totalChildren
      };
    }
  });
};

// Volunteer QR Cards
export const useVolunteerQRCards = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['volunteer_qr_cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('volunteer_qr_cards')
        .select(`
          *,
          pending_volunteers (
            first_name,
            last_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return data || [];
    }
  });

  useEffect(() => {
    const channel = supabase
      .channel('volunteer_qr_cards_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'volunteer_qr_cards' }, () => {
        queryClient.invalidateQueries({ queryKey: ['volunteer_qr_cards'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
};

// Volunteer Card Operations
export const useVolunteerCardOperations = () => {
  const queryClient = useQueryClient();

  const addVolunteerCards = useMutation({
    mutationFn: async (uniqueIds: string[]) => {
      const cards = uniqueIds.map(uniqueId => ({
        unique_id: uniqueId,
        status: 'inactive'
      }));

      const { data, error } = await supabase
        .from('volunteer_qr_cards')
        .insert(cards)
        .select();

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return data?.length || 0;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteer_qr_cards'] });
    }
  });

  const checkInVolunteer = useMutation({
    mutationFn: async ({ uniqueId, marketplaceId, assignedZone }: { 
      uniqueId: string; 
      marketplaceId?: string;
      assignedZone?: 'entrance' | 'marketplace' | 'exit';
    }) => {
      const cleanId = sanitizeQRCode(uniqueId);
      const { data: card, error: findError } = await supabase
        .from('volunteer_qr_cards')
        .select('*')
        .ilike('unique_id', cleanId)
        .maybeSingle();

      if (findError || !card) throw new SafeError('Volunteer card not found');
      if (card.status === 'checked_in') throw new SafeError('Volunteer already checked in');

      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('volunteer_qr_cards')
        .update({
          status: 'checked_in',
          checked_in_at: now,
          checked_out_at: null,
          marketplace_id: marketplaceId || null,
          assigned_zone: assignedZone || null,
          // If card was previously soft-deleted (e.g. via "Remove from marketplace"),
          // a fresh check-in re-activates it so Marketplace Reports include them again.
          deleted_at: null,
        })
        .eq('id', card.id);

      if (updateError) throw new SafeError(mapDatabaseError(updateError), updateError);

      // Create attendance record
      await supabase.from('volunteer_attendance').insert({
        volunteer_card_id: card.id,
        marketplace_id: marketplaceId || null,
        check_in_time: now
      });

      return { cardId: card.id, checkedInAt: now, assignedZone };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteer_qr_cards'] });
    }
  });

  const checkOutVolunteer = useMutation({
    mutationFn: async (uniqueId: string) => {
      const cleanId = sanitizeQRCode(uniqueId);
      
      // Single atomic RPC call replaces 4 sequential DB operations
      const { data, error } = await supabase.rpc('checkout_volunteer_card', {
        p_unique_id: cleanId
      });

      if (error) throw new SafeError(mapDatabaseError(error), error);

      const result = data as {
        cardId: string;
        hoursWorked: number;
        marketplaceId: string | null;
        volunteerId: string | null;
        volunteerName: string;
        volunteerEmail: string | null;
      };

      // Fire-and-forget survey email — don't block checkout
      if (result.volunteerEmail) {
        supabase.functions.invoke('send-survey', {
          body: {
            volunteerCardId: result.cardId,
            volunteerId: result.volunteerId,
            volunteerName: result.volunteerName || 'Volunteer',
            volunteerEmail: result.volunteerEmail,
            marketplaceId: result.marketplaceId,
          },
        }).then(() => {
          console.log('Survey email sent to:', result.volunteerEmail);
        }).catch((surveyError) => {
          console.error('Failed to send survey email:', surveyError);
        });
      }

      return { 
        hoursWorked: String(result.hoursWorked), 
        surveySent: !!result.volunteerEmail,
        familyCertificatesSent: 0 
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteer_qr_cards'] });
    }
  });

  const linkVolunteerToCard = useMutation({
    mutationFn: async ({ cardUniqueId, volunteerId }: { cardUniqueId: string; volunteerId: string }) => {
      const cleanId = sanitizeQRCode(cardUniqueId);
      const { error } = await supabase
        .from('volunteer_qr_cards')
        .update({ volunteer_id: volunteerId })
        .ilike('unique_id', cleanId);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteer_qr_cards'] });
    }
  });

  const resetVolunteerCard = useMutation({
    mutationFn: async (uniqueId: string) => {
      const cleanId = sanitizeQRCode(uniqueId);
      const { error } = await supabase
        .from('volunteer_qr_cards')
        .update({
          status: 'inactive',
          checked_in_at: null,
          checked_out_at: null,
          marketplace_id: null
        })
        .ilike('unique_id', cleanId);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteer_qr_cards'] });
    }
  });

  return {
    addVolunteerCards,
    checkInVolunteer,
    checkOutVolunteer,
    linkVolunteerToCard,
    resetVolunteerCard
  };
};

// Marketplace Sync and Reset Operations
export const useMarketplaceSyncOperations = () => {
  const queryClient = useQueryClient();

  const archiveAndResetCards = useMutation({
    mutationFn: async (marketplaceId: string) => {
      // Get cards associated with this marketplace OR orphaned checked_out cards
      const { data: cards, error: fetchError } = await supabase
        .from('qr_cards')
        .select('*')
        .or(`marketplace_id.eq.${marketplaceId},and(status.eq.checked_out,marketplace_id.is.null)`);

      if (fetchError) throw new SafeError(mapDatabaseError(fetchError), fetchError);

      if (!cards || cards.length === 0) {
        return { archivedCount: 0 };
      }

      // Archive card data
      const archiveData = cards.map(card => ({
        original_card_id: card.id,
        unique_id: card.unique_id,
        marketplace_id: card.marketplace_id || marketplaceId,
        gender: card.gender,
        marital_status: card.marital_status,
        nationality: card.nationality,
        children_count: card.children_count,
        credit_balance: card.credit_balance,
        total_items_collected: card.total_items_collected,
        collected_items: card.collected_items,
        activated_at: card.activated_at,
        checked_out_at: card.updated_at
      }));

      const { error: archiveError } = await supabase
        .from('archived_card_data')
        .insert(archiveData);

      if (archiveError) throw new SafeError(mapDatabaseError(archiveError), archiveError);

      // Reset cards for reuse in batches of 200 to avoid URL length limits
      const cardIds = cards.map(c => c.id);
      const BATCH_SIZE = 200;
      for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
        const batch = cardIds.slice(i, i + BATCH_SIZE);
        const { error: resetError } = await supabase
          .from('qr_cards')
          .update({
            status: 'inactive',
            credit_balance: 0,
            total_items_collected: 0,
            collected_items: [],
            gender: null,
            marital_status: null,
            nationality: null,
            children_count: 0,
            marketplace_id: null,
            activated_at: null
          })
          .in('id', batch);

        if (resetError) throw new SafeError(mapDatabaseError(resetError), resetError);
      }

      return { archivedCount: cards.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
    }
  });

  const resetAllCardsForMarketplace = useMutation({
    mutationFn: async () => {
      // Reset all active cards that have been used (have marketplace_id or activated_at)
      const { data: cards, error: fetchError } = await supabase
        .from('qr_cards')
        .select('id')
        .or('marketplace_id.not.is.null,activated_at.not.is.null');

      if (fetchError) throw new SafeError(mapDatabaseError(fetchError), fetchError);

      if (!cards || cards.length === 0) {
        return { resetCount: 0 };
      }

      const cardIds = cards.map(c => c.id);
      const BATCH_SIZE = 200;
      for (let i = 0; i < cardIds.length; i += BATCH_SIZE) {
        const batch = cardIds.slice(i, i + BATCH_SIZE);
        const { error: resetError } = await supabase
          .from('qr_cards')
          .update({
            status: 'inactive',
            credit_balance: 0,
            total_items_collected: 0,
            collected_items: [],
            gender: null,
            marital_status: null,
            nationality: null,
            children_count: 0,
            marketplace_id: null,
            activated_at: null
          })
          .in('id', batch);

        if (resetError) throw new SafeError(mapDatabaseError(resetError), resetError);
      }

      return { resetCount: cards.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
    }
  });

  const forceResetCard = useMutation({
    mutationFn: async (cardId: string) => {
      // Fetch card first to check if it's from today
      const { data: card, error: fetchError } = await supabase
        .from('qr_cards')
        .select('activated_at, marketplace_id')
        .eq('id', cardId)
        .maybeSingle();

      if (fetchError) throw new SafeError(mapDatabaseError(fetchError), fetchError);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isFromToday = card?.activated_at && new Date(card.activated_at) >= today;

      const { error } = await supabase
        .from('qr_cards')
        .update({
          status: 'inactive',
          credit_balance: 0,
          total_items_collected: 0,
          collected_items: [],
          gender: null,
          marital_status: null,
          nationality: null,
          children_count: 0,
          // Preserve marketplace_id for today's cards so transaction counts remain accurate
          marketplace_id: isFromToday ? card.marketplace_id : null,
          activated_at: isFromToday ? card.activated_at : null
        })
        .eq('id', cardId);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
    }
  });

  return {
    archiveAndResetCards,
    resetAllCardsForMarketplace,
    forceResetCard
  };
};

// Archived Card Data
export const useArchivedCardData = (marketplaceId?: string) => {
  return useQuery({
    queryKey: ['archived_card_data', marketplaceId],
    queryFn: async () => {
      let query = supabase
        .from('archived_card_data')
        .select('*, marketplace_events(name)')
        .order('archived_at', { ascending: false });

      if (marketplaceId) {
        query = query.eq('marketplace_id', marketplaceId);
      }

      const { data, error } = await query;

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return data || [];
    }
  });
};

// Orphan Cleanup
export interface OrphanCleanupResult {
  success: boolean;
  dryRun: boolean;
  orphanedUserRoles: number;
  orphanedVolunteerQRCards: number;
  totalCleaned: number;
  message: string;
}

export const useCleanupOrphans = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dryRun: boolean = true): Promise<OrphanCleanupResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new SafeError('Not authenticated');

      const { data, error } = await supabase.functions.invoke('cleanup-orphans', {
        body: { dryRun },
      });

      if (error) throw new SafeError(error.message || 'Failed to cleanup orphans');
      if (!data.success) throw new SafeError(data.error || 'Cleanup failed');

      return data as OrphanCleanupResult;
    },
    onSuccess: (data) => {
      if (!data.dryRun) {
        // Invalidate users list after actual cleanup
        queryClient.invalidateQueries({ queryKey: ['users'] });
      }
    }
  });
};

// Update volunteer events (remove events from registration)
export const useUpdateVolunteerEvents = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      pendingVolunteerId, 
      eventsJson,
      eventsList 
    }: { 
      pendingVolunteerId: string; 
      eventsJson: Json[];
      eventsList: string;
    }) => {
      const { error } = await supabase
        .from('pending_volunteers')
        .update({ 
          events_json: eventsJson,
          events_list: eventsList
        })
        .eq('id', pendingVolunteerId);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users_with_roles'] });
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
    }
  });
};