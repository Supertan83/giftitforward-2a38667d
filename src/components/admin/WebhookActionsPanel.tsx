import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  UserPlus, 
  Search, 
  UserCog, 
  Loader2, 
  Send,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Mail,
  Copy,
  Check,
  Settings2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { QRCodeSVG } from 'qrcode.react';
import { EmailPreviewDialog } from './EmailPreviewDialog';

interface VolunteerInput {
  email: string;
  name: string;
  phone: string;
}

interface CreateResult {
  email: string;
  status: 'created' | 'failed';
  temp_password?: string;
  qr_card_id?: string;
  error?: string;
}

interface StatusResult {
  email: string;
  exists: boolean;
  user_id?: string;
  has_role: boolean;
  metadata?: {
    name?: string;
    phone?: string;
    onboarded_via?: string;
  };
  created_at?: string;
}

interface UpdateResult {
  success: boolean;
  message?: string;
  error?: string;
  user?: {
    email: string;
    metadata: Record<string, unknown>;
  };
}

export const WebhookActionsPanel = () => {
  const { toast } = useToast();
  
  // Marketplace options state
  const [marketplaces, setMarketplaces] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string>('');

  // Fetch marketplaces on mount
  useEffect(() => {
    const fetchMarketplaces = async () => {
      const { data } = await supabase
        .from('marketplace_events')
        .select('id, name')
        .in('status', ['upcoming', 'active'])
        .order('event_date', { ascending: true });
      if (data) setMarketplaces(data);
    };
    fetchMarketplaces();
  }, []);

  // Create volunteer state
  const [volunteers, setVolunteers] = useState<VolunteerInput[]>([{ email: '', name: '', phone: '' }]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createResults, setCreateResults] = useState<CreateResult[] | null>(null);
  const [resendingEmail, setResendingEmail] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Email customization state
  const [emailCustomOpen, setEmailCustomOpen] = useState(false);
  const [customSubject, setCustomSubject] = useState('');
  const [customGreeting, setCustomGreeting] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  
  // Check status state
  const [checkEmails, setCheckEmails] = useState('');
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkResults, setCheckResults] = useState<StatusResult[] | null>(null);
  
  // Update volunteer state
  const [updateEmail, setUpdateEmail] = useState('');
  const [updateName, setUpdateName] = useState('');
  const [updatePhone, setUpdatePhone] = useState('');
  const [updateActive, setUpdateActive] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateResult | null>(null);

  const addVolunteerRow = () => {
    setVolunteers([...volunteers, { email: '', name: '', phone: '' }]);
  };

  const removeVolunteerRow = (index: number) => {
    if (volunteers.length > 1) {
      setVolunteers(volunteers.filter((_, i) => i !== index));
    }
  };

  const updateVolunteerField = (index: number, field: keyof VolunteerInput, value: string) => {
    const updated = [...volunteers];
    updated[index][field] = value;
    setVolunteers(updated);
  };

  const handleCreateVolunteers = async () => {
    const validVolunteers = volunteers.filter(v => v.email.trim());
    if (validVolunteers.length === 0) {
      toast({
        title: 'No volunteers to create',
        description: 'Please add at least one email address',
        variant: 'destructive',
      });
      return;
    }

    setCreateLoading(true);
    setCreateResults(null);

    try {
      // Build email customization if any values are set
      const emailCustomization = (customSubject.trim() || customGreeting.trim() || customMessage.trim()) ? {
        subject: customSubject.trim() || undefined,
        greeting: customGreeting.trim() || undefined,
        message: customMessage.trim() || undefined,
      } : undefined;

      const { data, error } = await supabase.functions.invoke('webhook-receiver', {
        body: {
          action: 'create_volunteer',
          volunteers: validVolunteers.map(v => ({
            email: v.email.trim(),
            name: v.name.trim() || undefined,
            phone: v.phone.trim() || undefined,
            marketplace_id: selectedMarketplaceId && selectedMarketplaceId !== 'none' ? selectedMarketplaceId : undefined,
          })),
          email_customization: emailCustomization,
        },
      });

      if (error) throw error;

      setCreateResults(data.results?.details || []);
      toast({
        title: 'Volunteers Created',
        description: `Created ${data.results?.created || 0} of ${data.results?.total || 0} volunteers`,
      });
    } catch (error) {
      console.error('Create error:', error);
      toast({
        title: 'Failed to create volunteers',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleResendEmail = async (email: string) => {
    setResendingEmail(email);
    
    try {
      // Get the pending volunteer record
      const { data: volunteer, error: fetchError } = await supabase
        .from('pending_volunteers')
        .select('id, first_name, temp_password')
        .eq('email', email)
        .single();

      if (fetchError || !volunteer) {
        throw new Error('Volunteer not found');
      }

      const { error } = await supabase.functions.invoke('webhook-receiver', {
        body: {
          action: 'resend_email',
          pending_id: volunteer.id,
        },
      });

      if (error) throw error;

      toast({
        title: 'Email Sent',
        description: `Welcome email resent to ${email}`,
      });
    } catch (error) {
      console.error('Resend error:', error);
      toast({
        title: 'Failed to resend email',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setResendingEmail(null);
    }
  };

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
    toast({
      title: 'Copied!',
      description: 'Copied to clipboard',
    });
  };

  const handleCheckStatus = async () => {
    const emails = checkEmails.split(/[,\n]/).map(e => e.trim()).filter(Boolean);
    if (emails.length === 0) {
      toast({
        title: 'No emails to check',
        description: 'Please enter at least one email address',
        variant: 'destructive',
      });
      return;
    }

    setCheckLoading(true);
    setCheckResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('webhook-receiver', {
        body: {
          action: 'check_volunteer_status',
          emails,
        },
      });

      if (error) throw error;

      setCheckResults(data.results || []);
      toast({
        title: 'Status Check Complete',
        description: `Checked ${emails.length} email(s)`,
      });
    } catch (error) {
      console.error('Check error:', error);
      toast({
        title: 'Failed to check status',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setCheckLoading(false);
    }
  };

  const handleUpdateVolunteer = async () => {
    if (!updateEmail.trim()) {
      toast({
        title: 'Email required',
        description: 'Please enter the volunteer email to update',
        variant: 'destructive',
      });
      return;
    }

    setUpdateLoading(true);
    setUpdateResult(null);

    try {
      const updates: { name?: string; phone?: string; active?: boolean } = {};
      if (updateName.trim()) updates.name = updateName.trim();
      if (updatePhone.trim()) updates.phone = updatePhone.trim();
      updates.active = updateActive;

      const { data, error } = await supabase.functions.invoke('webhook-receiver', {
        body: {
          action: 'update_volunteer',
          email: updateEmail.trim(),
          updates,
        },
      });

      if (error) throw error;

      setUpdateResult(data);
      toast({
        title: data.success ? 'Volunteer Updated' : 'Update Failed',
        description: data.message || data.error,
        variant: data.success ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Update error:', error);
      toast({
        title: 'Failed to update volunteer',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-6 shadow-card"
    >
      <div className="mb-4 md:mb-6">
        <h2 className="font-display font-bold text-lg md:text-xl">Webhook Actions</h2>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
          Test and manage volunteer onboarding actions
        </p>
      </div>

      <Tabs defaultValue="create" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="create" className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Create</span>
          </TabsTrigger>
          <TabsTrigger value="check" className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Check Status</span>
          </TabsTrigger>
          <TabsTrigger value="update" className="flex items-center gap-2">
            <UserCog className="w-4 h-4" />
            <span className="hidden sm:inline">Update</span>
          </TabsTrigger>
        </TabsList>

        {/* Create Volunteers Tab */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Create Volunteers</CardTitle>
              <CardDescription>
                Add new volunteer accounts with temporary passwords
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Marketplace Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="marketplace-select" className="text-sm">Assign to Marketplace (optional)</Label>
                <Select value={selectedMarketplaceId} onValueChange={setSelectedMarketplaceId}>
                  <SelectTrigger id="marketplace-select">
                    <SelectValue placeholder="Select a marketplace event..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No marketplace</SelectItem>
                    {marketplaces.map(mp => (
                      <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Associates volunteers with an event so they appear in event filters</p>
              </div>

              {volunteers.map((volunteer, index) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="grid grid-cols-3 gap-2 flex-1">
                    <Input
                      placeholder="Email *"
                      value={volunteer.email}
                      onChange={(e) => updateVolunteerField(index, 'email', e.target.value)}
                    />
                    <Input
                      placeholder="Name"
                      value={volunteer.name}
                      onChange={(e) => updateVolunteerField(index, 'name', e.target.value)}
                    />
                    <Input
                      placeholder="Phone"
                      value={volunteer.phone}
                      onChange={(e) => updateVolunteerField(index, 'phone', e.target.value)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeVolunteerRow(index)}
                    disabled={volunteers.length === 1}
                    className="shrink-0"
                  >
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}

              {/* Email Customization Collapsible */}
              <Collapsible open={emailCustomOpen} onOpenChange={setEmailCustomOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between mb-2">
                    <span className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4" />
                      Customize Email Content
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {emailCustomOpen ? 'Hide' : 'Show'}
                    </Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mb-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-1.5">
                    <Label htmlFor="customSubject" className="text-xs">Custom Subject Line</Label>
                    <Input
                      id="customSubject"
                      placeholder="e.g., Welcome to Gift It Forward - Your Account is Ready!"
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Leave blank for default subject</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="customGreeting" className="text-xs">Custom Greeting</Label>
                    <Input
                      id="customGreeting"
                      placeholder="e.g., Welcome aboard!"
                      value={customGreeting}
                      onChange={(e) => setCustomGreeting(e.target.value)}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground">Appears after "Hi [Name],"</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="customMessage" className="text-xs">Additional Message</Label>
                    <Textarea
                      id="customMessage"
                      placeholder="Add a personalized message that will appear in the email..."
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      className="text-sm min-h-[80px]"
                    />
                    <p className="text-xs text-muted-foreground">This message will appear after the greeting</p>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={addVolunteerRow}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Row
                </Button>
                <EmailPreviewDialog 
                  volunteerName={volunteers[0]?.name || 'Volunteer'} 
                  volunteerEmail={volunteers[0]?.email || 'volunteer@example.com'}
                  customSubject={customSubject}
                  customGreeting={customGreeting}
                  customMessage={customMessage}
                />
                <Button onClick={handleCreateVolunteers} disabled={createLoading}>
                  {createLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Create Volunteers
                </Button>
              </div>

              {createResults && (
                <div className="mt-4 space-y-4">
                  <Label>Results</Label>
                  <div className="space-y-4">
                    {createResults.map((result, i) => (
                      <div 
                        key={i} 
                        className={`rounded-lg border p-4 ${
                          result.status === 'created' 
                            ? 'bg-emerald-500/5 border-emerald-500/20' 
                            : 'bg-destructive/5 border-destructive/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-mono text-sm font-medium">{result.email}</span>
                          {result.status === 'created' ? (
                            <Badge variant="default" className="bg-emerald-500">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Created
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="w-3 h-3 mr-1" />
                              {result.error || 'Failed'}
                            </Badge>
                          )}
                        </div>
                        
                        {result.status === 'created' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* QR Code */}
                            {result.qr_card_id && (
                              <div className="flex flex-col items-center bg-white rounded-lg p-3 border">
                                <QRCodeSVG 
                                  value={result.qr_card_id} 
                                  size={100}
                                  level="M"
                                />
                                <div className="flex items-center gap-1 mt-2">
                                  <code className="text-xs text-muted-foreground">{result.qr_card_id}</code>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => copyToClipboard(result.qr_card_id!, `qr-${i}`)}
                                  >
                                    {copiedField === `qr-${i}` ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            )}
                            
                            {/* Credentials */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between bg-muted rounded px-2 py-1.5">
                                <span className="text-xs text-muted-foreground">Password:</span>
                                <div className="flex items-center gap-1">
                                  <code className="text-xs font-mono">{result.temp_password}</code>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => copyToClipboard(result.temp_password!, `pwd-${i}`)}
                                  >
                                    {copiedField === `pwd-${i}` ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                              
                              {/* Resend Email Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => handleResendEmail(result.email)}
                                disabled={resendingEmail === result.email}
                              >
                                {resendingEmail === result.email ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <Mail className="w-3 h-3 mr-1" />
                                )}
                                Resend Welcome Email
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Check Status Tab */}
        <TabsContent value="check" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Check Volunteer Status</CardTitle>
              <CardDescription>
                Look up volunteer accounts by email address
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Email Addresses (comma or newline separated)</Label>
                <textarea
                  className="w-full min-h-[100px] px-3 py-2 border border-input rounded-md bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="email1@example.com, email2@example.com"
                  value={checkEmails}
                  onChange={(e) => setCheckEmails(e.target.value)}
                />
              </div>

              <Button onClick={handleCheckStatus} disabled={checkLoading}>
                {checkLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Check Status
              </Button>

              {checkResults && (
                <div className="mt-4 space-y-2">
                  <Label>Results</Label>
                  <div className="bg-muted rounded-lg p-3 space-y-3 max-h-64 overflow-y-auto">
                    {checkResults.map((result, i) => (
                      <div key={i} className="border-b border-border pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-sm">{result.email}</span>
                          {result.exists ? (
                            <Badge variant="default" className="bg-emerald-500">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Exists
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <XCircle className="w-3 h-3 mr-1" />
                              Not Found
                            </Badge>
                          )}
                        </div>
                        {result.exists && (
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <p>Role: {result.has_role ? 'Volunteer' : 'No role assigned'}</p>
                            {result.metadata?.name && <p>Name: {result.metadata.name}</p>}
                            {result.metadata?.phone && <p>Phone: {result.metadata.phone}</p>}
                            {result.created_at && (
                              <p>Created: {new Date(result.created_at).toLocaleDateString()}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Update Volunteer Tab */}
        <TabsContent value="update" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Update Volunteer</CardTitle>
              <CardDescription>
                Modify volunteer information or deactivate account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Volunteer Email *</Label>
                  <Input
                    placeholder="volunteer@example.com"
                    value={updateEmail}
                    onChange={(e) => setUpdateEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Name (optional)</Label>
                  <Input
                    placeholder="Leave blank to keep current"
                    value={updateName}
                    onChange={(e) => setUpdateName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>New Phone (optional)</Label>
                  <Input
                    placeholder="Leave blank to keep current"
                    value={updatePhone}
                    onChange={(e) => setUpdatePhone(e.target.value)}
                  />
                </div>
                <div className="flex items-center space-x-2 sm:col-span-2">
                  <Switch
                    id="active-status"
                    checked={updateActive}
                    onCheckedChange={setUpdateActive}
                  />
                  <Label htmlFor="active-status">
                    Account Active {updateActive ? '(enabled)' : '(disabled - user will be banned)'}
                  </Label>
                </div>
              </div>

              <Button onClick={handleUpdateVolunteer} disabled={updateLoading}>
                {updateLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserCog className="w-4 h-4 mr-2" />
                )}
                Update Volunteer
              </Button>

              {updateResult && (
                <div className="mt-4">
                  <div className={`rounded-lg p-3 ${updateResult.success ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-destructive/10 text-destructive'}`}>
                    <div className="flex items-center gap-2">
                      {updateResult.success ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      <span className="font-medium">
                        {updateResult.message || updateResult.error}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};
