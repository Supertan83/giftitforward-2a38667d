import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export interface BulkVolunteerEditTarget {
  cardId: string;
  name: string;
}

interface Props {
  volunteers: BulkVolunteerEditTarget[];
  marketplaceId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

type Mode = 'set_hours' | 'set_times' | 'clear';

const calcHours = (checkIn: string, checkOut: string): number => {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, diff / (1000 * 60 * 60));
};

// Run async tasks with limited concurrency
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let done = 0;
  const total = items.length;
  const runners = Array.from({ length: Math.min(limit, total) }, async () => {
    while (cursor < total) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
      done++;
      onProgress?.(done, total);
    }
  });
  await Promise.all(runners);
  return results;
}

export const VolunteerBulkHoursEditDialog = ({
  volunteers,
  marketplaceId,
  open,
  onOpenChange,
  onCompleted,
}: Props) => {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('set_hours');
  const [hours, setHours] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (open) {
      setMode('set_hours');
      setHours('');
      setCheckIn('');
      setCheckOut('');
      setProgress(null);
    }
  }, [open]);

  const computedHours = mode === 'set_times' && checkIn && checkOut ? calcHours(checkIn, checkOut) : 0;

  const isValid = (() => {
    if (saving) return false;
    if (volunteers.length === 0) return false;
    if (mode === 'set_hours') {
      const n = parseFloat(hours);
      return !isNaN(n) && n >= 0;
    }
    if (mode === 'set_times') {
      return !!checkIn && !!checkOut && new Date(checkOut) > new Date(checkIn);
    }
    return true; // clear
  })();

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    setProgress({ done: 0, total: volunteers.length });

    let failures = 0;

    const updateOne = async ({ cardId }: BulkVolunteerEditTarget) => {
      try {
        const cardUpdate: Record<string, any> = {};
        const attUpdate: Record<string, any> = {};

        if (mode === 'set_hours') {
          const h = parseFloat(hours) || 0;
          cardUpdate.total_hours_worked = h;
          attUpdate.hours_worked = h;
        } else if (mode === 'set_times') {
          const ci = new Date(checkIn).toISOString();
          const co = new Date(checkOut).toISOString();
          cardUpdate.checked_in_at = ci;
          cardUpdate.checked_out_at = co;
          cardUpdate.total_hours_worked = computedHours;
          attUpdate.check_in_time = ci;
          attUpdate.check_out_time = co;
          attUpdate.hours_worked = computedHours;
        } else {
          // clear
          cardUpdate.total_hours_worked = 0;
          cardUpdate.checked_in_at = null;
          cardUpdate.checked_out_at = null;
          attUpdate.hours_worked = 0;
          attUpdate.check_out_time = null;
        }

        const { error: cardErr } = await supabase
          .from('volunteer_qr_cards')
          .update(cardUpdate)
          .eq('id', cardId);
        if (cardErr) throw cardErr;

        if (marketplaceId) {
          const { data: attRecords } = await supabase
            .from('volunteer_attendance')
            .select('id')
            .eq('volunteer_card_id', cardId)
            .eq('marketplace_id', marketplaceId)
            .order('check_in_time', { ascending: false })
            .limit(1);

          if (attRecords && attRecords.length > 0) {
            await supabase
              .from('volunteer_attendance')
              .update(attUpdate)
              .eq('id', attRecords[0].id);
          }
        }
      } catch (err) {
        failures++;
        console.error('Bulk hours update failed for card', cardId, err);
      }
    };

    await runWithConcurrency(volunteers, 4, updateOne, (done, total) => {
      setProgress({ done, total });
    });

    const succeeded = volunteers.length - failures;
    if (succeeded > 0) toast.success(`Updated ${succeeded} volunteer${succeeded === 1 ? '' : 's'}`);
    if (failures > 0) toast.error(`${failures} update${failures === 1 ? '' : 's'} failed`);

    queryClient.invalidateQueries({ queryKey: ['marketplace_report'] });
    setSaving(false);
    setProgress(null);
    onOpenChange(false);
    onCompleted?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk Edit Volunteer Hours</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-muted-foreground text-xs">
              {volunteers.length} volunteer{volunteers.length === 1 ? '' : 's'} selected
            </Label>
            <ScrollArea className="h-24 mt-1 rounded-md border bg-muted/30 p-2">
              <ul className="text-xs space-y-0.5">
                {volunteers.map((v) => (
                  <li key={v.cardId} className="truncate">{v.name}</li>
                ))}
              </ul>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label>Action</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="set_hours" id="mode-hours" />
                <Label htmlFor="mode-hours" className="font-normal cursor-pointer">Set hours to a fixed value</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="set_times" id="mode-times" />
                <Label htmlFor="mode-times" className="font-normal cursor-pointer">Set check-in / check-out times</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="clear" id="mode-clear" />
                <Label htmlFor="mode-clear" className="font-normal cursor-pointer">Clear hours and timestamps</Label>
              </div>
            </RadioGroup>
          </div>

          {mode === 'set_hours' && (
            <div className="space-y-2">
              <Label htmlFor="bulk-hours">Hours Worked</Label>
              <Input
                id="bulk-hours"
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 5.0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
            </div>
          )}

          {mode === 'set_times' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="bulk-check-in">Check-in Time</Label>
                <Input
                  id="bulk-check-in"
                  type="datetime-local"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bulk-check-out">Check-out Time</Label>
                <Input
                  id="bulk-check-out"
                  type="datetime-local"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                />
              </div>
              {checkIn && checkOut && (
                <p className="text-xs text-muted-foreground">
                  Calculated hours: <span className="font-medium">{computedHours.toFixed(1)}h</span>
                </p>
              )}
            </>
          )}

          {mode === 'clear' && (
            <p className="text-xs text-muted-foreground">
              This will set total hours to 0 and clear check-in / check-out timestamps for all selected volunteers.
            </p>
          )}

          {progress && (
            <p className="text-xs text-muted-foreground">
              Updating {progress.done} / {progress.total}…
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={!isValid}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Apply to {volunteers.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
