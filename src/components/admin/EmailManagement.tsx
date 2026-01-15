import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Mail, Eye, Send, Loader2, Image, CheckCircle, AlertCircle, X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { EmailProviderConfig } from './EmailProviderConfig';

interface EmailManagementProps {
  onBack: () => void;
}

interface EmailAsset {
  name: string;
  file: string;
  uploaded: boolean;
  url?: string;
}

const EMAIL_ASSETS: EmailAsset[] = [
  { name: 'Hero Banner', file: 'gif-hero-banner.jpg', uploaded: false },
  { name: 'Training Module Banner', file: 'training-module-banner.jpg', uploaded: false },
  { name: 'Dubai Holding Logo', file: 'dubai-holding-logo.png', uploaded: false },
];

const EMAIL_TYPES = [
  { value: 'welcome', label: 'Welcome Email', description: 'Sent when a volunteer is approved' },
  { value: 'survey', label: 'Survey Email', description: 'Sent after marketplace checkout' },
  { value: 'certificate', label: 'Certificate Email', description: 'Sent after completing training' },
];

const EMAIL_PROVIDERS = [
  { value: 'resend', label: 'Resend', description: 'Default email provider' },
  { value: 'microsoft_graph', label: 'Microsoft Graph', description: 'Client Outlook (appears in Sent folder)' },
];

