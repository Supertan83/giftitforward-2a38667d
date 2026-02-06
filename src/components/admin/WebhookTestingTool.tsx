import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Send, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check,
  Globe,
  Clock,
  Zap,
  Save,
  Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'webhook_testing_api_key';

interface TestResult {
  success: boolean;
  status: number;
  statusText: string;
  responseTime: number;
  response: unknown;
  error?: string;
}

export const WebhookTestingTool = () => {
  const { toast } = useToast();
  
  const [proxyUrl, setProxyUrl] = useState('');
  const [sourceIdentifier, setSourceIdentifier] = useState('test_source');
  const [apiKey, setApiKey] = useState('');
  const [isApiKeySaved, setIsApiKeySaved] = useState(false);
  const [payloadType, setPayloadType] = useState<'custom' | 'create_volunteer' | 'check_status' | 'allocation_created' | 'surpluss_item'>('check_status');
  const [customPayload, setCustomPayload] = useState('{\n  "action": "create_volunteer",\n  "volunteers": [\n    {\n      "email": "test@example.com",\n      "name": "Test User"\n    }\n  ]\n}');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Load saved API key on mount
  useEffect(() => {
    const savedKey = localStorage.getItem(STORAGE_KEY);
    if (savedKey) {
      setApiKey(savedKey);
      setIsApiKeySaved(true);
    }
  }, []);

  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem(STORAGE_KEY, apiKey.trim());
      setIsApiKeySaved(true);
      toast({
        title: 'API Key Saved',
        description: 'Your API key has been saved to local storage',
      });
    }
  };

  const handleClearApiKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey('');
    setIsApiKeySaved(false);
    toast({
      title: 'API Key Cleared',
      description: 'Your saved API key has been removed',
    });
  };

  const supabaseUrl = 'https://zrzlzggixuogpxberdxt.supabase.co/functions/v1/webhook-proxy';

  const getPayload = () => {
    switch (payloadType) {
      case 'create_volunteer':
        return {
          action: 'create_volunteer',
          volunteers: [
            {
              email: `test-${Date.now()}@example.com`,
              name: 'Test Volunteer',
              phone: '+1234567890'
            }
          ]
        };
      case 'check_status':
        return {
          action: 'check_volunteer_status',
          emails: ['test@example.com']
        };
      case 'allocation_created':
        return {
          event: 'allocation_created',
          data: {
            marketplace_event_id: 123,
            marketplace_event_title: 'National Charity School',
            allocated_materials: [
              {
                donation_metadata_id: 1,
                material_id: 101,
                material_title: 'Winter Jackets',
                donation_tag_id: 5,
                donation_tag_name: 'Clothing',
                donation_tag_subcategory_id: 12,
                donation_tag_subcategory_name: "Mens' clothes",
                amount: 500
              }
            ],
            total_amount: 500,
            allocated_at: new Date().toISOString()
          }
        };
      case 'surpluss_item':
        return {
          id: Math.floor(Math.random() * 10000),
          uuid: crypto.randomUUID(),
          title: 'Office Furniture Set',
          description: 'Gently used office desks and chairs from corporate refresh.',
          active: true,
          price: 0,
          per: 1,
          frequency: { "One-off": true },
          image_url: 'https://placehold.co/400x300?text=Furniture',
          quantity: 50,
          item_count: 50,
          box_count: 5,
          type: { offering_type: 'DONATION', status: 'APPROVED' },
          condition_id: 1,
          third_level_subcategory_id: null,
          company: {
            id: 10,
            uuid: crypto.randomUUID(),
            name: 'Acme Corp',
            main_business: 'Retail',
            sector: 'Consumer Goods',
            company_size: 'Large',
            image_url: 'https://placehold.co/200x200?text=Acme'
          },
          address: {
            id: 5,
            address: '123 Main St',
            city: 'Dubai',
            country: 'UAE'
          },
          material_group: {
            id: 3,
            name: 'Furniture',
            code: 'FUR',
            uom: 'piece'
          },
          sdg_goals: [
            { id: 12, name: 'Responsible Consumption', code: 'SDG12' }
          ]
        };
      case 'custom':
        try {
          return JSON.parse(customPayload);
        } catch {
          return null;
        }
    }
  };

  const handleTest = async () => {
    const payload = getPayload();
    if (!payload) {
      toast({
        title: 'Invalid JSON',
        description: 'Please enter valid JSON in the payload field',
        variant: 'destructive',
      });
      return;
    }

    // Surpluss Item goes directly to its dedicated endpoint
    const surplussItemUrl = 'https://zrzlzggixuogpxberdxt.supabase.co/functions/v1/receive-surpluss-items';
    const isSurplussItem = payloadType === 'surpluss_item';
    
    const targetUrl = isSurplussItem ? surplussItemUrl : (proxyUrl.trim() || supabaseUrl);
    const urlWithSource = isSurplussItem
      ? targetUrl
      : sourceIdentifier 
        ? `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}source=${encodeURIComponent(sourceIdentifier)}`
        : targetUrl;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    // Add API key header if provided (required for create_volunteer action)
    if (apiKey.trim()) {
      headers['x-api-key'] = apiKey.trim();
    }

    setIsLoading(true);
    setTestResult(null);

    const startTime = performance.now();

    try {
      const response = await fetch(urlWithSource, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      let responseData;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      setTestResult({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        responseTime,
        response: responseData,
      });

      toast({
        title: response.ok ? 'Test Successful' : 'Test Failed',
        description: `Status: ${response.status} ${response.statusText} (${responseTime}ms)`,
        variant: response.ok ? 'default' : 'destructive',
      });

    } catch (error) {
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      setTestResult({
        success: false,
        status: 0,
        statusText: 'Network Error',
        responseTime,
        response: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      toast({
        title: 'Test Failed',
        description: error instanceof Error ? error.message : 'Network error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyUrl = async () => {
    const url = proxyUrl.trim() || supabaseUrl;
    await navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast({
      title: 'URL Copied',
      description: 'The webhook URL has been copied to your clipboard',
    });
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-card rounded-xl md:rounded-2xl border border-border p-4 md:p-6 shadow-card"
    >
      <div className="mb-4 md:mb-6">
        <h2 className="font-display font-bold text-lg md:text-xl flex items-center gap-2">
          <Zap className="w-5 h-5 text-primary" />
          Webhook Testing Tool
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
          Test your webhook proxy to verify it's working correctly
        </p>
      </div>

      <div className="space-y-6">
        {/* URL Configuration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Endpoint Configuration</CardTitle>
            <CardDescription>
              Configure the webhook URL to test. Leave blank to test the internal proxy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Proxy URL (optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="https://your-proxy.workers.dev or leave blank for internal"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyUrl}
                  className="shrink-0"
                >
                  {copiedUrl ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {proxyUrl.trim() 
                  ? `Testing: ${proxyUrl}` 
                  : `Testing: ${supabaseUrl} (internal)`}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Source Identifier</Label>
              <Input
                placeholder="company_name"
                value={sourceIdentifier}
                onChange={(e) => setSourceIdentifier(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Added as <code className="bg-muted px-1 rounded">?source=</code> parameter
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Key (required for create_volunteer)
                {isApiKeySaved && (
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    Saved
                  </Badge>
                )}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  placeholder="Your WEBHOOK_API_KEY"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setIsApiKeySaved(false);
                  }}
                  className="flex-1"
                />
                {apiKey && !isApiKeySaved && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveApiKey}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save
                  </Button>
                )}
                {isApiKeySaved && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearApiKey}
                    className="text-muted-foreground"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Sent as <code className="bg-muted px-1 rounded">x-api-key</code> header. Saved locally in your browser.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Payload Configuration */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Test Payload</CardTitle>
            <CardDescription>
              Select a preset or create a custom payload
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Payload Type</Label>
              <Select value={payloadType} onValueChange={(v) => setPayloadType(v as typeof payloadType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="create_volunteer">Create Volunteer</SelectItem>
                  <SelectItem value="check_status">Check Status</SelectItem>
                  <SelectItem value="allocation_created">Allocation Created</SelectItem>
                  <SelectItem value="surpluss_item">Surpluss Item</SelectItem>
                  <SelectItem value="custom">Custom Payload</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {payloadType === 'custom' ? (
              <div className="space-y-2">
                <Label>Custom JSON Payload</Label>
                <Textarea
                  className="font-mono text-sm min-h-[150px]"
                  value={customPayload}
                  onChange={(e) => setCustomPayload(e.target.value)}
                  placeholder='{"action": "...", "data": {...}}'
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Preview Payload</Label>
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                  {JSON.stringify(getPayload(), null, 2)}
                </pre>
              </div>
            )}

            <Button onClick={handleTest} disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Send Test Request
            </Button>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResult && (
          <Card className={testResult.success ? 'border-emerald-500/50' : 'border-destructive/50'}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive" />
                )}
                Test Result
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={testResult.success ? 'default' : 'destructive'} className={testResult.success ? 'bg-emerald-500' : ''}>
                  <Globe className="w-3 h-3 mr-1" />
                  {testResult.status} {testResult.statusText}
                </Badge>
                <Badge variant="outline">
                  <Clock className="w-3 h-3 mr-1" />
                  {testResult.responseTime}ms
                </Badge>
              </div>

              {testResult.error ? (
                <div className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
                  <strong>Error:</strong> {testResult.error}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Response</Label>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto">
                    {typeof testResult.response === 'string'
                      ? testResult.response
                      : JSON.stringify(testResult.response, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  );
};
