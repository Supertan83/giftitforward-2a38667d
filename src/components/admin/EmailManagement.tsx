import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Upload, Mail, Eye, Send, Loader2, Image, CheckCircle, AlertCircle, X, Settings, User, Building2, Calendar, MapPin, ClipboardList, ExternalLink, Copy, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { EmailProviderConfig } from './EmailProviderConfig';
import { useEmailTemplates, type EmailTemplate } from '@/hooks/useEmailTemplates';

interface EmailManagementProps {
  onBack: () => void;
}

interface EmailAsset {
  name: string;
  file: string;
  uploaded: boolean;
  url?: string;
}

interface SimulatedVolunteer {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  is_employee: boolean;
  employee_vertical: string;
  external_company: string;
  employee_number: string;
  events_list: string;
  marketplace_name: string;
  marketplace_date: string;
  marketplace_location: string;
  marketplace_time: string;
}

const DEFAULT_SIMULATED_VOLUNTEER: SimulatedVolunteer = {
  first_name: 'Ahmed',
  last_name: 'Al Maktoum',
  email: '',
  phone_number: '+971 50 123 4567',
  is_employee: true,
  employee_vertical: 'TECOM Group',
  external_company: '',
  employee_number: 'DH-12345',
  events_list: 'GIF Marketplace - January 2025',
  marketplace_name: 'GIF Marketplace - January 2025',
  marketplace_date: '2025-01-25',
  marketplace_location: 'Jumeirah Golf Estates Clubhouse',
  marketplace_time: '09:00 - 14:00',
};

const DH_VERTICALS = [
  'TECOM Group',
  'Jumeirah Group',
  'Arab Media Group',
  'Dubai Holding Entertainment',
  'Dubai Holding Real Estate',
  'Dubai Holding Asset Management',
  'Corporate Services',
  'Other',
];

