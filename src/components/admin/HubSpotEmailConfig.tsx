import { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Save, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailConfig {
  id: string;
  email_type: string;
  template_id: string | null;
  enabled: boolean;
}

const emailTypeLabels: Record<string, { title: string; description: string }> = {
  welcome: {
    title: 'Welcome Email',
    description: 'Sent to new volunteers with QR code and credentials'
  },
  survey: {
    title: 'Survey Email',
    description: 'Sent after volunteer check-out for feedback'
  },
  training: {
    title: 'Training Email',
    description: 'Sent for training reminders or reset requests'
  },
  certificate: {
    title: 'Certificate Email',
    description: 'Sent after training completion with certificate'
  }
};

interface HubSpotEmailConfigProps {
  onBack: () => void;
}

export const HubSpotEmailConfig = ({ onBack }: HubSpotEmailConfigProps) => {
  const [configs, setConfigs] = useState<EmailConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editedConfigs, setEditedConfigs] = useState<Record<string, Partial<EmailConfig>>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data, error } = await supabase
        .from('hubspot_email_config')
        .select('*')
        .order('email_type');

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      toast({
        title: 'Error loading config',
        description: error instanceof Error ? error.message : 'Failed to load HubSpot email configuration',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (emailType: string, field: keyof EmailConfig, value: string | boolean) => {
    setEditedConfigs(prev => ({
      ...prev,
      [emailType]: {
        ...prev[emailType],
        [field]: value
      }
    }));
  };

  const getConfigValue = (config: EmailConfig, field: keyof EmailConfig) => {
    if (editedConfigs[config.email_type]?.[field] !== undefined) {
      return editedConfigs[config.email_type][field];
    }
    return config[field];
  };

  const hasChanges = Object.keys(editedConfigs).length > 0;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const [emailType, changes] of Object.entries(editedConfigs)) {
        const config = configs.find(c => c.email_type === emailType);
        if (!config) continue;

        const { error } = await supabase
          .from('hubspot_email_config')
          .update({
            template_id: changes.template_id ?? config.template_id,
            enabled: changes.enabled ?? config.enabled
          })
          .eq('id', config.id);

        if (error) throw error;
      }

      toast({
        title: 'Configuration Saved',
        description: 'HubSpot email settings have been updated'
      });

      setEditedConfigs({});
      await fetchConfigs();
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error instanceof Error ? error.message : 'Failed to save configuration',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const enabledCount = configs.filter(c => 
    editedConfigs[c.email_type]?.enabled ?? c.enabled
  ).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-4xl py-4 px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="flex-1">
              <h1 className="font-display font-bold text-lg">HubSpot Email Configuration</h1>
              <p className="text-sm text-muted-foreground">
                Configure HubSpot transactional email template IDs
              </p>
            </div>
            {hasChanges && (
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container max-w-4xl py-6 px-4 space-y-6">
        {/* Status Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  Email Delivery Status
                </CardTitle>
                <CardDescription className="mt-1">
                  {enabledCount === 0 
                    ? 'All emails are sent via Resend (default)'
                    : `${enabledCount} of ${configs.length} email types configured for HubSpot`
                  }
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant={enabledCount > 0 ? 'default' : 'secondary'}>
                  {enabledCount > 0 ? 'HubSpot Active' : 'Using Resend'}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Info Box */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900">
          <CardContent className="pt-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">How to get HubSpot Email Template IDs:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300">
                  <li>Go to HubSpot → Marketing → Email → Templates</li>
                  <li>Create or edit a transactional email template</li>
                  <li>The template ID is in the URL: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">.../email/TEMPLATE_ID/...</code></li>
                  <li>Enter the numeric ID below and enable the toggle</li>
                </ol>
                <a 
                  href="https://knowledge.hubspot.com/email/create-transactional-emails" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-blue-600 hover:underline"
                >
                  Learn more about HubSpot transactional emails
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Email Type Configurations */}
        <div className="space-y-4">
          {configs.map(config => {
            const typeInfo = emailTypeLabels[config.email_type] || {
              title: config.email_type,
              description: ''
            };
            const templateId = getConfigValue(config, 'template_id') as string || '';
            const enabled = getConfigValue(config, 'enabled') as boolean;
            const isConfigured = templateId && templateId.trim().length > 0;

            return (
              <Card key={config.id} className={enabled ? 'border-primary/50' : ''}>
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{typeInfo.title}</h3>
                        {enabled && isConfigured ? (
                          <Badge variant="default" className="text-xs">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            HubSpot
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Resend</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">
                        {typeInfo.description}
                      </p>
                      
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor={`template-${config.email_type}`}>
                            HubSpot Template ID
                          </Label>
                          <Input
                            id={`template-${config.email_type}`}
                            placeholder="e.g., 12345678"
                            value={templateId}
                            onChange={(e) => handleInputChange(config.email_type, 'template_id', e.target.value)}
                            className="mt-1.5"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:pt-6">
                      <Label htmlFor={`enable-${config.email_type}`} className="text-sm">
                        Use HubSpot
                      </Label>
                      <Switch
                        id={`enable-${config.email_type}`}
                        checked={enabled}
                        onCheckedChange={(checked) => handleInputChange(config.email_type, 'enabled', checked)}
                        disabled={!isConfigured && !enabled}
                      />
                    </div>
                  </div>
                  
                  {enabled && !isConfigured && (
                    <p className="text-xs text-amber-600 mt-3">
                      ⚠️ Template ID required to enable HubSpot delivery
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Note about fallback */}
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> When HubSpot is disabled or template ID is not configured for an email type, 
              emails will be sent via Resend (the default email provider). This allows for a gradual migration 
              to HubSpot as you create and test each template.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};
