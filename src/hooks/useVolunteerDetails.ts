import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VolunteerCategoryBreakdown {
  category: string;
  classification: 'internal' | 'external' | 'outreach';
  registered: number;
  attended: number;
  dropoutRate: number;
  maleCount: number;
  femaleCount: number;
  topCompanies: string[];
}

export interface VolunteerDetailsData {
  totalRegistered: number;
  totalAttended: number;
  dropoutRate: number;
  familyMembers: number;
  categoryBreakdown: VolunteerCategoryBreakdown[];
}

export const useVolunteerDetails = () => {
  return useQuery({
    queryKey: ['volunteer_details_stats'],
    queryFn: async (): Promise<VolunteerDetailsData> => {
      // Fetch all approved volunteers with their QR card status
      const { data: volunteers, error } = await supabase
        .from('pending_volunteers')
        .select(`
          id,
          is_employee,
          external_company,
          gender,
          source,
          volunteer_qr_cards (
            id,
            status
          )
        `)
        .eq('status', 'approved');

      if (error) throw error;

      const vols = volunteers || [];

      // Also fetch registration events for family member counts
      const volunteerIds = vols.map(v => v.id);
      let totalFamilyMembers = 0;
      
      if (volunteerIds.length > 0) {
        // Get partner_registrations linked to these volunteers by email
        const { data: regEvents } = await supabase
          .from('registration_events')
          .select('number_of_adults, number_of_children')
          .limit(1000);
        
        if (regEvents) {
          totalFamilyMembers = regEvents.reduce((sum, re) => 
            sum + (re.number_of_adults || 0) + (re.number_of_children || 0), 0);
        }
      }

      // Calculate totals
      const totalRegistered = vols.length;
      const totalAttended = vols.filter(v => 
        v.volunteer_qr_cards?.some((c: any) => c.status === 'checked_in' || c.status === 'checked_out')
      ).length;
      const dropoutRate = totalRegistered > 0 
        ? Math.round(((totalRegistered - totalAttended) / totalRegistered) * 100) 
        : 0;

      // Group by category
      const categoryMap = new Map<string, {
        classification: 'internal' | 'external' | 'outreach';
        registered: number;
        attended: number;
        male: number;
        female: number;
        companies: Map<string, number>;
      }>();

      for (const vol of vols) {
        let categoryKey: string;
        let classification: 'internal' | 'external' | 'outreach';

        if (vol.is_employee) {
          categoryKey = 'Corporate Internal';
          classification = 'internal';
        } else if (vol.external_company) {
          categoryKey = 'Corporate External';
          classification = 'external';
        } else {
          categoryKey = 'Outreach Partners';
          classification = 'outreach';
        }

        if (!categoryMap.has(categoryKey)) {
          categoryMap.set(categoryKey, {
            classification,
            registered: 0,
            attended: 0,
            male: 0,
            female: 0,
            companies: new Map(),
          });
        }

        const cat = categoryMap.get(categoryKey)!;
        cat.registered++;

        const hasAttended = vol.volunteer_qr_cards?.some(
          (c: any) => c.status === 'checked_in' || c.status === 'checked_out'
        );
        if (hasAttended) cat.attended++;

        if (vol.gender?.toLowerCase() === 'male') cat.male++;
        if (vol.gender?.toLowerCase() === 'female') cat.female++;

        const company = vol.external_company || (vol.is_employee ? 'Dubai Holding' : 'Other');
        cat.companies.set(company, (cat.companies.get(company) || 0) + 1);
      }

      const categoryBreakdown: VolunteerCategoryBreakdown[] = Array.from(categoryMap.entries())
        .map(([category, data]) => {
          const topCompanies = Array.from(data.companies.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name]) => name);

          return {
            category,
            classification: data.classification,
            registered: data.registered,
            attended: data.attended,
            dropoutRate: data.registered > 0
              ? Math.round(((data.registered - data.attended) / data.registered) * 100)
              : 0,
            maleCount: data.male,
            femaleCount: data.female,
            topCompanies,
          };
        })
        .sort((a, b) => b.registered - a.registered);

      return {
        totalRegistered,
        totalAttended,
        dropoutRate,
        familyMembers: totalFamilyMembers,
        categoryBreakdown,
      };
    },
  });
};