const EXTERNAL_COMPANIES = [
  'Emaar Properties',
  'DEWA',
  'RTA',
  'Dubai Municipality',
  'DIFC',
  'Dubai Customs',
  'Dubai Health Authority',
  'Other',
];

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
  const [simulatedVolunteer, setSimulatedVolunteer] = useState<SimulatedVolunteer>(DEFAULT_SIMULATED_VOLUNTEER);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Survey testing state
  const [surveyTestName, setSurveyTestName] = useState('Test Volunteer');
  const [surveyTestEmail, setSurveyTestEmail] = useState('');
  const [isCreatingSurvey, setIsCreatingSurvey] = useState(false);
  const [createdSurveyToken, setCreatedSurveyToken] = useState<string | null>(null);
  const [existingSurveys, setExistingSurveys] = useState<Array<{ id: string; volunteer_name: string; survey_token: string; completed_at: string | null }>>([]);
  const [isLoadingSurveys, setIsLoadingSurveys] = useState(false);
  
  // Custom template testing state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [templateTestEmail, setTemplateTestEmail] = useState('');
  const [isSendingTemplate, setIsSendingTemplate] = useState(false);
  const { data: customTemplates = [] } = useEmailTemplates();
  
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

  // Simulate volunteer registration and send welcome email
  const handleSimulateVolunteer = async () => {
    if (!simulatedVolunteer.email.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter your email address to receive the test email',
        variant: 'destructive'
      });
      return;
    }

    setIsSimulating(true);

    try {
      // Use send-test-email function with simulated volunteer data
      // This doesn't create a user, just sends the email with the provided details
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          email_type: 'welcome',
          recipient_email: simulatedVolunteer.email,
          provider: selectedProvider,
          test_mode: true,
          // Pass simulated volunteer details for email personalization
          volunteer_data: {
            first_name: simulatedVolunteer.first_name,
            last_name: simulatedVolunteer.last_name,
            name: `${simulatedVolunteer.first_name} ${simulatedVolunteer.last_name}`,
            phone: simulatedVolunteer.phone_number,
            is_employee: simulatedVolunteer.is_employee,
            employee_vertical: simulatedVolunteer.is_employee ? simulatedVolunteer.employee_vertical : null,
            external_company: !simulatedVolunteer.is_employee ? simulatedVolunteer.external_company : null,
            employee_number: simulatedVolunteer.is_employee ? simulatedVolunteer.employee_number : null,
            events_list: simulatedVolunteer.events_list,
            marketplace_name: simulatedVolunteer.marketplace_name,
            marketplace_date: simulatedVolunteer.marketplace_date,
            marketplace_location: simulatedVolunteer.marketplace_location,
            marketplace_time: simulatedVolunteer.marketplace_time,
          }
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Test Email Sent!',
          description: `Welcome email sent to ${simulatedVolunteer.email} via ${data.provider || selectedProvider}`,
        });
      } else {
        throw new Error(data?.error || 'Failed to send test email');
      }
    } catch (error) {
      console.error('Simulation error:', error);
      toast({
        title: 'Simulation Failed',
        description: error instanceof Error ? error.message : 'Failed to simulate volunteer registration',
        variant: 'destructive'
      });
    } finally {
      setIsSimulating(false);
    }
  };

  // Load existing surveys for testing
  const loadExistingSurveys = async () => {
    setIsLoadingSurveys(true);
    try {
      const { data, error } = await supabase
        .from('volunteer_surveys')
        .select('id, volunteer_name, survey_token, completed_at')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setExistingSurveys(data || []);
    } catch (error) {
      console.error('Error loading surveys:', error);
    } finally {
      setIsLoadingSurveys(false);
    }
  };

  // Create a test survey for testing the survey page
  const handleCreateTestSurvey = async () => {
    if (!surveyTestName.trim() || !surveyTestEmail.trim()) {
      toast({
        title: 'Fields Required',
        description: 'Please enter both name and email for the test survey',
        variant: 'destructive'
      });
      return;
    }

    setIsCreatingSurvey(true);
    try {
      const surveyToken = crypto.randomUUID();
      
      const { data, error } = await supabase
        .from('volunteer_surveys')
        .insert({
          volunteer_name: surveyTestName.trim(),
          volunteer_email: surveyTestEmail.trim(),
          survey_token: surveyToken,
        })
        .select()
        .single();

      if (error) throw error;

      setCreatedSurveyToken(surveyToken);
      loadExistingSurveys(); // Refresh the list

      toast({
        title: 'Test Survey Created',
        description: 'You can now test the survey page with this token'
      });
    } catch (error) {
      console.error('Error creating test survey:', error);
      toast({
        title: 'Creation Failed',
        description: error instanceof Error ? error.message : 'Failed to create test survey',
        variant: 'destructive'
      });
    } finally {
      setIsCreatingSurvey(false);
    }
  };

  // Copy survey URL to clipboard
  const copySurveyUrl = (token: string) => {
    const url = `${window.location.origin}/volunteer-survey?token=${token}`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'URL Copied',
      description: 'Survey URL copied to clipboard'
    });
  };

  // Send custom template as test email — looks up real volunteer data from DB
  const handleSendTemplateEmail = async () => {
    if (!templateTestEmail.trim() || !selectedTemplateId) {
      toast({
        title: 'Missing Fields',
        description: 'Please select a template and enter a recipient email',
        variant: 'destructive'
      });
      return;
    }

    const template = customTemplates.find(t => t.id === selectedTemplateId);
    if (!template) return;

    setIsSendingTemplate(true);

    try {
      // Look up the volunteer by email in pending_volunteers
      const { data: volunteer } = await supabase
        .from('pending_volunteers')
        .select('*')
        .eq('email', templateTestEmail.trim().toLowerCase())
        .maybeSingle();

      // Look up their QR card
      let qrCardId = 'N/A';
      if (volunteer) {
        const { data: qrCards } = await supabase
          .from('volunteer_qr_cards')
          .select('unique_id')
          .eq('volunteer_id', volunteer.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (qrCards && qrCards.length > 0) qrCardId = qrCards[0].unique_id;
      }

      // Look up marketplace details from events_json
      let marketplaceName = '';
      let marketplaceDate = '';
      let marketplaceLocation = '';
      let marketplaceTime = '';
      if (volunteer?.events_json) {
        const eventsJson = volunteer.events_json as any[];
        if (Array.isArray(eventsJson) && eventsJson.length > 0) {
          const firstEvent = eventsJson[0];
          const slug = firstEvent?.slug || firstEvent?.event_slug || firstEvent?.event || '';
          
          // Try to find marketplace by slug pattern match
          if (slug) {
            const slugWords = slug.replace(/-/g, ' ');
            const { data: marketplaces } = await supabase
              .from('marketplace_events')
              .select('name, event_date, start_time, end_time, location')
              .ilike('name', `%${slugWords.split(' ').filter((w: string) => w.length > 3).slice(0, 2).join('%')}%`)
              .limit(5);
            
            if (marketplaces && marketplaces.length > 0) {
              const mp = marketplaces[0];
              marketplaceName = mp.name || '';
              marketplaceDate = mp.event_date || '';
              marketplaceLocation = mp.location || '';
              const formatT = (t: string | null) => {
                if (!t) return '';
                const [h, m] = t.split(':');
                const hr = parseInt(h, 10);
                return `${String(hr % 12 || 12).padStart(2, '0')}.${m} ${hr >= 12 ? 'pm' : 'am'}`;
              };
              marketplaceTime = mp.start_time && mp.end_time
                ? `${formatT(mp.start_time)} - ${formatT(mp.end_time)}`
                : '';
            }
          }
          
          // Fallback: use inline event data from events_json
          if (!marketplaceName) marketplaceName = firstEvent?.name || firstEvent?.event_name || slug || '';
          if (!marketplaceDate && firstEvent?.eventDate) marketplaceDate = firstEvent.eventDate;
          if (!marketplaceDate && firstEvent?.date) marketplaceDate = firstEvent.date;
          if (!marketplaceLocation && firstEvent?.eventLocation) marketplaceLocation = firstEvent.eventLocation;
          if (!marketplaceLocation && firstEvent?.location) marketplaceLocation = firstEvent.location;
          if (!marketplaceTime && firstEvent?.eventTime) marketplaceTime = firstEvent.eventTime;
          if (!marketplaceTime && firstEvent?.time) marketplaceTime = firstEvent.time;
        }
      }
      
      // Additional fallback: use events_list string
      if (!marketplaceName && volunteer?.events_list) {
        marketplaceName = volunteer.events_list;
      }

      const volData = volunteer
        ? {
            first_name: volunteer.first_name,
            last_name: volunteer.last_name,
            name: `${volunteer.first_name} ${volunteer.last_name}`,
            email: volunteer.email,
            phone: volunteer.phone_number || '',
            marketplace_name: marketplaceName,
            marketplace_date: marketplaceDate,
            marketplace_location: marketplaceLocation,
            marketplace_time: marketplaceTime,
            qr_card_id: qrCardId,
            password: (volunteer as any)?.temp_password || '',
          }
        : {
            first_name: simulatedVolunteer.first_name,
            last_name: simulatedVolunteer.last_name,
            name: `${simulatedVolunteer.first_name} ${simulatedVolunteer.last_name}`,
            email: templateTestEmail.trim(),
            phone: simulatedVolunteer.phone_number,
            password: 'SimulatedPass123',
            qr_card_id: 'VOL-SIM-0000',
            marketplace_name: simulatedVolunteer.marketplace_name,
            marketplace_date: simulatedVolunteer.marketplace_date,
            marketplace_location: simulatedVolunteer.marketplace_location,
            marketplace_time: simulatedVolunteer.marketplace_time,
          };

      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          email_type: 'custom_template',
          recipient_email: templateTestEmail.trim(),
          test_mode: true,
          provider: selectedProvider,
          custom_template: {
            subject: template.subject,
            greeting: template.greeting,
            body_sections: template.body_sections,
            cta_text: template.cta_text,
            cta_url: template.cta_url,
          },
          volunteer_data: volData,
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Template Email Sent!',
          description: volunteer
            ? `"${template.name}" sent to ${templateTestEmail} with real volunteer data`
            : `"${template.name}" sent to ${templateTestEmail} (email not found in DB, used simulated data)`,
        });
      } else {
        throw new Error(data?.error || 'Failed to send template email');
      }
    } catch (error) {
      console.error('Template email error:', error);
      toast({
        title: 'Send Failed',
        description: error instanceof Error ? error.message : 'Failed to send template email',
        variant: 'destructive'
      });
    } finally {
      setIsSendingTemplate(false);
    }
  };



  // Open survey page in new tab
  const openSurveyPage = (token: string) => {
    const url = `${window.location.origin}/volunteer-survey?token=${token}`;
    window.open(url, '_blank');
  };

  // Load asset status on mount
  useEffect(() => {
    checkExistingAssets();
    loadExistingSurveys();
  }, []);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // Email preview HTML based on type
  const getPreviewContent = () => {
    const heroImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg`;
    const trainingImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/training-module-banner.jpg`;
    const dubaiHoldingLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png`;
    const surplussLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/surpluss-logo.png`;

    if (selectedEmailType === 'welcome') {
      return (
        <div className="bg-white">
           {/* Hero Image */}
          <img src={heroImageUrl} alt="Gift It Forward" className="w-full h-auto" />
          
          {/* The Surpluss Logo */}
          <div className="flex justify-center pt-5">
            <img src={surplussLogoUrl} alt="The Surpluss" className="h-[45px]" />
          </div>
          
          {/* Red Vertical Line */}
          <div className="flex justify-center py-3">
            <div className="w-[2px] h-[50px] bg-[#DA291C]"></div>
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
          
          {/* The Surpluss Logo */}
          <div className="flex justify-center pt-5">
            <img src={surplussLogoUrl} alt="The Surpluss" className="h-[45px]" />
          </div>
          
          <div className="flex justify-center py-3">
            <div className="w-[2px] h-[50px] bg-[#DA291C]"></div>
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
          
          {/* The Surpluss Logo */}
          <div className="flex justify-center pt-5">
            <img src={surplussLogoUrl} alt="The Surpluss" className="h-[45px]" />
          </div>
          
          <div className="flex justify-center py-3">
            <div className="w-[2px] h-[50px] bg-[#DA291C]"></div>
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
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1">
            <TabsTrigger value="providers" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Settings className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Providers</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
            <TabsTrigger value="assets" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Image className="w-3 h-3 sm:w-4 sm:h-4" />
              Assets
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Eye className="w-3 h-3 sm:w-4 sm:h-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="test" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Send className="w-3 h-3 sm:w-4 sm:h-4" />
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
                          <CheckCircle className="w-5 h-5 text-success" />
                          <span className="text-sm text-success">Microsoft Graph is configured and can authenticate</span>
                        </>
                      ) : msGraphStatus.configured ? (
                        <>
                          <AlertCircle className="w-5 h-5 text-warning" />
                          <span className="text-sm text-warning">Configured but auth failed: {msGraphStatus.error}</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-5 h-5 text-destructive" />
                          <span className="text-sm text-destructive">{msGraphStatus.error || 'Not configured'}</span>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Volunteer Simulation Form */}
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Simulate Dubai Holding Registration
                  </CardTitle>
                  <CardDescription>
                    Fill in volunteer details as if registering through the Dubai Holding form. This will create a real test record and send the welcome email.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Volunteer Type Toggle */}
                    <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="is_employee"
                          checked={simulatedVolunteer.is_employee}
                          onCheckedChange={(checked) => 
                            setSimulatedVolunteer(prev => ({ 
                              ...prev, 
                              is_employee: checked === true,
                              employee_vertical: checked ? prev.employee_vertical : '',
                              external_company: checked ? '' : prev.external_company,
                            }))
                          }
                        />
                        <Label htmlFor="is_employee" className="font-medium">
                          Dubai Holding Employee
                        </Label>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {simulatedVolunteer.is_employee 
                          ? '(Will show in Vertical Breakdown)' 
                          : '(Will show in Company Breakdown as External Partner)'}
                      </span>
                    </div>

                    {/* Personal Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>First Name *</Label>
                        <Input
                          value={simulatedVolunteer.first_name}
                          onChange={(e) => setSimulatedVolunteer(prev => ({ ...prev, first_name: e.target.value }))}
                          placeholder="Ahmed"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label>Last Name *</Label>
                        <Input
                          value={simulatedVolunteer.last_name}
                          onChange={(e) => setSimulatedVolunteer(prev => ({ ...prev, last_name: e.target.value }))}
                          placeholder="Al Maktoum"
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Email Address * (You will receive the test email here)</Label>
                        <Input
                          type="email"
                          value={simulatedVolunteer.email}
                          onChange={(e) => setSimulatedVolunteer(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="your.email@example.com"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label>Phone Number</Label>
                        <Input
                          value={simulatedVolunteer.phone_number}
                          onChange={(e) => setSimulatedVolunteer(prev => ({ ...prev, phone_number: e.target.value }))}
                          placeholder="+971 50 123 4567"
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    {/* Conditional Fields based on Employee Status */}
                    {simulatedVolunteer.is_employee ? (
                      <div className="grid grid-cols-2 gap-4 p-4 bg-primary/5 rounded-lg border border-primary/10">
                        <div className="flex items-center gap-2 col-span-2 mb-2">
                          <Building2 className="w-4 h-4 text-primary" />
                          <span className="font-medium text-sm">Dubai Holding Details</span>
                        </div>
                        <div>
                          <Label>Vertical / Business Unit *</Label>
                          <Select 
                            value={simulatedVolunteer.employee_vertical} 
                            onValueChange={(value) => setSimulatedVolunteer(prev => ({ ...prev, employee_vertical: value }))}
                          >
                            <SelectTrigger className="mt-1.5">
                              <SelectValue placeholder="Select vertical" />
                            </SelectTrigger>
                            <SelectContent>
                              {DH_VERTICALS.map((vertical) => (
                                <SelectItem key={vertical} value={vertical}>{vertical}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Employee Number</Label>
                          <Input
                            value={simulatedVolunteer.employee_number}
                            onChange={(e) => setSimulatedVolunteer(prev => ({ ...prev, employee_number: e.target.value }))}
                            placeholder="DH-12345"
                            className="mt-1.5"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4 p-4 bg-amber-500/5 rounded-lg border border-amber-500/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="w-4 h-4 text-amber-600" />
                          <span className="font-medium text-sm">External Partner Details</span>
                        </div>
                        <div>
                          <Label>Company Name *</Label>
                          <Select 
                            value={simulatedVolunteer.external_company} 
                            onValueChange={(value) => setSimulatedVolunteer(prev => ({ ...prev, external_company: value }))}
                          >
                            <SelectTrigger className="mt-1.5">
                              <SelectValue placeholder="Select company" />
                            </SelectTrigger>
                            <SelectContent>
                              {EXTERNAL_COMPANIES.map((company) => (
                                <SelectItem key={company} value={company}>{company}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Event Details */}
                    <div className="p-4 bg-muted/50 rounded-lg border">
                      <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium text-sm">Marketplace Event Details</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Event Name</Label>
                          <Input
                            value={simulatedVolunteer.marketplace_name}
                            onChange={(e) => setSimulatedVolunteer(prev => ({ 
                              ...prev, 
                              marketplace_name: e.target.value,
                              events_list: e.target.value 
                            }))}
                            placeholder="GIF Marketplace - January 2025"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label>Date</Label>
                          <Input
                            type="date"
                            value={simulatedVolunteer.marketplace_date}
                            onChange={(e) => setSimulatedVolunteer(prev => ({ ...prev, marketplace_date: e.target.value }))}
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label>Location</Label>
                          <div className="flex items-center gap-2 mt-1.5">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <Input
                              value={simulatedVolunteer.marketplace_location}
                              onChange={(e) => setSimulatedVolunteer(prev => ({ ...prev, marketplace_location: e.target.value }))}
                              placeholder="Jumeirah Golf Estates Clubhouse"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Timings</Label>
                          <Input
                            value={simulatedVolunteer.marketplace_time}
                            onChange={(e) => setSimulatedVolunteer(prev => ({ ...prev, marketplace_time: e.target.value }))}
                            placeholder="09:00 - 14:00"
                            className="mt-1.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Provider Selection */}
                    <div>
                      <Label>Email Provider</Label>
                      <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EMAIL_PROVIDERS.map((provider) => (
                            <SelectItem key={provider.value} value={provider.value}>
                              {provider.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {EMAIL_PROVIDERS.find(p => p.value === selectedProvider)?.description}
                      </p>
                    </div>

                    <Button
                      onClick={handleSimulateVolunteer}
                      disabled={isSimulating || !simulatedVolunteer.email.trim() || !simulatedVolunteer.first_name.trim()}
                      className="w-full"
                      size="lg"
                    >
                      {isSimulating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Simulating Registration & Sending Email...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Simulate Registration & Send Welcome Email
                        </>
                      )}
                    </Button>

                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">What This Does:</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Creates a pending volunteer record with the details above</li>
                        <li>• Generates a unique QR code for the volunteer</li>
                        <li>• Sends the complete welcome email with all sections</li>
                        <li>• Tests the full onboarding flow end-to-end</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Test Survey Flow Card */}
              <Card className="border-amber-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5" />
                    Test Survey & Certificate Flow
                  </CardTitle>
                  <CardDescription>
                    Create a test survey to verify the survey page and certificate generation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Create New Test Survey */}
                    <div className="space-y-4">
                      <h4 className="font-medium text-sm">Create New Test Survey</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Volunteer Name</Label>
                          <Input
                            value={surveyTestName}
                            onChange={(e) => setSurveyTestName(e.target.value)}
                            placeholder="Test Volunteer"
                            className="mt-1.5"
                          />
                        </div>
                        <div>
                          <Label>Volunteer Email</Label>
                          <Input
                            type="email"
                            value={surveyTestEmail}
                            onChange={(e) => setSurveyTestEmail(e.target.value)}
                            placeholder="your.email@example.com"
                            className="mt-1.5"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleCreateTestSurvey}
                        disabled={isCreatingSurvey || !surveyTestName.trim() || !surveyTestEmail.trim()}
                        variant="outline"
                        className="w-full"
                      >
                        {isCreatingSurvey ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <ClipboardList className="w-4 h-4 mr-2" />
                            Create Test Survey
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Show created survey token */}
                    {createdSurveyToken && (
                      <div className="p-4 bg-success/10 border border-success/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-success" />
                          <span className="font-medium text-sm">Survey Created!</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => openSurveyPage(createdSurveyToken)}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Open Survey Page
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copySurveyUrl(createdSurveyToken)}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Copy URL
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Existing Surveys */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">Recent Surveys</h4>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={loadExistingSurveys}
                          disabled={isLoadingSurveys}
                        >
                          {isLoadingSurveys ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Refresh'
                          )}
                        </Button>
                      </div>
                      
                      {existingSurveys.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-2">No surveys found</p>
                      ) : (
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {existingSurveys.map((survey) => (
                            <div
                              key={survey.id}
                              className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{survey.volunteer_name}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {survey.completed_at ? (
                                    <span className="flex items-center gap-1 text-success">
                                      <CheckCircle className="w-3 h-3" />
                                      Completed
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1 text-warning">
                                      <AlertCircle className="w-3 h-3" />
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openSurveyPage(survey.survey_token)}
                                  title="Open survey page"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => copySurveyUrl(survey.survey_token)}
                                  title="Copy survey URL"
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">Testing Flow:</h4>
                      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                        <li>Create a test survey with your name and email</li>
                        <li>Open the survey page and complete the form</li>
                        <li>Verify the certificate downloads with correct positioning</li>
                        <li>Check your email for the certificate attachment</li>
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Simple Test Email Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Send className="w-5 h-5" />
                    Quick Test Email (Generic)
                  </CardTitle>
                  <CardDescription>
                    Send a test email with placeholder data (no record created)
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
                        <Label>Recipient Email</Label>
                        <Input
                          type="email"
                          placeholder="your.email@example.com"
                          value={testEmail}
                          onChange={(e) => setTestEmail(e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleSendTestEmail}
                      disabled={isSendingTest || !testEmail.trim()}
                      variant="outline"
                      className="w-full"
                    >
                      {isSendingTest ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send Quick Test
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Send Custom Template Card */}
              <Card className="border-emerald-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Send Custom Template
                  </CardTitle>
                  <CardDescription>
                    Send one of your created templates as a test email with dynamic token replacement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {customTemplates.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No custom templates created yet. Go to Email Templates to create one.
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Select Template</Label>
                            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Choose a template..." />
                              </SelectTrigger>
                              <SelectContent>
                                {customTemplates.map((tpl) => (
                                  <SelectItem key={tpl.id} value={tpl.id}>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{tpl.name}</span>
                                      <span className="text-muted-foreground text-xs capitalize">({tpl.category})</span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Recipient Email</Label>
                            <Input
                              type="email"
                              placeholder="your.email@example.com"
                              value={templateTestEmail}
                              onChange={(e) => setTemplateTestEmail(e.target.value)}
                              className="mt-1.5"
                            />
                          </div>
                        </div>

                        {selectedTemplateId && (() => {
                          const tpl = customTemplates.find(t => t.id === selectedTemplateId);
                          if (!tpl) return null;
                          return (
                            <div className="p-3 bg-muted/50 rounded-lg border text-sm">
                              <p className="font-medium mb-1">Subject: {tpl.subject}</p>
                              <p className="text-muted-foreground text-xs">
                                If the recipient email exists in the database, real volunteer data (name, QR code, marketplace) will be used. Otherwise, simulated data from above is used.
                              </p>
                            </div>
                          );
                        })()}

                        <Button
                          onClick={handleSendTemplateEmail}
                          disabled={isSendingTemplate || !templateTestEmail.trim() || !selectedTemplateId}
                          className="w-full"
                        >
                          {isSendingTemplate ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Sending Template...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-2" />
                              Send Template Test Email
                            </>
                          )}
                        </Button>
                      </>
                    )}
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
