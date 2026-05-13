import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowLeft, BarChart3, Package, Users, Store, TrendingUp,
  Calendar, Loader2, Download, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { VolunteerCheckInEvidence } from './VolunteerCheckInEvidence';

interface Props {
  onBack: () => void;
}

interface MarketplaceRow {
  id: string;
  name: string;
  event_date: string | null;
  status: string;
  location: string | null;
  outreach_partner: string | null;
  allocated: number;
  distributed: number;
  volunteersAttended: number;
  beneficiariesServed: number;
  totalFamilies: number;
  totalAdults: number;
  totalChildren: number;
}

export const FullReport = ({ onBack }: Props) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'active' | 'upcoming'>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['full-report'],
    queryFn: async () => {
      const [marketplaces, allocations, vCards, qrCards] = await Promise.all([
        fetchAllRows(() =>
          supabase
            .from('marketplace_events')
            .select('id, name, event_date, status, location, outreach_partner, demographics_total_families, demographics_total_adults, demographics_total_children, manual_beneficiary_count')
            .is('deleted_at', null)
            .order('event_date', { ascending: false, nullsFirst: false })
        ),
        fetchAllRows(() =>
          supabase
            .from('marketplace_item_allocations')
            .select('marketplace_id, allocated_quantity, distributed_quantity')
            .is('deleted_at', null)
        ),
        fetchAllRows(() =>
          supabase
            .from('volunteer_qr_cards')
            .select('marketplace_id, status')
            .is('deleted_at', null)
            .in('status', ['checked_in', 'checked_out'])
        ),
        fetchAllRows(() =>
          supabase
            .from('qr_cards')
            .select('marketplace_id, total_items_collected')
            .is('deleted_at', null)
            .not('marketplace_id', 'is', null)
        ),
      ]);

      const allocMap = new Map<string, { allocated: number; distributed: number }>();
      for (const a of allocations as any[]) {
        if (!a.marketplace_id) continue;
        const cur = allocMap.get(a.marketplace_id) || { allocated: 0, distributed: 0 };
        cur.allocated += a.allocated_quantity || 0;
        cur.distributed += a.distributed_quantity || 0;
        allocMap.set(a.marketplace_id, cur);
      }

      const volMap = new Map<string, number>();
      for (const v of vCards as any[]) {
        if (!v.marketplace_id) continue;
        volMap.set(v.marketplace_id, (volMap.get(v.marketplace_id) || 0) + 1);
      }

      const benMap = new Map<string, number>();
      for (const c of qrCards as any[]) {
        if (!c.marketplace_id) continue;
        benMap.set(c.marketplace_id, (benMap.get(c.marketplace_id) || 0) + 1);
      }

      const rows: MarketplaceRow[] = (marketplaces as any[]).map((m) => {
        const a = allocMap.get(m.id) || { allocated: 0, distributed: 0 };
        return {
          id: m.id,
          name: m.name,
          event_date: m.event_date,
          status: m.status,
          location: m.location,
          outreach_partner: m.outreach_partner,
          allocated: a.allocated,
          distributed: a.distributed,
          volunteersAttended: volMap.get(m.id) || 0,
          beneficiariesServed: m.manual_beneficiary_count ?? (benMap.get(m.id) || 0),
          totalFamilies: m.demographics_total_families || 0,
          totalAdults: m.demographics_total_adults || 0,
          totalChildren: m.demographics_total_children || 0,
        };
      });

      return rows;
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data, search, statusFilter]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.marketplaces += 1;
        acc.allocated += r.allocated;
        acc.distributed += r.distributed;
        acc.volunteers += r.volunteersAttended;
        acc.beneficiaries += r.beneficiariesServed;
        acc.families += r.totalFamilies;
        return acc;
      },
      { marketplaces: 0, allocated: 0, distributed: 0, volunteers: 0, beneficiaries: 0, families: 0 }
    );
  }, [filtered]);

  const exportCsv = () => {
    const header = ['Marketplace', 'Date', 'Status', 'Location', 'Partner', 'Allocated', 'Distributed', 'Remaining', 'Volunteers', 'Beneficiaries', 'Families', 'Adults', 'Children'];
    const rows = filtered.map((r) => [
      r.name, r.event_date || '', r.status, r.location || '', r.outreach_partner || '',
      r.allocated, r.distributed, Math.max(r.allocated - r.distributed, 0),
      r.volunteersAttended, r.beneficiariesServed, r.totalFamilies, r.totalAdults, r.totalChildren,
    ]);
    const csv = [header, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `full-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (s: string) => {
    const cls = s === 'completed' ? 'bg-emerald-500' :
                s === 'active' ? 'bg-blue-500' :
                s === 'upcoming' ? 'bg-amber-500' : 'bg-muted';
    return <Badge className={`${cls} text-white capitalize`}>{s}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" /> Full Report
            </h1>
            <p className="text-sm text-muted-foreground">Aggregated summary across all marketplaces</p>
          </div>
        </div>
        <Button onClick={exportCsv} disabled={!filtered.length}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard icon={Store} label="Marketplaces" value={totals.marketplaces} color="text-primary" />
        <SummaryCard icon={Package} label="Allocated" value={totals.allocated} color="text-amber-600" />
        <SummaryCard icon={TrendingUp} label="Distributed" value={totals.distributed} color="text-emerald-600" />
        <SummaryCard icon={Package} label="Remaining" value={Math.max(totals.allocated - totals.distributed, 0)} color="text-rose-600" />
        <SummaryCard icon={Users} label="Volunteers" value={totals.volunteers} color="text-blue-600" />
        <SummaryCard icon={Users} label="Beneficiaries" value={totals.beneficiaries} color="text-violet-600" />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Marketplaces
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-9 w-64"
                  placeholder="Search marketplace..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-1">
                {(['all', 'completed', 'active', 'upcoming'] as const).map((s) => (
                  <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'}
                    onClick={() => setStatusFilter(s)} className="capitalize">
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No marketplaces match the filter.</div>
          ) : (
            <div className="border rounded-lg overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Marketplace</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Allocated</TableHead>
                    <TableHead className="text-right">Distributed</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Volunteers</TableHead>
                    <TableHead className="text-right">Beneficiaries</TableHead>
                    <TableHead className="text-right">Families</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const remaining = Math.max(r.allocated - r.distributed, 0);
                    const pct = r.allocated > 0 ? Math.round((r.distributed / r.allocated) * 100) : 0;
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.name}</div>
                          {r.location && <div className="text-xs text-muted-foreground">{r.location}</div>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.event_date ? format(new Date(r.event_date), 'MMM d, yyyy') : '-'}
                        </TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-right font-mono">{r.allocated.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">
                          {r.distributed.toLocaleString()}
                          {r.allocated > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">({pct}%)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{remaining.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{r.volunteersAttended}</TableCell>
                        <TableCell className="text-right font-mono">{r.beneficiariesServed}</TableCell>
                        <TableCell className="text-right font-mono">{r.totalFamilies}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <VolunteerCheckInEvidence />
    </div>
  );
};

const SummaryCard = ({
  icon: Icon, label, value, color,
}: { icon: React.ElementType; label: string; value: number; color: string }) => (
  <Card>
    <CardContent className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <Icon className={`w-4 h-4 ${color}`} /> {label}
      </div>
      <div className="text-2xl font-bold">{value.toLocaleString()}</div>
    </CardContent>
  </Card>
);
