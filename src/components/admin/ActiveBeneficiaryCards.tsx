import { useState } from 'react';
import { ArrowLeft, CreditCard, MapPin, Search, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

interface ActiveCard {
  id: string;
  unique_id: string;
  credit_balance: number;
  total_items_collected: number;
  activated_at: string | null;
  marketplace_id: string | null;
  marketplace_name?: string;
  beneficiary_credit_limit?: number;
}

interface Props {
  onBack: () => void;
}

export const ActiveBeneficiaryCards = ({ onBack }: Props) => {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: cards = [], isLoading, refetch } = useQuery({
    queryKey: ['active-beneficiary-cards'],
    queryFn: async () => {
      // Fetch active QR cards
      const { data: qrCards, error } = await supabase
        .from('qr_cards')
        .select('id, unique_id, credit_balance, total_items_collected, activated_at, marketplace_id')
        .eq('status', 'active')
        .order('activated_at', { ascending: false });

      if (error) throw error;
      if (!qrCards || qrCards.length === 0) return [];

      // Fetch marketplace names
      const mpIds = [...new Set(qrCards.filter(c => c.marketplace_id).map(c => c.marketplace_id!))];
      let mpMap: Record<string, { name: string; limit: number }> = {};

      if (mpIds.length > 0) {
        const { data: mpData } = await supabase
          .from('marketplace_events')
          .select('id, name, beneficiary_credit_limit')
          .in('id', mpIds);

        if (mpData) {
          for (const mp of mpData) {
            mpMap[mp.id] = { name: mp.name, limit: mp.beneficiary_credit_limit };
          }
        }
      }

      return qrCards.map(c => ({
        ...c,
        marketplace_name: c.marketplace_id ? mpMap[c.marketplace_id]?.name : undefined,
        beneficiary_credit_limit: c.marketplace_id ? mpMap[c.marketplace_id]?.limit : undefined,
      })) as ActiveCard[];
    },
  });

  const filtered = searchTerm.trim()
    ? cards.filter(c =>
        c.unique_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.marketplace_name || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : cards;

  return (
    <div className="py-4 md:py-6 px-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Active Beneficiary Cards
          </h1>
          <p className="text-sm text-muted-foreground">
            {cards.length} active card{cards.length !== 1 ? 's' : ''} currently in use
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-2">
            <Search className="h-4 w-4 mt-2.5 text-muted-foreground" />
            <Input
              placeholder="Search by QR ID or marketplace..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            {searchTerm && (
              <Badge variant="secondary" className="self-center">{filtered.length} results</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Active Cards</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading active cards...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No cards match your search' : 'No active cards found'}
            </div>
          ) : (
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>QR ID</TableHead>
                    <TableHead>Marketplace</TableHead>
                    <TableHead className="text-center">Items Collected</TableHead>
                    <TableHead className="text-center">Remaining</TableHead>
                    <TableHead>Activated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(card => {
                    const limit = card.beneficiary_credit_limit ?? 15;
                    const remaining = limit - card.total_items_collected;
                    return (
                      <TableRow key={card.id}>
                        <TableCell className="font-mono text-xs font-semibold">{card.unique_id}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1 text-xs">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {card.marketplace_name || '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium">
                          {card.total_items_collected} / {limit}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={remaining <= 0 ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {remaining}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {card.activated_at
                            ? format(new Date(card.activated_at), 'MMM d, HH:mm')
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
