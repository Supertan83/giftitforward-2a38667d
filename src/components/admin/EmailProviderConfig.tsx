import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Mail, RefreshCw, Check, AlertCircle } from 'lucide-react';

interface EmailProviderConfigRow {
  id: string;
  email_type: string;
  primary_provider: string;
  fallback_enabled: boolean;
  resend_sender: string | null;
  updated_at: string;
}

const PROVIDERS = [
  { value: 'microsoft_graph', label: 'Microsoft Graph (Outlook)', icon: '📧' },
  { value: 'hubspot', label: 'HubSpot', icon: '🟠' },
  { value: 'resend', label: 'Resend', icon: '📤' },
];

// All emails are sent from giftitforward@dubaiholding.com - no fallback sender options needed

const EMAIL_TYPES = [
  { value: 'welcome', label: 'Welcome Email', description: 'Sent to new volunteers with credentials and QR code' },
  { value: 'survey', label: 'Survey Email', description: 'Sent after volunteer check-out' },
  { value: 'certificate', label: 'Certificate Email', description: 'Sent after survey completion' },
  { value: 'training', label: 'Training Reminder', description: 'Sent to remind volunteers to complete training' },
];

export function EmailProviderConfig() {
  const [configs, setConfigs] = useState<EmailProviderConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('email_provider_config')
        .select('*')
        .order('email_type');

      if (error) throw error;
      setConfigs(data || []);
    } catch (error: any) {
      console.error('Error fetching email provider config:', error);
      toast.error('Failed to load email provider configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const updateConfig = async (emailType: string, updates: Partial<EmailProviderConfigRow>) => {
    setSaving(emailType);
    try {
      const { error } = await supabase
        .from('email_provider_config')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('email_type', emailType);

      if (error) throw error;

      setConfigs(prev =>
        prev.map(c => (c.email_type === emailType ? { ...c, ...updates } : c))
      );
      toast.success(`${emailType} email provider updated`);
    } catch (error: any) {
      console.error('Error updating config:', error);
      toast.error('Failed to update configuration');
    } finally {
      setSaving(null);
    }
  };

  const getProviderBadge = (provider: string) => {
    const p = PROVIDERS.find(pr => pr.value === provider);
    if (!p) return null;

    const colorClass =
      provider === 'microsoft_graph'
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        : provider === 'hubspot'
        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';

    return (
      <Badge variant="secondary" className={colorClass}>
        {p.icon} {p.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Provider Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Provider Configuration
        </CardTitle>
        <CardDescription>
          Choose which email provider to use for each email type. Fallback will try alternative providers if the primary fails.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {EMAIL_TYPES.map(emailType => {
          const config = configs.find(c => c.email_type === emailType.value);
          const isSaving = saving === emailType.value;

          return (
            <div
              key={emailType.value}
              className="border rounded-lg p-4 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium flex items-center gap-2">
                    {emailType.label}
                    {isSaving && <RefreshCw className="h-4 w-4 animate-spin" />}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {emailType.description}
                  </p>
                </div>
                {config && getProviderBadge(config.primary_provider)}
              </div>

              {config ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`provider-${emailType.value}`}>Primary Provider</Label>
                    <Select
                      value={config.primary_provider}
                      onValueChange={(value) =>
                        updateConfig(emailType.value, { primary_provider: value })
                      }
                      disabled={isSaving}
                    >
                      <SelectTrigger id={`provider-${emailType.value}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDERS.map(provider => (
                          <SelectItem key={provider.value} value={provider.value}>
                            {provider.icon} {provider.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`fallback-${emailType.value}`}>Fallback Enabled</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        id={`fallback-${emailType.value}`}
                        checked={config.fallback_enabled}
                        onCheckedChange={(checked) =>
                          updateConfig(emailType.value, { fallback_enabled: checked })
                        }
                        disabled={isSaving}
                      />
                      <span className="text-sm text-muted-foreground">
                        {config.fallback_enabled ? (
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Check className="h-4 w-4" /> Fallback on
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <AlertCircle className="h-4 w-4" /> Primary only
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      All emails sent from: giftitforward@dubaiholding.com
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic">
                  No configuration found for this email type
                </div>
              )}
            </div>
          );
        })}

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={fetchConfigs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
