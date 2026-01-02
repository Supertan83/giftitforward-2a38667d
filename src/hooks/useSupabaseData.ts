import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QRCard, ItemType, Transaction, CardStatus, TransactionType } from '@/types';
import { useEffect } from 'react';
import { Json } from '@/integrations/supabase/types';
import { mapDatabaseError, SafeError } from '@/lib/errorUtils';

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

      if (error) throw new SafeError(mapDatabaseError(error), error);

      return (data || []).map(card => ({
        id: card.id,
        uniqueId: card.unique_id,
        status: mapDbStatusToApp(card.status as DbCardStatus),
        creditBalance: card.credit_balance,
        totalItemsCollected: card.total_items_collected,
        transactions: [], // Transactions are fetched separately if needed
        marketplaceId: card.marketplace_id || undefined,
        activatedAt: card.activated_at || undefined,
        gender: card.gender || undefined,
        maritalStatus: card.marital_status || undefined,
        childrenCount: card.children_count || undefined,
        nationality: card.nationality || undefined,
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

      if (error) throw new SafeError(mapDatabaseError(error), error);

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
    mutationFn: async ({ 
      uniqueId, 
      beneficiaryInfo,
      marketplaceId 
    }: { 
      uniqueId: string; 
      beneficiaryInfo?: { 
        gender: string; 
        maritalStatus: string; 
        childrenCount: number; 
        nationality: string; 
      };
      marketplaceId?: string;
    }) => {
      // Find card
      const { data: card, error: findError } = await supabase
        .from('qr_cards')
        .select('*')
        .ilike('unique_id', uniqueId)
        .maybeSingle();

      if (findError || !card) throw new SafeError('Card not found');
      
      // BLOCK: If card is already active, prevent re-entry
      if (card.status === 'active') {
        throw new SafeError('Card already activated. This beneficiary has already entered the marketplace.');
      }

      // Update card with beneficiary info
      const updateData: Record<string, unknown> = {
        status: 'active' as DbCardStatus,
        credit_balance: 15,
        total_items_collected: 0,
        collected_items: [],
        activated_at: new Date().toISOString()
      };

      if (marketplaceId) {
        updateData.marketplace_id = marketplaceId;
      }

      if (beneficiaryInfo) {
        updateData.gender = beneficiaryInfo.gender;
        updateData.marital_status = beneficiaryInfo.maritalStatus;
        updateData.children_count = beneficiaryInfo.childrenCount;
        updateData.nationality = beneficiaryInfo.nationality;
      }

      const { data: updated, error: updateError } = await supabase
        .from('qr_cards')
        .update(updateData)
        .eq('id', card.id)
        .select()
        .single();

      if (updateError) throw new SafeError(mapDatabaseError(updateError), updateError);

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

      if (findError || !card) throw new SafeError('Card not found');
      if (card.status !== 'active') throw new SafeError('Card is not active. Please check in first.');
      if (card.credit_balance <= 0) throw new SafeError('LIMIT REACHED (0/15). No more items allowed.');

      // Update card
      const { error: updateError } = await supabase
        .from('qr_cards')
        .update({
          credit_balance: card.credit_balance - 1,
          total_items_collected: card.total_items_collected + 1
        })
        .eq('id', card.id);

      if (updateError) throw new SafeError(mapDatabaseError(updateError), updateError);

      // Update item distributed count
      const { data: item } = await supabase
        .from('item_types')
        .select('distributed')
        .eq('id', itemId)
        .single();
      
      if (item) {
        await supabase
          .from('item_types')
          .update({ distributed: item.distributed + 1 })
          .eq('id', itemId);
      }

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

      if (findError || !card) throw new SafeError('Card not found');
      if (card.status !== 'active') throw new SafeError('Card is not active');
      if (card.total_items_collected <= 0) throw new SafeError('No items to return');

      const newBalance = Math.min(card.credit_balance + 1, 15);

      const { error: updateError } = await supabase
        .from('qr_cards')
        .update({
          credit_balance: newBalance,
          total_items_collected: card.total_items_collected - 1
        })
        .eq('id', card.id);

      if (updateError) throw new SafeError(mapDatabaseError(updateError), updateError);

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

      if (findError || !card) throw new SafeError('Card not found');

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

      if (updateError) throw new SafeError(mapDatabaseError(updateError), updateError);

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

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return data?.length || 0;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
    }
  });

  const unregisterCard = useMutation({
    mutationFn: async (uniqueId: string) => {
      // First delete associated transactions
      const { data: card } = await supabase
        .from('qr_cards')
        .select('id')
        .ilike('unique_id', uniqueId)
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
        .ilike('unique_id', uniqueId);

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
    checkoutCard,
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

  return { allocateItems, addItemType, deleteItemType, updateItemStock };
};

// Users Management
interface UserWithRole {
  id: string;
  email: string;
  role: 'admin' | 'volunteer';
  created_at: string;
  first_name: string | null;
  last_name: string | null;
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

      return data.users.map((user: { id: string; email: string; role: string; created_at: string; first_name: string | null; last_name: string | null }) => ({
        id: user.id,
        email: user.email,
        role: user.role as 'admin' | 'volunteer',
        created_at: user.created_at,
        first_name: user.first_name,
        last_name: user.last_name,
      }));
    }
  });
};

