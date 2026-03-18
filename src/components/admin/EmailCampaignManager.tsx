import React, { useState } from 'react';
import { ArrowLeft, Plus, Send, Clock, Trash2, Eye, Loader2, Users, Mail, CalendarClock, CheckCircle2, XCircle, AlertCircle, ScrollText, Pencil, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { useMarketplaces } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { EmailAutomationsTab } from './EmailAutomationsTab';

interface EmailCampaignManagerProps {
  onBack: () => void;
}

interface Campaign {
  id: string;
  template_id: string;
  name: string;
  recipient_filter: any;
  scheduled_at: string | null;
  sent_at: string | null;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface CampaignRecipient {
  id: string;
  campaign_id: string;
  volunteer_id: string | null;
  recipient_email: string;
  recipient_name: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

interface CampaignLog {
  id: string;
  email_type: string;
  recipient_email: string;
  provider: string;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  draft: { label: 'Draft', variant: 'secondary', icon: AlertCircle },
  scheduled: { label: 'Scheduled', variant: 'outline', icon: CalendarClock },
  sending: { label: 'Sending...', variant: 'default', icon: Loader2 },
  sent: { label: 'Sent', variant: 'default', icon: CheckCircle2 },
  failed: { label: 'Failed', variant: 'destructive', icon: XCircle },
};

export const EmailCampaignManager: React.FC<EmailCampaignManagerProps> = ({ onBack }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: templates = [] } = useEmailTemplates();
  const { data: marketplaces = [] } = useMarketplaces();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('campaigns');
  const [logFilterCampaign, setLogFilterCampaign] = useState<string>('all');
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formTemplateId, setFormTemplateId] = useState('');
  const [formRecipientType, setFormRecipientType] = useState<'all' | 'marketplace' | 'manual' | 'pending_training'>('all');
  const [formMarketplaceId, setFormMarketplaceId] = useState('');
  const [formManualEmails, setFormManualEmails] = useState('');
  const [formScheduleEnabled, setFormScheduleEnabled] = useState(false);
  const [formScheduledAt, setFormScheduledAt] = useState('');

  // Fetch campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['email-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_campaigns' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Campaign[];
    },
  });

  // Fetch campaign send logs
  const { data: campaignLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['email-campaign-logs', logFilterCampaign],
    queryFn: async () => {
      let query = supabase
        .from('email_send_logs')
        .select('*')
        .like('email_type', 'campaign:%')
        .order('created_at', { ascending: false })
        .limit(200);

      if (logFilterCampaign !== 'all') {
        query = query.eq('email_type', `campaign:${logFilterCampaign}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as CampaignLog[];
    },
    enabled: activeTab === 'logs',
  });

  // Fetch recipients for selected campaign
  const { data: recipients = [], isLoading: recipientsLoading } = useQuery({
    queryKey: ['email-campaign-recipients', selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const { data, error } = await supabase
        .from('email_campaign_recipients' as any)
        .select('*')
        .eq('campaign_id', selectedCampaignId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CampaignRecipient[];
    },
    enabled: !!selectedCampaignId,
  });

  const resetForm = () => {
    setFormName('');
    setFormTemplateId('');
    setFormRecipientType('all');
    setFormMarketplaceId('');
    setFormManualEmails('');
    setFormScheduleEnabled(false);
    setFormScheduledAt('');
  };

  const createCampaign = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();

      // Build recipient filter
      let recipientFilter: any = { type: formRecipientType };
      if (formRecipientType === 'marketplace') {
        recipientFilter.marketplace_id = formMarketplaceId;
      } else if (formRecipientType === 'manual') {
        recipientFilter.emails = formManualEmails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
      }

      // Resolve recipients
      let recipientsList: { email: string; name: string; volunteer_id: string | null }[] = [];

      if (formRecipientType === 'all') {
        const { data: volunteers } = await supabase
          .from('pending_volunteers')
          .select('id, first_name, last_name, email')
          .eq('status', 'approved');
        recipientsList = (volunteers || []).map(v => ({
          email: v.email,
          name: `${v.first_name} ${v.last_name}`,
          volunteer_id: v.id,
        }));
      } else if (formRecipientType === 'marketplace') {
        const mp = marketplaces.find(m => m.id === formMarketplaceId);
        const mpName = mp?.name || '';
        const { data: volunteers } = await supabase
          .from('pending_volunteers')
          .select('id, first_name, last_name, email, events_list')
          .eq('status', 'approved');
        recipientsList = (volunteers || [])
          .filter(v => v.events_list?.toLowerCase().includes(mpName.toLowerCase()))
          .map(v => ({
            email: v.email,
            name: `${v.first_name} ${v.last_name}`,
            volunteer_id: v.id,
          }));
      } else if (formRecipientType === 'manual') {
        const emails = formManualEmails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
        recipientsList = emails.map(email => ({
          email,
          name: email.split('@')[0],
          volunteer_id: null,
        }));
      }

      if (recipientsList.length === 0) {
        throw new Error('No recipients found for this filter');
      }

      // Create campaign
      const campaignData: any = {
        name: formName,
        template_id: formTemplateId,
        recipient_filter: recipientFilter,
        status: formScheduleEnabled ? 'scheduled' : 'draft',
        scheduled_at: formScheduleEnabled && formScheduledAt ? new Date(formScheduledAt).toISOString() : null,
        total_recipients: recipientsList.length,
        created_by: userData.user?.id,
      };

      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns' as any)
        .insert(campaignData)
        .select()
        .single();

      if (campaignError) throw campaignError;
      const campaignId = (campaign as any).id;

      // Insert recipients
      const recipientRows = recipientsList.map(r => ({
        campaign_id: campaignId,
        volunteer_id: r.volunteer_id,
        recipient_email: r.email,
        recipient_name: r.name,
        status: 'pending',
      }));

      const { error: recipError } = await supabase
        .from('email_campaign_recipients' as any)
        .insert(recipientRows as any);

      if (recipError) throw recipError;

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campaign Created', description: 'Email campaign has been created successfully' });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleSendNow = async (campaignId: string, retryFailedOnly = false) => {
    setIsSending(campaignId);
    try {
      const { data, error } = await supabase.functions.invoke('send-campaign-email', {
        body: { campaign_id: campaignId, retry_failed_only: retryFailedOnly },
      });
      if (error) throw error;
      toast({
        title: retryFailedOnly ? 'Failed Emails Resent' : 'Campaign Sent',
        description: `Sent: ${data?.sent || 0}, Failed: ${data?.failed || 0}`,
      });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
    } catch (error) {
      toast({
        title: 'Send Failed',
        description: error instanceof Error ? error.message : 'Failed to send campaign',
        variant: 'destructive',
      });
    } finally {
      setIsSending(null);
    }
  };

  const handleCancelSending = async (campaignId: string) => {
    try {
      await supabase
        .from('email_campaigns' as any)
        .update({ status: 'sent' })
        .eq('id', campaignId);
      // Reset any remaining pending recipients to failed so they can be retried later
      await supabase
        .from('email_campaign_recipients' as any)
        .update({ status: 'failed', error_message: 'Cancelled by admin' })
        .eq('campaign_id', campaignId)
        .eq('status', 'pending');
      toast({ title: 'Campaign Cancelled', description: 'Remaining unsent emails have been stopped. You can retry failed ones later.' });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
    }
  };

  const handleDelete = async (campaignId: string) => {
    try {
      // Delete recipients first
      await supabase
        .from('email_campaign_recipients' as any)
        .delete()
        .eq('campaign_id', campaignId);

      const { error } = await supabase
        .from('email_campaigns' as any)
        .delete()
        .eq('id', campaignId);
      if (error) throw error;
      toast({ title: 'Campaign Deleted' });
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
    } catch (error) {
      toast({ title: 'Error', description: (error as Error).message, variant: 'destructive' });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleEditCampaign = (campaign: Campaign) => {
    setEditingCampaignId(campaign.id);
    setFormName(campaign.name);
    setFormTemplateId(campaign.template_id);
    const filter = campaign.recipient_filter || { type: 'all' };
    setFormRecipientType(filter.type || 'all');
    setFormMarketplaceId(filter.marketplace_id || '');
    setFormManualEmails(Array.isArray(filter.emails) ? filter.emails.join('\n') : '');
    setFormScheduleEnabled(!!campaign.scheduled_at);
    setFormScheduledAt(campaign.scheduled_at ? new Date(campaign.scheduled_at).toISOString().slice(0, 16) : '');
    setShowCreateDialog(true);
  };

  const updateCampaign = useMutation({
    mutationFn: async () => {
      if (!editingCampaignId) throw new Error('No campaign selected');

      let recipientFilter: any = { type: formRecipientType };
      if (formRecipientType === 'marketplace') {
        recipientFilter.marketplace_id = formMarketplaceId;
      } else if (formRecipientType === 'manual') {
        recipientFilter.emails = formManualEmails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
      }

      const updateData: any = {
        name: formName,
        template_id: formTemplateId,
        recipient_filter: recipientFilter,
        scheduled_at: formScheduleEnabled && formScheduledAt ? new Date(formScheduledAt).toISOString() : null,
        status: formScheduleEnabled ? 'scheduled' : 'draft',
      };

      const { error } = await supabase
        .from('email_campaigns' as any)
        .update(updateData)
        .eq('id', editingCampaignId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast({ title: 'Campaign Updated', description: 'Campaign has been updated successfully' });
      setShowCreateDialog(false);
      setEditingCampaignId(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const getTemplateName = (templateId: string) => {
    return templates.find(t => t.id === templateId)?.name || 'Unknown Template';
  };

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId);

  return (
    <div className="py-4 md:py-6 px-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold">Email Campaigns</h1>
            <p className="text-sm text-muted-foreground">Send templates to volunteers manually or on a schedule</p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setEditingCampaignId(null); setShowCreateDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" /> New Campaign
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns" className="gap-2"><Mail className="h-4 w-4" /> Campaigns</TabsTrigger>
          <TabsTrigger value="automations" className="gap-2"><Zap className="h-4 w-4" /> Automations</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2"><ScrollText className="h-4 w-4" /> Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          {/* Campaign List */}
          {campaignsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Mail className="h-12 w-12 mb-3 opacity-40" />
                <p className="font-medium">No campaigns yet</p>
                <p className="text-sm">Create your first email campaign to get started</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Template</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map(campaign => {
                      const config = statusConfig[campaign.status] || statusConfig.draft;
                      const StatusIcon = config.icon;
                      return (
                        <TableRow key={campaign.id}>
                          <TableCell className="font-medium">{campaign.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{getTemplateName(campaign.template_id)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Users className="h-3.5 w-3.5" />
                              <span>{campaign.total_recipients}</span>
                              {campaign.status === 'sent' && (
                                <span className="text-muted-foreground ml-1">
                                  ({campaign.sent_count}✓ {campaign.failed_count > 0 ? `${campaign.failed_count}✗` : ''})
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={config.variant} className="gap-1">
                              <StatusIcon className={`h-3 w-3 ${campaign.status === 'sending' ? 'animate-spin' : ''}`} />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {campaign.scheduled_at
                              ? format(new Date(campaign.scheduled_at), 'MMM d, yyyy HH:mm')
                              : campaign.sent_at
                                ? `Sent ${format(new Date(campaign.sent_at), 'MMM d, HH:mm')}`
                                : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setSelectedCampaignId(campaign.id); setShowDetailDialog(true); }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditCampaign(campaign)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={isSending === campaign.id}
                                  onClick={() => handleSendNow(campaign.id)}
                                >
                                  {isSending === campaign.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Send className="h-4 w-4 text-emerald-600" />}
                                </Button>
                              )}
                              {campaign.status === 'sent' && campaign.failed_count > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={isSending === campaign.id}
                                  onClick={() => handleSendNow(campaign.id, true)}
                                  className="text-orange-600 text-xs gap-1"
                                >
                                  {isSending === campaign.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Send className="h-3.5 w-3.5" />}
                                  Retry {campaign.failed_count} Failed
                                </Button>
                              )}
                              {campaign.status === 'sending' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelSending(campaign.id)}
                                  className="text-destructive text-xs gap-1"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Cancel
                                </Button>
                              )}
                              {campaign.status !== 'sending' && (
                                <Button variant="ghost" size="icon" onClick={() => setDeleteConfirmId(campaign.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="automations">
          <EmailAutomationsTab />
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Campaign Send Logs</CardTitle>
                <Select value={logFilterCampaign} onValueChange={setLogFilterCampaign}>
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Filter by campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campaigns</SelectItem>
                    {campaigns.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {logsLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : campaignLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <ScrollText className="h-10 w-10 mb-2 opacity-40" />
                  <p className="text-sm">No campaign logs yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaignLogs.map(log => (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium text-sm">
                          {log.email_type.replace('campaign:', '')}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.recipient_email}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{log.provider}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.success ? 'default' : 'destructive'}>
                            {log.success ? 'Sent' : 'Failed'}
                          </Badge>
                          {log.error_message && (
                            <p className="text-xs text-destructive mt-1 max-w-[200px] truncate" title={log.error_message}>
                              {log.error_message}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) setEditingCampaignId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCampaignId ? 'Edit Campaign' : 'Create Email Campaign'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Campaign Name</Label>
              <Input placeholder="e.g. Follow-up Reminder" value={formName} onChange={e => setFormName(e.target.value)} />
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
              <Label>Recipients</Label>
              <Select value={formRecipientType} onValueChange={(v: any) => setFormRecipientType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Approved Volunteers</SelectItem>
                  <SelectItem value="marketplace">By Marketplace</SelectItem>
                  <SelectItem value="manual">Manual Email List</SelectItem>
                  <SelectItem value="pending_training">Pending – CE Module Incomplete</SelectItem>
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

            {formRecipientType === 'manual' && (
              <div>
                <Label>Email Addresses (one per line, or comma-separated)</Label>
                <Textarea
                  placeholder="user1@example.com&#10;user2@example.com"
                  value={formManualEmails}
                  onChange={e => setFormManualEmails(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch checked={formScheduleEnabled} onCheckedChange={setFormScheduleEnabled} />
              <Label>Schedule for later</Label>
            </div>

            {formScheduleEnabled && (
              <div>
                <Label>Send At</Label>
                <Input
                  type="datetime-local"
                  value={formScheduledAt}
                  onChange={e => setFormScheduledAt(e.target.value)}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingCampaignId(null); }}>Cancel</Button>
            {editingCampaignId ? (
              <Button
                onClick={() => updateCampaign.mutate()}
                disabled={!formName || !formTemplateId || updateCampaign.isPending}
              >
                {updateCampaign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            ) : (
              <Button
                onClick={() => createCampaign.mutate()}
                disabled={!formName || !formTemplateId || createCampaign.isPending}
              >
                {createCampaign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Campaign
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Campaign Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCampaign?.name || 'Campaign Details'}</DialogTitle>
          </DialogHeader>

          {selectedCampaign && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{selectedCampaign.total_recipients}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-600">{selectedCampaign.sent_count}</p>
                    <p className="text-xs text-muted-foreground">Sent</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-destructive">{selectedCampaign.failed_count}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">
                      {selectedCampaign.total_recipients - selectedCampaign.sent_count - selectedCampaign.failed_count}
                    </p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </CardContent>
                </Card>
              </div>

              {recipientsLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Sent At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{r.recipient_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.recipient_email}</TableCell>
                        <TableCell>
                          <Badge variant={r.status === 'sent' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'}>
                            {r.status}
                          </Badge>
                          {r.error_message && (
                            <p className="text-xs text-destructive mt-1">{r.error_message}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {r.sent_at ? format(new Date(r.sent_at), 'MMM d, HH:mm') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This will also remove all recipient records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