export const EmailManagement = ({ onBack }: EmailManagementProps) => {
  const [assets, setAssets] = useState<EmailAsset[]>(EMAIL_ASSETS);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<string | null>(null);
  const [selectedEmailType, setSelectedEmailType] = useState<string>('welcome');
  const [selectedProvider, setSelectedProvider] = useState<string>('resend');
  const [testEmail, setTestEmail] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [msGraphStatus, setMsGraphStatus] = useState<{ configured: boolean; canAuthenticate: boolean; error?: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const { toast } = useToast();

  // Check which assets are already uploaded
  const checkExistingAssets = async () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const updatedAssets = await Promise.all(
      assets.map(async (asset) => {
        const url = `${supabaseUrl}/storage/v1/object/public/email-assets/${asset.file}`;
        try {
          const response = await fetch(url, { method: 'HEAD' });
          return { ...asset, uploaded: response.ok, url: response.ok ? url : undefined };
        } catch {
          return { ...asset, uploaded: false };
        }
      })
    );
    setAssets(updatedAssets);
  };

  // Upload a single asset
  const handleUploadAsset = async (assetName: string, file: File) => {
    const asset = assets.find(a => a.name === assetName);
    if (!asset) return;

    setUploadingAsset(assetName);
    setIsUploading(true);

    try {
      // Upload to Supabase storage
      const { error } = await supabase.storage
        .from('email-assets')
        .upload(asset.file, file, { 
          upsert: true,
          contentType: file.type 
        });

      if (error) throw error;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/storage/v1/object/public/email-assets/${asset.file}`;

      setAssets(prev => prev.map(a => 
        a.name === assetName ? { ...a, uploaded: true, url } : a
      ));

      toast({
        title: 'Asset Uploaded',
        description: `${assetName} has been uploaded successfully`
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload asset',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      setUploadingAsset(null);
    }
  };

  // Check Microsoft Graph status
  const checkMsGraphStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: { action: 'check_status' }
      });
      
      if (error) throw error;
      setMsGraphStatus(data);
    } catch (error) {
      console.error('Status check error:', error);
      setMsGraphStatus({ configured: false, canAuthenticate: false, error: 'Failed to check status' });
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Send test email
  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter a test email address',
        variant: 'destructive'
      });
      return;
    }

    setIsSendingTest(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          email_type: selectedEmailType,
          recipient_email: testEmail.trim(),
          test_mode: true,
          provider: selectedProvider
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Test Email Sent',
          description: `${EMAIL_TYPES.find(e => e.value === selectedEmailType)?.label} sent via ${data.provider || selectedProvider}${data.sender ? ` from ${data.sender}` : ''}`
        });
      } else {
        throw new Error(data?.error || 'Failed to send test email');
      }
    } catch (error) {
      console.error('Test email error:', error);
      toast({
        title: 'Send Failed',
        description: error instanceof Error ? error.message : 'Failed to send test email',
        variant: 'destructive'
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Load asset status on mount
  useState(() => {
    checkExistingAssets();
  });

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // Email preview HTML based on type
  const getPreviewContent = () => {
    const heroImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg`;
    const trainingImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/training-module-banner.jpg`;
    const dubaiHoldingLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png`;

    if (selectedEmailType === 'welcome') {
      return (
        <div className="bg-white">
          {/* Hero Image */}
          <img src={heroImageUrl} alt="Gift It Forward" className="w-full h-auto" />
          
          {/* Execution Partner Label */}
          <div className="text-center py-4">
            <p className="text-xs tracking-widest text-[#B8860B] font-semibold">EXECUTION PARTNER</p>
          </div>
          
          {/* Main Title */}
          <div className="text-center px-6 pb-4">
            <h1 className="text-xl font-bold text-gray-900">
              Thank you for Registering as a<br />Gift It Forward Volunteer!
            </h1>
          </div>
          
          {/* Content Preview */}
          <div className="px-6 py-4 space-y-4 text-sm text-gray-700">
            <p>Dear {"{{first_name}}"},</p>
            <p>Thank you for registering as a Gift It Forward Volunteer. We're delighted to have you join us.</p>
            
            {/* QR Code placeholder */}
            <div className="my-4">
              <h3 className="font-bold text-gray-900">Your Volunteer QR Code</h3>
              <div className="w-32 h-32 bg-gray-200 border-2 border-dashed border-gray-400 flex items-center justify-center mt-2">
                <span className="text-gray-500 text-xs">QR Code</span>
              </div>
            </div>
            
            {/* Training Section */}
            <div className="flex gap-4 border rounded overflow-hidden">
              <img src={trainingImageUrl} alt="Training" className="w-1/2 h-auto" />
              <div className="p-3 flex flex-col justify-center">
                <h3 className="font-bold text-gray-900 text-xs">Mandatory Sustainability Training</h3>
                <p className="text-xs text-gray-600 mt-1">Complete the training before your first marketplace.</p>
                <button className="mt-2 bg-[#0D4A6F] text-white px-3 py-1 rounded text-xs">Start Training</button>
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t mt-6">
              <img src={dubaiHoldingLogoUrl} alt="Dubai Holding" className="h-6" />
              <p className="text-xs text-gray-500 italic">For the Good of Tomorrow</p>
            </div>
          </div>
        </div>
      );
    }

    if (selectedEmailType === 'survey') {
      return (
        <div className="bg-white">
          {/* Hero Image */}
          <img src={heroImageUrl} alt="Gift It Forward" className="w-full h-auto" />
          
          <div className="text-center py-4">
            <p className="text-xs tracking-widest text-[#B8860B] font-semibold">EXECUTION PARTNER</p>
          </div>
          
          <div className="text-center px-6 pb-4">
            <h1 className="text-xl font-bold text-gray-900">
              Thank You for Volunteering!
            </h1>
          </div>
          
          <div className="px-6 py-4 space-y-4 text-sm text-gray-700">
            <p>Dear {"{{first_name}}"},</p>
            <p>Thank you for volunteering with Gift It Forward! Your time and effort made a real difference.</p>
            <p>We'd love to hear about your experience. Please take a moment to complete our short survey:</p>
            
            <div className="text-center py-4">
              <button className="bg-[#B8860B] text-white px-6 py-2.5 rounded font-semibold">
                Complete Survey & Get Certificate
              </button>
            </div>
            
            <p className="text-xs text-gray-500">After completing the survey, you'll receive your Certificate of Participation.</p>
            
            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t mt-6">
              <img src={dubaiHoldingLogoUrl} alt="Dubai Holding" className="h-6" />
              <p className="text-xs text-gray-500 italic">For the Good of Tomorrow</p>
            </div>
          </div>
        </div>
      );
    }

    if (selectedEmailType === 'certificate') {
      return (
        <div className="bg-white">
          {/* Hero Image */}
          <img src={heroImageUrl} alt="Gift It Forward" className="w-full h-auto" />
          
          <div className="text-center py-4">
            <p className="text-xs tracking-widest text-[#B8860B] font-semibold">EXECUTION PARTNER</p>
          </div>
          
          <div className="text-center px-6 pb-4">
            <h1 className="text-xl font-bold text-gray-900">
              Congratulations, {"{{first_name}}"}!
            </h1>
          </div>
          
          <div className="px-6 py-4 space-y-4 text-sm text-gray-700">
            <p>You've successfully completed the Circular Economy Training Module.</p>
            <p>Your certificate of completion is attached to this email.</p>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-bold text-gray-900 mb-2">What You've Learned:</h3>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>The fundamentals of the Circular Economy</li>
                <li>How Gift It Forward redistributes surplus items</li>
                <li>The impact of avoided emissions</li>
                <li>Your role as a Circular Economy advocate</li>
              </ul>
            </div>
            
            <p>Thank you for being part of this important initiative.</p>
            
            {/* Footer */}
            <div className="flex justify-between items-center pt-4 border-t mt-6">
              <img src={dubaiHoldingLogoUrl} alt="Dubai Holding" className="h-6" />
              <p className="text-xs text-gray-500 italic">For the Good of Tomorrow</p>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-3 md:py-4 px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-display font-bold text-lg">Email Management</h1>
              <p className="text-sm text-muted-foreground">Upload assets, preview & test emails</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-6 px-4">
        <Tabs defaultValue="providers" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="providers" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Providers
            </TabsTrigger>
            <TabsTrigger value="assets" className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="test" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Test
            </TabsTrigger>
          </TabsList>

          {/* Email Providers Tab */}
          <TabsContent value="providers">
            <EmailProviderConfig />
          </TabsContent>

          {/* Email Assets Tab */}
          <TabsContent value="assets">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Email Assets
                </CardTitle>
                <CardDescription>
                  Upload images used in email templates. These are served from storage and displayed in actual emails.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {assets.map((asset) => (
                    <motion.div
                      key={asset.name}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        {asset.uploaded && asset.url ? (
                          <img
                            src={asset.url}
                            alt={asset.name}
                            className="w-16 h-12 object-cover rounded border"
                          />
                        ) : (
                          <div className="w-16 h-12 bg-muted rounded border flex items-center justify-center">
                            <Image className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{asset.name}</p>
                          <p className="text-sm text-muted-foreground">{asset.file}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {asset.uploaded ? (
                          <span className="flex items-center gap-1 text-sm text-success">
                            <CheckCircle className="w-4 h-4" />
                            Uploaded
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-warning">
                            <AlertCircle className="w-4 h-4" />
                            Not uploaded
                          </span>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={(el) => (fileInputRefs.current[asset.name] = el)}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUploadAsset(asset.name, file);
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isUploading}
                          onClick={() => fileInputRefs.current[asset.name]?.click()}
                        >
                          {uploadingAsset === asset.name ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-1" />
                          ) : (
                            <Upload className="w-4 h-4 mr-1" />
                          )}
                          {asset.uploaded ? 'Replace' : 'Upload'}
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Quick Upload from Local Files</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    The generated images are in <code className="bg-background px-1 rounded">public/images/email/</code>. 
                    Upload them using the buttons above to make them available in emails.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={checkExistingAssets}
                    className="w-full"
                  >
                    Refresh Asset Status
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Email Preview
                </CardTitle>
                <CardDescription>
                  Preview how emails will look when sent to volunteers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>Select Email Type</Label>
                    <Select value={selectedEmailType} onValueChange={setSelectedEmailType}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EMAIL_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <span className="font-medium">{type.label}</span>
                              <span className="text-muted-foreground ml-2 text-xs">
                                {type.description}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preview Container */}
                  <div className="border rounded-lg overflow-hidden max-w-[600px] mx-auto">
                    <div className="bg-gray-100 px-4 py-2 border-b flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {EMAIL_TYPES.find(e => e.value === selectedEmailType)?.label}
                      </span>
                    </div>
                    <div className="max-h-[500px] overflow-y-auto">
                      {getPreviewContent()}
                    </div>
                  </div>

                  <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full">
                        <Eye className="w-4 h-4 mr-2" />
                        Open Full Preview
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>
                          {EMAIL_TYPES.find(e => e.value === selectedEmailType)?.label} Preview
                        </DialogTitle>
                      </DialogHeader>
                      <div className="border rounded-lg overflow-hidden">
                        {getPreviewContent()}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Test Emails Tab */}
          <TabsContent value="test">
            <div className="space-y-6">
              {/* Microsoft Graph Status Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    Microsoft Graph Status
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={checkMsGraphStatus}
                      disabled={isCheckingStatus}
                    >
                      {isCheckingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {msGraphStatus === null ? (
                    <p className="text-sm text-muted-foreground">Click "Check" to verify Microsoft Graph configuration</p>
                  ) : (
                    <div className="flex items-center gap-3">
                      {msGraphStatus.canAuthenticate ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <span className="text-sm text-green-700">Microsoft Graph is configured and can authenticate</span>
                        </>
                      ) : msGraphStatus.configured ? (
                        <>
                          <AlertCircle className="w-5 h-5 text-yellow-600" />
                          <span className="text-sm text-yellow-700">Configured but auth failed: {msGraphStatus.error}</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          <span className="text-sm text-red-700">{msGraphStatus.error || 'Not configured'}</span>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    Send Test Email
                  </CardTitle>
                  <CardDescription>
                    Send a test email to verify the template looks correct
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Email Type</Label>
                        <Select value={selectedEmailType} onValueChange={setSelectedEmailType}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EMAIL_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Provider</Label>
                        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EMAIL_PROVIDERS.map((provider) => (
                              <SelectItem key={provider.value} value={provider.value}>
                                <div className="flex flex-col">
                                  <span>{provider.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground mt-1">
                          {EMAIL_PROVIDERS.find(p => p.value === selectedProvider)?.description}
                        </p>
                      </div>
                    </div>

                    <div>
                      <Label>Recipient Email</Label>
                      <Input
                        type="email"
                        placeholder="your.email@example.com"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="mt-1.5"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        The test email will use sample data for placeholders
                      </p>
                    </div>

                    <Button
                      onClick={handleSendTestEmail}
                      disabled={isSendingTest || !testEmail.trim()}
                      className="w-full"
                    >
                      {isSendingTest ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Sending via {selectedProvider === 'microsoft_graph' ? 'Microsoft Graph' : 'Resend'}...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send Test Email via {selectedProvider === 'microsoft_graph' ? 'Microsoft Graph' : 'Resend'}
                        </>
                      )}
                    </Button>

                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">Test Email Details</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• <strong>Welcome Email:</strong> Includes sample QR code and credentials</li>
                        <li>• <strong>Survey Email:</strong> Contains a non-functional survey link</li>
                        <li>• <strong>Certificate Email:</strong> Includes a sample PDF certificate (Resend only)</li>
                        <li>• <strong>Microsoft Graph:</strong> Email appears in client's Outlook Sent folder</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};
