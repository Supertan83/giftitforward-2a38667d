import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, Loader2, ClipboardCheck, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { resolveCompanyName } from '@/lib/volunteerClassification';

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

const fmt = (d?: string | null) => (d ? format(new Date(d), 'yyyy-MM-dd HH:mm') : '');

export const VolunteerCheckInEvidence = () => {
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['volunteer-checkin-evidence'],
    queryFn: async () => {
      const [cards, vols, mps] = await Promise.all([
        fetchAllRows<any>(() =>
          supabase
            .from('volunteer_qr_cards')
            .select('id, unique_id, volunteer_id, marketplace_id, status, checked_in_at, checked_out_at, total_hours_worked')
            .is('deleted_at', null)
        ),
        fetchAllRows<any>(() =>
          supabase
            .from('pending_volunteers')
            .select('id, first_name, last_name, email, is_employee, external_company, employee_vertical, source, status')
            .is('deleted_at', null)
        ),
        fetchAllRows<any>(() =>
          supabase
            .from('marketplace_events')
            .select('id, name, event_date')
            .is('deleted_at', null)
            .order('event_date', { ascending: false, nullsFirst: false })
        ),
      ]);

      const volMap = new Map<string, any>();
      for (const v of vols) volMap.set(v.id, v);
      const mpMap = new Map<string, any>();
      for (const m of mps) mpMap.set(m.id, m);

      const fullName = (v: any) =>
        v ? `${v.first_name || ''} ${v.last_name || ''}`.trim() : '';

      // Per-volunteer rows
      const perVolunteer = cards.map((c) => {
        const v = c.volunteer_id ? volMap.get(c.volunteer_id) : null;
        const mp = c.marketplace_id ? mpMap.get(c.marketplace_id) : null;
        const source = v?.source || (c.volunteer_id ? 'unknown' : 'manual');
        const isWalkIn = source === 'onsite';
        const isManual = !c.volunteer_id;
        const checkedIn = c.status === 'checked_in' || c.status === 'checked_out';
        const notes: string[] = [];
        if (isWalkIn) notes.push('Walk-in');
        if (isManual) notes.push('Manual adjustment');
        return {
          cardId: c.id,
          uniqueId: c.unique_id,
          volunteerId: c.volunteer_id,
          name: fullName(v) || '(unlinked card)',
          email: v?.email || '',
          company: v ? resolveCompanyName(v) : '',
          type: v?.is_employee ? 'Employee' : v?.external_company ? 'External' : '',
          eventId: c.marketplace_id || '',
          eventName: mp?.name || '',
          eventDate: mp?.event_date || '',
          status: c.status,
          checkedInAt: c.checked_in_at,
          checkedOutAt: c.checked_out_at,
          hours: Number(c.total_hours_worked || 0),
          source,
          checkedIn,
          isWalkIn,
          isManual,
          notes: notes.join('; '),
        };
      });

      // Per-event summary
      const eventAgg = new Map<string, {
        eventId: string; name: string; date: string | null;
        registered: number; checkedIn: number; checkedOut: number; walkIns: number;
      }>();
      for (const m of mps) {
        eventAgg.set(m.id, {
          eventId: m.id, name: m.name, date: m.event_date,
          registered: 0, checkedIn: 0, checkedOut: 0, walkIns: 0,
        });
      }
      for (const r of perVolunteer) {
        if (!r.eventId) continue;
        const a = eventAgg.get(r.eventId);
        if (!a) continue;
        a.registered++;
        if (r.status === 'checked_in') a.checkedIn++;
        if (r.status === 'checked_out') a.checkedOut++;
        if (r.isWalkIn) a.walkIns++;
      }
      const eventSummary = Array.from(eventAgg.values())
        .map((a) => {
          const attended = a.checkedIn + a.checkedOut;
          return {
            ...a,
            attended,
            noShows: Math.max(a.registered - attended, 0),
            attendancePct: a.registered ? Math.round((attended / a.registered) * 100) : 0,
          };
        })
        .filter((a) => a.registered > 0)
        .sort((a, b) =>
          (b.date || '').localeCompare(a.date || '')
        );

      // By company
      const compMap = new Map<string, {
        company: string; total: number; checkedIn: number; hours: number; events: Set<string>;
      }>();
      for (const r of perVolunteer) {
        const key = r.company || 'Unknown';
        if (!compMap.has(key)) {
          compMap.set(key, { company: key, total: 0, checkedIn: 0, hours: 0, events: new Set() });
        }
        const c = compMap.get(key)!;
        c.total++;
        if (r.checkedIn) c.checkedIn++;
        c.hours += r.hours;
        if (r.eventId) c.events.add(r.eventId);
      }
      const byCompany = Array.from(compMap.values())
        .map((c) => ({ ...c, eventsCovered: c.events.size }))
        .sort((a, b) => b.total - a.total);

      const totals = {
        registered: perVolunteer.length,
        checkedIn: perVolunteer.filter((r) => r.checkedIn).length,
        noShows: perVolunteer.filter((r) => r.eventId && !r.checkedIn).length,
        walkIns: perVolunteer.filter((r) => r.isWalkIn).length,
        manual: perVolunteer.filter((r) => r.isManual).length,
      };

      return { perVolunteer, eventSummary, byCompany, totals, mps };
    },
  });

  const filteredPerVol = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.perVolunteer.filter((r) => {
      if (eventFilter !== 'all' && r.eventId !== eventFilter) return false;
      if (q && !`${r.name} ${r.email} ${r.company} ${r.uniqueId}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, eventFilter, search]);

  const exportEventSummary = () => {
    if (!data) return;
    const header = ['Event', 'Date', 'Registered', 'Checked-in', 'Checked-out', 'Attended', 'No-shows', 'Walk-ins', 'Attendance %'];
    const rows = data.eventSummary.map((r) => [
      r.name, r.date || '', r.registered, r.checkedIn, r.checkedOut, r.attended, r.noShows, r.walkIns, `${r.attendancePct}%`,
    ]);
    downloadCsv(`volunteer-event-summary-${format(new Date(), 'yyyy-MM-dd')}.csv`, [header, ...rows]);
  };

  const exportPerVolunteer = () => {
    const header = ['Name', 'Email', 'Company', 'Type', 'Event', 'Event Date', 'Card ID', 'Status', 'Check-in', 'Check-out', 'Hours', 'Source', 'Notes'];
    const rows = filteredPerVol.map((r) => [
      r.name, r.email, r.company, r.type, r.eventName, r.eventDate || '',
      r.uniqueId, r.status, fmt(r.checkedInAt), fmt(r.checkedOutAt),
      r.hours.toFixed(2), r.source, r.notes,
    ]);
    downloadCsv(`volunteer-checkin-sheet-${format(new Date(), 'yyyy-MM-dd')}.csv`, [header, ...rows]);
  };

  const exportByCompany = () => {
    if (!data) return;
    const header = ['Company', 'Total Volunteers', 'Checked-in', 'Hours Contributed', 'Events Covered'];
    const rows = data.byCompany.map((r) => [
      r.company, r.total, r.checkedIn, r.hours.toFixed(2), r.eventsCovered,
    ]);
    downloadCsv(`volunteer-by-company-${format(new Date(), 'yyyy-MM-dd')}.csv`, [header, ...rows]);
  };

  const exportAll = () => {
    exportEventSummary();
    setTimeout(exportPerVolunteer, 250);
    setTimeout(exportByCompany, 500);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            Volunteer Check-in Evidence
          </CardTitle>
          <Button onClick={exportAll} disabled={isLoading || !data} size="sm">
            <Download className="w-4 h-4 mr-2" /> Download all (CSV)
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
            {/* Summary chips */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <Chip label="Registered" value={data.totals.registered} />
              <Chip label="Checked-in" value={data.totals.checkedIn} color="text-emerald-600" />
              <Chip label="No-shows" value={data.totals.noShows} color="text-rose-600" />
              <Chip label="Walk-ins" value={data.totals.walkIns} color="text-blue-600" />
              <Chip label="Manual adj." value={data.totals.manual} color="text-amber-600" />
            </div>

            <Tabs defaultValue="events">
              <TabsList>
                <TabsTrigger value="events">Event Summary</TabsTrigger>
                <TabsTrigger value="volunteers">Per-Volunteer Sheet</TabsTrigger>
                <TabsTrigger value="company">By Company</TabsTrigger>
              </TabsList>

              {/* Event summary */}
              <TabsContent value="events" className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={exportEventSummary}>
                    <Download className="w-4 h-4 mr-2" /> Download CSV
                  </Button>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Registered</TableHead>
                        <TableHead className="text-right">Checked-in</TableHead>
                        <TableHead className="text-right">Checked-out</TableHead>
                        <TableHead className="text-right">No-shows</TableHead>
                        <TableHead className="text-right">Walk-ins</TableHead>
                        <TableHead className="text-right">Attendance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.eventSummary.map((r) => (
                        <TableRow key={r.eventId}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-sm">{r.date ? format(new Date(r.date), 'MMM d, yyyy') : '-'}</TableCell>
                          <TableCell className="text-right font-mono">{r.registered}</TableCell>
                          <TableCell className="text-right font-mono">{r.checkedIn}</TableCell>
                          <TableCell className="text-right font-mono">{r.checkedOut}</TableCell>
                          <TableCell className="text-right font-mono text-rose-600">{r.noShows}</TableCell>
                          <TableCell className="text-right font-mono text-blue-600">{r.walkIns}</TableCell>
                          <TableCell className="text-right font-mono">{r.attendancePct}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Per-volunteer sheet */}
              <TabsContent value="volunteers" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <Select value={eventFilter} onValueChange={setEventFilter}>
                      <SelectTrigger className="w-64 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All events</SelectItem>
                        {data.mps.map((m: any) => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        className="pl-8 h-9 w-64"
                        placeholder="Search name, email, card..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={exportPerVolunteer}>
                    <Download className="w-4 h-4 mr-2" /> Download CSV
                  </Button>
                </div>
                <div className="border rounded-lg overflow-x-auto max-h-[500px] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Volunteer</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Card</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Check-in</TableHead>
                        <TableHead>Check-out</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPerVol.slice(0, 500).map((r) => (
                        <TableRow key={r.cardId}>
                          <TableCell>
                            <div className="font-medium text-sm">{r.name}</div>
                            <div className="text-xs text-muted-foreground">{r.email}</div>
                          </TableCell>
                          <TableCell className="text-sm">{r.company}</TableCell>
                          <TableCell className="text-sm">{r.eventName}</TableCell>
                          <TableCell className="font-mono text-xs">{r.uniqueId}</TableCell>
                          <TableCell>
                            <Badge variant={r.status === 'checked_out' ? 'default' : r.status === 'checked_in' ? 'secondary' : 'outline'} className="capitalize">
                              {r.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{fmt(r.checkedInAt)}</TableCell>
                          <TableCell className="text-xs font-mono">{fmt(r.checkedOutAt)}</TableCell>
                          <TableCell className="text-right font-mono">{r.hours.toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {r.isWalkIn && <Badge variant="secondary" className="text-xs">Walk-in</Badge>}
                              {r.isManual && <Badge variant="outline" className="text-xs">Manual</Badge>}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {filteredPerVol.length > 500 && (
                  <p className="text-xs text-muted-foreground">
                    Showing first 500 of {filteredPerVol.length}. Export CSV for full list.
                  </p>
                )}
              </TabsContent>

              {/* By company */}
              <TabsContent value="company" className="space-y-3">
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" onClick={exportByCompany}>
                    <Download className="w-4 h-4 mr-2" /> Download CSV
                  </Button>
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Total Volunteers</TableHead>
                        <TableHead className="text-right">Checked-in</TableHead>
                        <TableHead className="text-right">Hours Contributed</TableHead>
                        <TableHead className="text-right">Events Covered</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.byCompany.map((r) => (
                        <TableRow key={r.company}>
                          <TableCell className="font-medium">{r.company}</TableCell>
                          <TableCell className="text-right font-mono">{r.total}</TableCell>
                          <TableCell className="text-right font-mono">{r.checkedIn}</TableCell>
                          <TableCell className="text-right font-mono">{r.hours.toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">{r.eventsCovered}</TableCell>
                        </TableRow>
                      ))}
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