export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password, role }: { email: string; password: string; role: 'admin' | 'volunteer' }) => {
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
        body: JSON.stringify({ email, password, role }),
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
    mutationFn: async ({ userId, role, firstName, lastName }: { userId: string; role: 'admin' | 'volunteer'; firstName?: string; lastName?: string }) => {
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
        body: JSON.stringify({ userId, role, firstName, lastName }),
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
  created_at: string;
}

export const useMarketplaces = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['marketplace_events'],
    queryFn: async (): Promise<MarketplaceEvent[]> => {
      const { data, error } = await supabase
        .from('marketplace_events')
        .select('*')
        .order('event_date', { ascending: true });

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return (data || []).map(item => ({
        ...item,
        status: item.status as 'upcoming' | 'active' | 'completed'
      }));
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
    mutationFn: async ({ uniqueId, marketplaceId }: { uniqueId: string; marketplaceId?: string }) => {
      const { data: card, error: findError } = await supabase
        .from('volunteer_qr_cards')
        .select('*')
        .ilike('unique_id', uniqueId)
        .maybeSingle();

      if (findError || !card) throw new SafeError('Volunteer card not found');
      if (card.status === 'checked_in') throw new SafeError('Volunteer already checked in');

      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('volunteer_qr_cards')
        .update({
          status: 'checked_in',
          checked_in_at: now,
          marketplace_id: marketplaceId || null
        })
        .eq('id', card.id);

      if (updateError) throw new SafeError(mapDatabaseError(updateError), updateError);

      // Create attendance record
      await supabase.from('volunteer_attendance').insert({
        volunteer_card_id: card.id,
        marketplace_id: marketplaceId || null,
        check_in_time: now
      });

      return { cardId: card.id, checkedInAt: now };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteer_qr_cards'] });
    }
  });

  const checkOutVolunteer = useMutation({
    mutationFn: async (uniqueId: string) => {
      const { data: card, error: findError } = await supabase
        .from('volunteer_qr_cards')
        .select('*, volunteer_attendance(*)')
        .ilike('unique_id', uniqueId)
        .maybeSingle();

      if (findError || !card) throw new SafeError('Volunteer card not found');
      if (card.status !== 'checked_in') throw new SafeError('Volunteer not checked in');

      const now = new Date();
      const checkedInAt = new Date(card.checked_in_at);
      const hoursWorked = (now.getTime() - checkedInAt.getTime()) / (1000 * 60 * 60);

      const { error: updateError } = await supabase
        .from('volunteer_qr_cards')
        .update({
          status: 'checked_out',
          checked_out_at: now.toISOString(),
          total_hours_worked: (card.total_hours_worked || 0) + hoursWorked
        })
        .eq('id', card.id);

      if (updateError) throw new SafeError(mapDatabaseError(updateError), updateError);

      // Update attendance record
      const { data: attendance } = await supabase
        .from('volunteer_attendance')
        .select('*')
        .eq('volunteer_card_id', card.id)
        .is('check_out_time', null)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (attendance) {
        await supabase
          .from('volunteer_attendance')
          .update({
            check_out_time: now.toISOString(),
            hours_worked: hoursWorked
          })
          .eq('id', attendance.id);
      }

      return { hoursWorked: hoursWorked.toFixed(2) };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteer_qr_cards'] });
    }
  });

  const linkVolunteerToCard = useMutation({
    mutationFn: async ({ cardUniqueId, volunteerId }: { cardUniqueId: string; volunteerId: string }) => {
      const { error } = await supabase
        .from('volunteer_qr_cards')
        .update({ volunteer_id: volunteerId })
        .ilike('unique_id', cardUniqueId);

      if (error) throw new SafeError(mapDatabaseError(error), error);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteer_qr_cards'] });
    }
  });

  const resetVolunteerCard = useMutation({
    mutationFn: async (uniqueId: string) => {
      const { error } = await supabase
        .from('volunteer_qr_cards')
        .update({
          status: 'inactive',
          checked_in_at: null,
          checked_out_at: null,
          marketplace_id: null
        })
        .ilike('unique_id', uniqueId);

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
      // Get all cards associated with this marketplace
      const { data: cards, error: fetchError } = await supabase
        .from('qr_cards')
        .select('*')
        .eq('marketplace_id', marketplaceId);

      if (fetchError) throw new SafeError(mapDatabaseError(fetchError), fetchError);

      if (!cards || cards.length === 0) {
        return { archivedCount: 0 };
      }

      // Archive card data
      const archiveData = cards.map(card => ({
        original_card_id: card.id,
        unique_id: card.unique_id,
        marketplace_id: marketplaceId,
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

      // Reset cards for reuse
      const cardIds = cards.map(c => c.id);
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
        .in('id', cardIds);

      if (resetError) throw new SafeError(mapDatabaseError(resetError), resetError);

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
        .in('id', cardIds);

      if (resetError) throw new SafeError(mapDatabaseError(resetError), resetError);

      return { resetCount: cards.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_cards'] });
    }
  });

  return {
    archiveAndResetCards,
    resetAllCardsForMarketplace
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