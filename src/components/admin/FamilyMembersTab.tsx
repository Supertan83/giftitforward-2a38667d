import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, User, Search, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CertificatePreviewDialog } from '@/components/certificates/CertificatePreviewDialog';

interface MarketplaceEvent {
  id: string;
  name: string;
}

interface FamilyMembersTabProps {
  marketplaces: MarketplaceEvent[];
  searchQuery: string;
  eventFilter: string;
}

// Extract unique dependents from events_json
const extractUniqueDependents = (eventsJson: unknown): Array<{ name: string; type: string; gender?: string }> => {
  if (!eventsJson || !Array.isArray(eventsJson)) return [];
  const seen = new Map<string, { name: string; type: string; gender?: string }>();
  for (const event of eventsJson) {
    if (event.dependents && Array.isArray(event.dependents)) {
      for (const dep of event.dependents) {
        const name = dep.name?.trim();
        if (!name) continue;
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.set(key, { name, type: dep.type || 'adult', gender: dep.gender || undefined });
        }
      }
    }
  }
  return Array.from(seen.values());
};

// Resolve family member name from card unique_id and volunteer's events_json
const resolveFamilyMemberName = (
  cardUniqueId: string,
  eventsJson: unknown,
  allFamilyCards: Array<{ unique_id: string; id: string }>,
  volunteerFirstName: string,
  volunteerLastName: string
): string => {
  const dependents = extractUniqueDependents(eventsJson);
  if (dependents.length === 0) {
    return `Family of ${volunteerFirstName} ${volunteerLastName}`;
  }

  // Try index-based matching
  const fMatch = cardUniqueId.match(/-F(\d)/);
  const familyIndex = fMatch ? parseInt(fMatch[1], 10) : 0;
  if (familyIndex > 0 && familyIndex <= dependents.length) {
    return dependents[familyIndex - 1].name;
  }

  // Positional fallback
  const sortedCards = allFamilyCards
    .filter(c => /-F\d/.test(c.unique_id))
    .sort((a, b) => {
      const aIdx = parseInt(a.unique_id.match(/-F(\d)/)?.[1] || '0', 10);
      const bIdx = parseInt(b.unique_id.match(/-F(\d)/)?.[1] || '0', 10);
      return aIdx - bIdx;
    });
  const posIdx = sortedCards.findIndex(c => c.unique_id === cardUniqueId);
  if (posIdx >= 0 && posIdx < dependents.length) {
    return dependents[posIdx].name;
  }

  return `Family of ${volunteerFirstName} ${volunteerLastName}`;
};

export const FamilyMembersTab = ({ marketplaces, searchQuery, eventFilter }: FamilyMembersTabProps) => {
  const [marketplaceFilter, setMarketplaceFilter] = useState<string>('all');
  const [localSearch, setLocalSearch] = useState('');
  const [certPreviewOpen, setCertPreviewOpen] = useState(false);
  const [certPreviewName, setCertPreviewName] = useState({ firstName: '', lastName: '' });

  const { data: familyData = [], isLoading } = useQuery({
    queryKey: ['family-members-tab'],
    queryFn: async () => {
      // Fetch all family QR cards (with -F suffix)
      const { data: cards, error: cardsError } = await supabase
        .from('volunteer_qr_cards')
        .select('id, unique_id, volunteer_id, status, checked_in_at, checked_out_at, survey_completed_at, marketplace_id, total_hours_worked')
        .like('unique_id', '%-F%');

      if (cardsError) throw cardsError;
      if (!cards || cards.length === 0) return [];

      // Get unique volunteer IDs
      const volunteerIds = [...new Set(cards.map(c => c.volunteer_id).filter(Boolean))] as string[];
      
      // Fetch volunteer details
      const { data: volunteers, error: volError } = await supabase
        .from('pending_volunteers')
        .select('id, first_name, last_name, email, events_json')
        .in('id', volunteerIds);

      if (volError) throw volError;

      const volMap = new Map((volunteers || []).map(v => [v.id, v]));

      // Build enriched family data
      return cards.map(card => {
        const vol = card.volunteer_id ? volMap.get(card.volunteer_id) : null;
        const siblingCards = cards.filter(c => c.volunteer_id === card.volunteer_id);
        const memberName = vol
          ? resolveFamilyMemberName(card.unique_id, vol.events_json, siblingCards, vol.first_name, vol.last_name)
          : 'Unknown';
        const primaryName = vol ? `${vol.first_name} ${vol.last_name}` : 'Unknown';
        
        return {
          ...card,
          memberName,
          primaryName,
          primaryEmail: vol?.email || '',
          certSent: !!card.survey_completed_at,
        };
      });
    }
  });

  const filtered = useMemo(() => {
    let result = familyData;
    
    if (marketplaceFilter !== 'all') {
      result = result.filter(f => f.marketplace_id === marketplaceFilter);
    }

    const q = (localSearch || searchQuery || '').toLowerCase().trim();
    if (q) {
      result = result.filter(f =>
        f.memberName.toLowerCase().includes(q) ||
        f.primaryName.toLowerCase().includes(q) ||
        f.unique_id.toLowerCase().includes(q) ||
        f.primaryEmail.toLowerCase().includes(q)
      );
    }

    return result;
  }, [familyData, marketplaceFilter, localSearch, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'checked_out':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Checked Out</Badge>;
      case 'checked_in':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">Checked In</Badge>;
      default:
        return <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">Inactive</Badge>;
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-border bg-muted/30">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search family member, volunteer, QR ID..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={marketplaceFilter} onValueChange={setMarketplaceFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by marketplace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Marketplaces</SelectItem>
            {marketplaces.map(m => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="shrink-0 self-center">
          {filtered.length} family member{filtered.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No family members found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Family Member</TableHead>
                <TableHead>Primary Volunteer</TableHead>
                <TableHead>QR Card ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Certificate</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.memberName}</TableCell>
                  <TableCell className="text-muted-foreground">{f.primaryName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{f.unique_id}</TableCell>
                  <TableCell>{getStatusBadge(f.status)}</TableCell>
                  <TableCell>
                    {f.certSent ? (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">Sent</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not Sent</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const parts = f.memberName.trim().split(/\s+/);
                        setCertPreviewName({
                          firstName: parts[0] || f.memberName,
                          lastName: parts.slice(1).join(' ') || '',
                        });
                        setCertPreviewOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CertificatePreviewDialog
        open={certPreviewOpen}
        onOpenChange={setCertPreviewOpen}
        firstName={certPreviewName.firstName}
        lastName={certPreviewName.lastName}
        surveyCompleted={false}
        trainingCompleted={false}
      />
    </div>
  );
};
