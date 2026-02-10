import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type VolunteerZone = 'entrance' | 'marketplace' | 'exit';

interface VolunteerCheckInStatus {
  isCheckedIn: boolean;
  assignedZone: VolunteerZone | null;
  marketplaceId: string | null;
  cardId: string | null;
  checkedInAt: string | null;
}

export const useVolunteerCheckInStatus = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['volunteer_check_in_status', user?.id],
    queryFn: async (): Promise<VolunteerCheckInStatus> => {
      if (!user?.id) {
        return {
          isCheckedIn: false,
          assignedZone: null,
          marketplaceId: null,
          cardId: null,
          checkedInAt: null
        };
      }

      // First find the pending_volunteers record linked to this auth user
      const { data: pendingVolunteer } = await supabase
        .from('pending_volunteers')
        .select('id')
        .eq('created_user_id', user.id)
        .maybeSingle();

      if (!pendingVolunteer) {
        return {
          isCheckedIn: false,
          assignedZone: null,
          marketplaceId: null,
          cardId: null,
          checkedInAt: null
        };
      }

      // Find volunteer card linked to the pending_volunteers record
      // First try to find an actively checked-in card
      let { data: card, error } = await supabase
        .from('volunteer_qr_cards')
        .select('id, status, assigned_zone, marketplace_id, checked_in_at, volunteer_id')
        .eq('volunteer_id', pendingVolunteer.id)
        .eq('status', 'checked_in')
        .order('checked_in_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // If no checked-in card, get the most recently created one
      if (!card) {
        const result = await supabase
          .from('volunteer_qr_cards')
          .select('id, status, assigned_zone, marketplace_id, checked_in_at, volunteer_id')
          .eq('volunteer_id', pendingVolunteer.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        card = result.data;
        error = result.error;
      }

      if (error || !card) {
        return {
          isCheckedIn: false,
          assignedZone: null,
          marketplaceId: null,
          cardId: null,
          checkedInAt: null
        };
      }

      return {
        isCheckedIn: card.status === 'checked_in',
        assignedZone: card.assigned_zone as VolunteerZone | null,
        marketplaceId: card.marketplace_id,
        cardId: card.id,
        checkedInAt: card.checked_in_at
      };
    },
    enabled: !!user?.id,
    refetchInterval: 5000, // Poll every 5 seconds to check for status updates
  });
};
