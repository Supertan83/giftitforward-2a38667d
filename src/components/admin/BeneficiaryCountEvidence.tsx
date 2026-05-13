import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, Loader2, Users2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';

const downloadCsv = (filename: string, rows: (string | number)[][]) => {
  const csv = rows
    .map((row) => row.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const BeneficiaryCountEvidence = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['beneficiary-count-evidence'],
    queryFn: async () => {
      const [mps, qrCards, pending] = await Promise.all([
        fetchAllRows<any>(() =>
          supabase
            .from('marketplace_events')
            .select('id, name, event_date, location, manual_beneficiary_count, demographics_total_families, demographics_total_adults, demographics_total_children, demographics_reach, demographics_notes')
            .is('deleted_at', null)
            .order('event_date', { ascending: false, nullsFirst: false })
        ),
        fetchAllRows<any>(() =>
          supabase
            .from('qr_cards')
            .select('id, marketplace_id, status, activated_at, children_count')
            .is('deleted_at', null)
            .not('marketplace_id', 'is', null)
        ),
        fetchAllRows<any>(() =>
          supabase
            .from('pending_beneficiaries')
            .select('id, marketplace_id, marketplace_event_id, items_collected, children_count, age_0_17_count, age_18_30_count, age_31_40_count, age_41_50_count, age_51_60_count, age_61_plus_count')
            .is('deleted_at', null)
        ),
      ]);

      const qrByMp = new Map<string, { activated: number; checked: number; childrenSum: number }>();
      for (const c of qrCards) {
        const k = c.marketplace_id;
        const cur = qrByMp.get(k) || { activated: 0, checked: 0, childrenSum: 0 };
        cur.activated++;
        if (c.activated_at || c.status === 'active' || c.status === 'checked_out') cur.checked++;
        cur.childrenSum += c.children_count || 0;
        qrByMp.set(k, cur);
      }

      const pendByMp = new Map<string, number>();
      for (const p of pending) {
        const k = p.marketplace_id || p.marketplace_event_id;
        if (!k) continue;
        pendByMp.set(k, (pendByMp.get(k) || 0) + 1);
      }

      const rows = mps.map((m: any) => {
        const qr = qrByMp.get(m.id) || { activated: 0, checked: 0, childrenSum: 0 };
        const onsite = pendByMp.get(m.id) || 0;
        const manual = m.manual_beneficiary_count;
        const families = m.demographics_total_families || 0;
        const reach = m.demographics_reach || 0;

        let method = 'QR card activations';
        let final = qr.activated;
        const assumptions: string[] = [];

        if (manual != null && manual > 0) {
          method = 'Verified attendance count';
          final = manual;
          if (qr.activated > 0 && qr.activated !== manual) {
            assumptions.push(`Verified count reconciles QR records (${qr.activated}) with on-site attendance (${manual})`);
          }
        } else if (qr.activated === 0 && families > 0) {
          method = 'Demographic data';
          final = families;
          assumptions.push('Counted from registered family demographics');
        } else if (qr.activated === 0 && onsite > 0) {
          method = 'On-site registration';
          final = onsite;
          assumptions.push('Counted from on-site beneficiary registration forms');
        }

        const sources: string[] = [];
        if (qr.activated > 0) sources.push(`QR (${qr.activated})`);
        if (onsite > 0) sources.push(`On-site forms (${onsite})`);
        if (manual != null) sources.push(`Verified count (${manual})`);
        if (families > 0) sources.push(`Demographics (${families} families)`);

        return {
          id: m.id,
          name: m.name,
          date: m.event_date,
          location: m.location || '',
          method,
          final,
          qrActivated: qr.activated,
          onsite,
          manual: manual ?? null,
          families,
          reach,
          adults: m.demographics_total_adults || 0,
          children: m.demographics_total_children || 0,
          notes: m.demographics_notes || '',
          assumptions: assumptions.join('; '),
          sources: sources.join(' · '),
        };
      });

      const totals = rows.reduce(
        (acc, r) => {
          acc.beneficiaries += r.final;
          acc.qr += r.qrActivated;
          acc.onsite += r.onsite;
          acc.manualEvents += r.manual != null ? 1 : 0;
          acc.families += r.families;
          return acc;
        },
        { beneficiaries: 0, qr: 0, onsite: 0, manualEvents: 0, families: 0 }
      );

      return { rows, totals };
    },
  });

  const exportConsolidated = () => {
    if (!data) return;
    const header = ['Marketplace', 'Date', 'Location', 'Beneficiaries (final)', 'Counting Method', 'QR Activations', 'On-site Forms', 'Verified Count', 'Families', 'Adults', 'Children', 'Demographic Reach', 'Sources Used', 'Assumptions', 'Notes'];
    const rows = data.rows.map((r) => [
      r.name, r.date || '', r.location, r.final, r.method,
      r.qrActivated, r.onsite, r.manual ?? '', r.families, r.adults, r.children, r.reach,
      r.sources, r.assumptions, r.notes,
    ]);
    downloadCsv(`beneficiary-count-evidence-${format(new Date(), 'yyyy-MM-dd')}.csv`, [header, ...rows]);
  };

  const exportMethods = () => {
    if (!data) return;
    const header = ['Marketplace', 'Date', 'Method', 'Final Count', 'Assumptions'];
    const rows = data.rows.map((r) => [r.name, r.date || '', r.method, r.final, r.assumptions]);
    downloadCsv(`beneficiary-counting-methods-${format(new Date(), 'yyyy-MM-dd')}.csv`, [header, ...rows]);
  };

  const methodBadge = (method: string) => {
    const cls =
      method === 'Verified attendance count' ? 'bg-emerald-600' :
      method === 'QR card activations' ? 'bg-emerald-500' :
      method === 'Demographic data' ? 'bg-blue-500' :
      method === 'On-site registration' ? 'bg-violet-500' : 'bg-muted';
    return <Badge className={`${cls} text-white text-xs`}>{method}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users2 className="w-5 h-5 text-primary" />
            Beneficiary Count Evidence
          </CardTitle>
          <Button onClick={exportConsolidated} disabled={isLoading || !data} size="sm">
            <Download className="w-4 h-4 mr-2" /> Download consolidated CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <Chip label="Total Beneficiaries" value={data.totals.beneficiaries} color="text-primary" />
              <Chip label="From QR" value={data.totals.qr} color="text-emerald-600" />
              <Chip label="On-site Forms" value={data.totals.onsite} color="text-violet-600" />
              <Chip label="Verified Counts" value={data.totals.manualEvents} color="text-emerald-700" />
              <Chip label="Families (demo)" value={data.totals.families} color="text-blue-600" />
            </div>

            {/* Methodology note */}
            <div className="rounded-lg border bg-muted/30 p-3 mb-4 text-sm flex gap-2">
              <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-muted-foreground">
                <strong className="text-foreground">Consolidation rule:</strong> QR card activations are the primary measurement.
                Where on-site verified attendance counts are available, they take precedence to reflect actual reach.
                Demographic family data and on-site registration forms are used as supporting sources when QR activations
                are unavailable (flagged under Assumptions).
              </div>
            </div>

            <Tabs defaultValue="byEvent">
              <TabsList>
                <TabsTrigger value="byEvent">By Event</TabsTrigger>
                <TabsTrigger value="methods">Counting Methods</TabsTrigger>
                <TabsTrigger value="assumptions">Assumptions</TabsTrigger>
              </TabsList>

              <TabsContent value="byEvent" className="space-y-3">
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Final</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">QR</TableHead>
                        <TableHead className="text-right">On-site</TableHead>
                        <TableHead className="text-right">Manual</TableHead>
                        <TableHead className="text-right">Families</TableHead>
                        <TableHead>Sources</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="font-medium text-sm">{r.name}</div>
                            {r.location && <div className="text-xs text-muted-foreground">{r.location}</div>}
                          </TableCell>
                          <TableCell className="text-sm">{r.date ? format(new Date(r.date), 'MMM d, yyyy') : '-'}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{r.final.toLocaleString()}</TableCell>
                          <TableCell>{methodBadge(r.method)}</TableCell>
                          <TableCell className="text-right font-mono">{r.qrActivated}</TableCell>
                          <TableCell className="text-right font-mono">{r.onsite}</TableCell>
                          <TableCell className="text-right font-mono">{r.manual ?? '-'}</TableCell>
                          <TableCell className="text-right font-mono">{r.families}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.sources}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="methods" className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={exportMethods}>
                    <Download className="w-4 h-4 mr-2" /> Download CSV
                  </Button>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Method Used</TableHead>
                        <TableHead className="text-right">Final Count</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-sm">{r.date ? format(new Date(r.date), 'MMM d, yyyy') : '-'}</TableCell>
                          <TableCell>{methodBadge(r.method)}</TableCell>
                          <TableCell className="text-right font-mono">{r.final.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="assumptions" className="space-y-3">
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Assumptions / Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows
                        .filter((r) => r.assumptions || r.notes)
                        .map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium align-top">{r.name}</TableCell>
                            <TableCell className="text-sm">
                              {r.assumptions && <div className="text-amber-700 dark:text-amber-400">{r.assumptions}</div>}
                              {r.notes && <div className="text-muted-foreground mt-1">{r.notes}</div>}
                            </TableCell>
                          </TableRow>
                        ))}
                      {data.rows.filter((r) => r.assumptions || r.notes).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-sm text-muted-foreground py-6">
                            No assumptions recorded — all counts are direct measurements.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const Chip = ({ label, value, color = 'text-foreground' }: { label: string; value: number; color?: string }) => (
  <div className="rounded-lg border p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className={`text-xl font-bold ${color}`}>{value.toLocaleString()}</div>
  </div>
);
