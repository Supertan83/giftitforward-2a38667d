import React, { useState } from 'react';
import { Plus, Loader2, Trash2, Pencil, Play, Pause, Clock, History, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { useMarketplaces } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

interface Automation {
  id: string;
  name: string;
  template_id: string;
  trigger_type: string;
  trigger_days: number;
  trigger_time: string;
  recipient_filter: any;
  is_active: boolean;
  last_run_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface AutomationLog {
  id: string;
  automation_id: string;
  campaign_id: string | null;
  triggered_at: string;
  recipients_count: number;
  status: string;
  notes: string | null;
}

const triggerTypeLabels: Record<string, string> = {
  before_marketplace: 'Before Marketplace',
  after_marketplace: 'After Marketplace',
  after_approval: 'After Volunteer Approval',
  after_training: 'After Training Completion',
};

export const EmailAutomationsTab: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: templates = [] } = useEmailTemplates();
  const { data: marketplaces = [] } = useMarketplaces();

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formTriggerType, setFormTriggerType] = useState('before_marketplace');
  const [formTriggerDays, setFormTriggerDays] = useState(2);
  const [formTriggerTime, setFormTriggerTime] = useState('09:00');
  const [formRecipientType, setFormRecipientType] = useState<'all_upcoming' | 'marketplace' | 'all_approved'>('all_upcoming');
  const [formMarketplaceId, setFormMarketplaceId] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Fetch automations
  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['email-automations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_automations' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Automation[];
    },
  });

  // Fetch logs for expanded automation
  const { data: automationLogs = [] } = useQuery({
    queryKey: ['email-automation-logs', expandedLogId],
    queryFn: async () => {
      if (!expandedLogId) return [];
      const { data, error } = await supabase
        .from('email_automation_logs' as any)
        .select('*')
        .eq('automation_id', expandedLogId)
        .order('triggered_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as AutomationLog[];
    },
    enabled: !!expandedLogId,
  });

  const resetForm = () => {
    setFormName('');
    setFormTemplateId('');
    setFormTriggerType('before_marketplace');
    setFormTriggerDays(2);
    setFormTriggerTime('09:00');
    setFormRecipientType('all_upcoming');
    setFormMarketplaceId('');
    setFormIsActive(true);
    setEditingId(null);
  };

  const buildRecipientFilter = () => {
    if (formRecipientType === 'marketplace') {
      return { type: 'marketplace', marketplace_id: formMarketplaceId };
    }
    return { type: formRecipientType };
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const payload: any = {
        name: formName,
        template_id: formTemplateId,
        trigger_type: formTriggerType,
        trigger_days: formTriggerDays,
        trigger_time: formTriggerTime,
        recipient_filter: buildRecipientFilter(),
        is_active: formIsActive,
      };

      if (editingId) {
        const { error } = await supabase
          .from('email_automations' as any)
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        payload.created_by = userData.user?.id;
        const { error } = await supabase
          .from('email_automations' as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-automations'] });
      toast({ title: editingId ? 'Automation Updated' : 'Automation Created' });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('email_automations' as any)
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-automations'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('email_automations' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-automations'] });
      toast({ title: 'Automation Deleted' });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleEdit = (a: Automation) => {
    setEditingId(a.id);
    setFormName(a.name);
    setFormTemplateId(a.template_id);
    setFormTriggerType(a.trigger_type);
    setFormTriggerDays(a.trigger_days);
    setFormTriggerTime(a.trigger_time?.slice(0, 5) || '09:00');
    const filter = a.recipient_filter || { type: 'all_upcoming' };
    setFormRecipientType(filter.type || 'all_upcoming');
    setFormMarketplaceId(filter.marketplace_id || '');
    setFormIsActive(a.is_active);
    setShowDialog(true);
  };

  const getTemplateName = (id: string) => templates.find(t => t.id === id)?.name || 'Unknown';

  const getTriggerDescription = (a: Automation) => {
    const days = a.trigger_days === 0 ? 'Same day' : `${a.trigger_days} day${a.trigger_days > 1 ? 's' : ''}`;
    const direction = a.trigger_type.startsWith('before') ? 'before' :
      a.trigger_type.startsWith('after') ? 'after' : '';
    const event = a.trigger_type.includes('marketplace') ? 'marketplace' :
      a.trigger_type === 'after_approval' ? 'approval' : 'training';
    return `${days} ${direction} ${event}`;
  };

  const isMarketplaceTrigger = formTriggerType === 'before_marketplace' || formTriggerType === 'after_marketplace';

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Create trigger-based workflows to send emails automatically
        </p>
        <Button onClick={() => { resetForm(); setShowDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Automation
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : automations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Zap className="h-12 w-12 mb-3 opacity-40" />
            <p className="font-medium">No automations yet</p>
            <p className="text-sm">Create your first email automation workflow</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {automations.map(a => (
            <Collapsible key={a.id} open={expandedLogId === a.id} onOpenChange={(open) => setExpandedLogId(open ? a.id : null)}>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Switch
                        checked={a.is_active}
                        onCheckedChange={(checked) => toggleActive.mutate({ id: a.id, is_active: checked })}
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{a.name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <Badge variant="outline" className="text-xs">{getTriggerDescription(a)}</Badge>
                          <span>at {a.trigger_time?.slice(0, 5) || '09:00'} UTC</span>
                          <span>•</span>
                          <span>{getTemplateName(a.template_id)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {a.last_run_at && (
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          Last: {format(new Date(a.last_run_at), 'MMM d, HH:mm')}
                        </span>
                      )}
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" title="View logs">
                          <History className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(a.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>

                <CollapsibleContent>
                  <div className="border-t px-4 pb-4 pt-2">
                    <p className="text-sm font-medium mb-2">Run History</p>
                    {automationLogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No runs recorded yet</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Triggered</TableHead>
                            <TableHead>Recipients</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {automationLogs.map(log => (
                            <TableRow key={log.id}>
                              <TableCell className="text-sm">
                                {format(new Date(log.triggered_at), 'MMM d, yyyy HH:mm')}
                              </TableCell>
                              <TableCell className="text-sm">{log.recipients_count}</TableCell>
                              <TableCell>
                                <Badge variant={log.status === 'success' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}>
                                  {log.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate" title={log.notes || ''}>
                                {log.notes || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Automation' : 'Create Email Automation'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Automation Name</Label>
              <Input placeholder="e.g. Pre-Marketplace Reminder" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>

            <div>
              <Label>Email Template</Label>
              <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                <SelectTrigger><SelectValue placeholder="Select a template" /></SelectTrigger>
                <SelectContent>
                  {templates.filter(t => t.is_active).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.category})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Trigger Type</Label>
              <Select value={formTriggerType} onValueChange={setFormTriggerType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(triggerTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Days {formTriggerType.startsWith('before') ? 'Before' : 'After'}</Label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={formTriggerDays}
                  onChange={e => setFormTriggerDays(parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground mt-1">0 = same day</p>
              </div>
              <div>
                <Label>Time (UTC)</Label>
                <Input
                  type="time"
                  value={formTriggerTime}
                  onChange={e => setFormTriggerTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Recipients</Label>
              <Select value={formRecipientType} onValueChange={(v: any) => setFormRecipientType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isMarketplaceTrigger ? (
                    <>
                      <SelectItem value="all_upcoming">All Volunteers for Matching Marketplaces</SelectItem>
                      <SelectItem value="marketplace">Specific Marketplace Volunteers</SelectItem>
                    </>
                  ) : (
                    <SelectItem value="all_approved">All Approved Volunteers</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {formRecipientType === 'marketplace' && (
              <div>
                <Label>Marketplace</Label>
                <Select value={formMarketplaceId} onValueChange={setFormMarketplaceId}>
                  <SelectTrigger><SelectValue placeholder="Select marketplace" /></SelectTrigger>
                  <SelectContent>
                    {marketplaces.map(mp => (
                      <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
              <Label>Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!formName || !formTemplateId || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Automation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Automation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This will also remove all run history logs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
