import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface VolunteerEditData {
  cardId: string;
  name: string;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  hoursWorked: number;
}

interface VolunteerHoursEditDialogProps {
  volunteer: VolunteerEditData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const toLocalDatetime = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  // Format as YYYY-MM-DDTHH:MM for datetime-local input
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const calcHours = (checkIn: string, checkOut: string): number => {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, diff / (1000 * 60 * 60));
};

export const VolunteerHoursEditDialog = ({ volunteer, open, onOpenChange }: VolunteerHoursEditDialogProps) => {
  const queryClient = useQueryClient();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [hours, setHours] = useState('');
  const [manualOverride, setManualOverride] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (volunteer && open) {
      const ci = toLocalDatetime(volunteer.checkedInAt);
      const co = toLocalDatetime(volunteer.checkedOutAt);
      setCheckIn(ci);
      setCheckOut(co);
      setHours(volunteer.hoursWorked > 0 ? volunteer.hoursWorked.toFixed(1) : '');
      setManualOverride(false);
    }
  }, [volunteer, open]);

  // Auto-calc hours when times change (unless manually overridden)
  useEffect(() => {
    if (!manualOverride && checkIn && checkOut) {
      setHours(calcHours(checkIn, checkOut).toFixed(1));
    }
  }, [checkIn, checkOut, manualOverride]);

  const handleHoursChange = (val: string) => {
    setManualOverride(true);
    setHours(val);
  };

  const handleSave = async () => {
    if (!volunteer) return;
    setSaving(true);
    try {
      const updateData: Record<string, any> = {};
      if (checkIn) updateData.checked_in_at = new Date(checkIn).toISOString();
      if (checkOut) updateData.checked_out_at = new Date(checkOut).toISOString();
      updateData.total_hours_worked = parseFloat(hours) || 0;

      const { error } = await supabase
        .from('volunteer_qr_cards')
        .update(updateData)
        .eq('id', volunteer.cardId);

      if (error) throw error;

      toast.success('Volunteer hours updated successfully');
      queryClient.invalidateQueries({ queryKey: ['marketplace_report'] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Volunteer Hours</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-muted-foreground text-xs">Volunteer</Label>
            <p className="font-medium">{volunteer?.name}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="check-in">Check-in Time</Label>
            <Input
              id="check-in"
              type="datetime-local"
              value={checkIn}
              onChange={(e) => { setCheckIn(e.target.value); setManualOverride(false); }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="check-out">Check-out Time</Label>
            <Input
              id="check-out"
              type="datetime-local"
              value={checkOut}
              onChange={(e) => { setCheckOut(e.target.value); setManualOverride(false); }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hours">Hours Worked {!manualOverride && checkIn && checkOut && <span className="text-xs text-muted-foreground">(auto-calculated)</span>}</Label>
            <Input
              id="hours"
              type="number"
              step="0.1"
              min="0"
              value={hours}
              onChange={(e) => handleHoursChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
