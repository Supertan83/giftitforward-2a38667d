import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { classifyVolunteer, resolveCompanyName } from '@/lib/volunteerClassification';
import { fetchAllRows } from '@/lib/fetchAllRows';

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
  totalWithQRCards: number;
  dropoutRate: number;
  familyMembers: number;
  categoryBreakdown: VolunteerCategoryBreakdown[];
}

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

// Token + date based matcher (mirrors useMarketplaceAllocations / webhook-receiver)
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const STOP_TOKENS = new Set(['the','and','for','marketplace','event','morning','afternoon','evening','day','first','second','third','half','part']);

const extractDateFromEventSlug = (slug: string): { month: number; day: number } | null => {
  const s = slug.toLowerCase();
  for (let i = 0; i < MONTHS.length; i++) {
    const m = s.match(new RegExp(`${MONTHS[i]}[-\\s]*?(\\d{1,2})`));
    if (m) return { month: i + 1, day: parseInt(m[1], 10) };
  }
  return null;
};

const eventSlugMatchesMarketplace = (
  rawEventSlug: string,
  marketplaceName: string,
  marketplaceEventDate?: string | null,
): boolean => {
  if (!rawEventSlug) return false;
  const slug = rawEventSlug.toLowerCase();
  const flat = slug.replace(/[^a-z0-9]/g, '');
  const nameFlat = marketplaceName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (flat === nameFlat) return true;
  const slugTokens = slug.split(/[-_\s]+/).filter(p => p.length > 2 && !STOP_TOKENS.has(p) && !MONTHS.includes(p));
  const nameLower = marketplaceName.toLowerCase();
  const tokenMatchCount = slugTokens.filter(t => nameLower.includes(t)).length;
  const nameMatches = tokenMatchCount >= 2 || (slugTokens.length === 1 && nameLower.includes(slugTokens[0]));
  if (!nameMatches) return false;
  if (marketplaceEventDate) {
    const slugDate = extractDateFromEventSlug(slug);
    if (slugDate) {
      const [y, m, d] = marketplaceEventDate.split('-').map(Number);
      if (m !== slugDate.month || d !== slugDate.day) return false;
    }
  }
  return true;
};


export const useVolunteerDetails = (marketplaceName?: string, marketplaceId?: string) => {
  return useQuery({
    queryKey: ['volunteer_details_stats', marketplaceName || 'all', marketplaceId || 'all'],
    queryFn: async (): Promise<VolunteerDetailsData> => {
      // Fetch all approved volunteers with their QR card status — paginated to bypass 1000-row cap
      const volunteers = await fetchAllRows<any>(() =>
        supabase
          .from('pending_volunteers')
          .select(`
            id,
            is_employee,
            external_company,
            gender,
            source,
            events_list,
            events_json,
            volunteer_qr_cards (
              id,
              status,
              marketplace_id
            )
          `)
          .eq('status', 'approved')
      );

      let vols = volunteers || [];

      // Resolve marketplace event_date once for token + date matching
      let mpEventDate: string | null = null;
      if (marketplaceName && marketplaceId) {
        const { data: mp } = await supabase
          .from('marketplace_events')
          .select('event_date')
          .eq('id', marketplaceId)
          .maybeSingle();
        mpEventDate = (mp as any)?.event_date ?? null;
      }

      // Filter by marketplace if provided
      if (marketplaceName) {
        vols = vols.filter(v => {
          if (!v.events_list) return false;
          return v.events_list.split(',').some(
            (slug: string) => eventSlugMatchesMarketplace(slug.trim(), marketplaceName, mpEventDate)
          );
        });
      }

      // Calculate family members
      let totalFamilyMembers = 0;

      if (marketplaceName) {
        // Use events_json to count family members for this specific marketplace
        for (const vol of vols) {
          if (vol.events_json && Array.isArray(vol.events_json)) {
            for (const evt of vol.events_json as any[]) {
              const rawEventSlug = String(evt['event-slug'] || evt.event_slug || evt['event'] || evt.event || '');
              if (eventSlugMatchesMarketplace(rawEventSlug, marketplaceName, mpEventDate)) {
                totalFamilyMembers += Number(evt['number-of-adults'] || evt.number_of_adults || 0);
                totalFamilyMembers += Number(evt['number-of-children'] || evt.number_of_children || 0);
              }
            }
          }
        }
      } else {
        // Global: fetch from registration_events — paginated to bypass 1000-row cap
        const regEvents = await fetchAllRows<{ number_of_adults: number | null; number_of_children: number | null }>(() =>
          supabase
            .from('registration_events')
            .select('number_of_adults, number_of_children')
        );

        if (regEvents) {
          totalFamilyMembers = regEvents.reduce((sum, re) =>
            sum + (re.number_of_adults || 0) + (re.number_of_children || 0), 0);
        }
      }

      // Calculate totals
      const totalRegistered = vols.length;
      const totalWithQRCards = vols.filter(v => {
        const cards = v.volunteer_qr_cards || [];
        return cards.length > 0;
      }).length;
      const totalAttended = vols.filter(v => {
        const cards = v.volunteer_qr_cards || [];
        if (marketplaceId) {
          return cards.some((c: any) =>
            c.marketplace_id === marketplaceId &&
            (c.status === 'checked_in' || c.status === 'checked_out')
          );
        }
        return cards.some((c: any) => c.status === 'checked_in' || c.status === 'checked_out');
      }).length;
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
        const { categoryKey, classification } = classifyVolunteer(vol);

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

        const cards = vol.volunteer_qr_cards || [];
        const hasAttended = marketplaceId
          ? cards.some((c: any) => c.marketplace_id === marketplaceId && (c.status === 'checked_in' || c.status === 'checked_out'))
          : cards.some((c: any) => c.status === 'checked_in' || c.status === 'checked_out');
        if (hasAttended) cat.attended++;

        if (vol.gender?.toLowerCase() === 'male') cat.male++;
        if (vol.gender?.toLowerCase() === 'female') cat.female++;

        const company = resolveCompanyName(vol);
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
        totalWithQRCards,
        dropoutRate,
        familyMembers: totalFamilyMembers,
        categoryBreakdown,
      };
    },
  });
};
