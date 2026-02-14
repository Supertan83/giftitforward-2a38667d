import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Award, Download, Mail, Check, Send } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { generateCertificatePDF, generateCertificatePDFBlob } from '@/components/certificates/CertificateGenerator';

interface MarketplaceInfo {
  id: string;
  name: string;
  event_date: string | null;
  location: string | null;
  outreach_partner: string | null;
}

export default function ExternalSurveyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const marketplaceId = searchParams.get('marketplace');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [marketplace, setMarketplace] = useState<MarketplaceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [volunteerName, setVolunteerName] = useState('');
  const [volunteerEmail, setVolunteerEmail] = useState('');
  const [experienceWord, setExperienceWord] = useState('');
  const [wouldVolunteerAgain, setWouldVolunteerAgain] = useState<string | null>(null);
  const [improvementSuggestions, setImprovementSuggestions] = useState('');

  // Certificate state
  const [showCertificate, setShowCertificate] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [certificateSent, setCertificateSent] = useState(false);

  useEffect(() => {
    if (!marketplaceId) {
      setError('Invalid survey link. No marketplace specified.');
      setLoading(false);
      return;
    }
    fetchMarketplace();
  }, [marketplaceId]);

  const fetchMarketplace = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-external-survey?marketplace_id=${encodeURIComponent(marketplaceId!)}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
      const result = await response.json();
      if (!result.success) {
        setError(result.error || 'Marketplace not found.');
        return;
      }
      setMarketplace(result.marketplace);
    } catch {
      setError('Failed to load survey. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const parseVolunteerName = () => {
    const parts = volunteerName.trim().split(' ');
    return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
  };

  const handleSubmit = async () => {
    if (!volunteerName.trim()) {
      toast({ title: 'Name required', description: 'Please enter your name.', variant: 'destructive' });
      return;
    }
    if (!volunteerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(volunteerEmail)) {
      toast({ title: 'Valid email required', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }
    if (!experienceWord.trim() || wouldVolunteerAgain === null || !improvementSuggestions.trim()) {
      toast({ title: 'Please answer all questions', description: 'All survey questions are required.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('submit-external-survey', {
        body: {
          marketplace_id: marketplaceId,
          volunteer_name: volunteerName.trim(),
          volunteer_email: volunteerEmail.trim(),
          experience_word: experienceWord.trim(),
          would_volunteer_again: wouldVolunteerAgain === 'true',
          improvement_suggestions: improvementSuggestions.trim(),
        },
      });

      if (fnError) throw fnError;
      if (data && !data.success) throw new Error(data.error || 'Failed to submit survey');

      setShowCertificate(true);
      sendCertificateEmail();
      toast({ title: 'Survey Submitted!', description: 'Thank you for your feedback.' });
    } catch (err: any) {
      toast({ title: 'Submission Failed', description: err.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const downloadCertificate = async () => {
    setIsGenerating(true);
    try {
      const { firstName, lastName } = parseVolunteerName();
      const blob = await generateCertificatePDFBlob({ firstName, lastName, type: 'attendance' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-certificate-${volunteerName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Certificate Downloaded' });
    } catch {
      toast({ title: 'Download Failed', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const sendCertificateEmail = async () => {
    setIsSendingEmail(true);
    try {
      const { firstName, lastName } = parseVolunteerName();
      const base64Data = await generateCertificatePDF({ firstName, lastName, type: 'attendance' });
      const { error } = await supabase.functions.invoke('send-certificate', {
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: volunteerEmail.trim(),
          certificateBase64: base64Data,
          certificateType: 'attendance',
          marketplaceId,
        },
      });
      if (error) throw error;
      setCertificateSent(true);
      toast({ title: 'Certificate Sent!', description: `Emailed to ${volunteerEmail}` });
    } catch {
      toast({ title: 'Email Failed', description: 'Please download your certificate instead.', variant: 'destructive' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-destructive/20">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="font-display font-bold text-xl text-white mb-2">Survey Not Available</h1>
          <p className="text-white/70 mb-6">{error}</p>
          <Button onClick={() => navigate('/')}>Return Home</Button>
        </div>
      </div>
    );
  }

  if (showCertificate) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center bg-success/20">
            <Award className="w-12 h-12 text-success" />
          </div>
          <h2 className="font-display font-bold text-2xl text-white mb-2">Thank You for Volunteering!</h2>
          <p className="text-white/70 mb-4">{volunteerName}, your certificate of participation is ready.</p>

          <div className="mb-6 p-3 rounded-lg bg-white/5 border border-white/10">
            {isSendingEmail ? (
              <div className="flex items-center justify-center gap-2 text-white/70">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending certificate to {volunteerEmail}...</span>
              </div>
            ) : certificateSent ? (
              <div className="flex items-center justify-center gap-2 text-success">
                <Check className="w-4 h-4" />
                <span>Certificate sent to {volunteerEmail}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-white/50">
                <Mail className="w-4 h-4" />
                <span>Certificate will be sent to {volunteerEmail}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Button size="lg" onClick={downloadCertificate} disabled={isGenerating} className="w-full">
              {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download Certificate
            </Button>
            {!certificateSent && !isSendingEmail && (
              <Button size="lg" variant="outline" onClick={sendCertificateEmail} className="w-full">
                <Mail className="w-4 h-4 mr-2" />
                Resend to {volunteerEmail}
              </Button>
            )}
            <Button size="lg" variant="ghost" onClick={() => navigate('/')} className="w-full text-white/70 hover:text-white">
              Finish
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  const formatDate = (d: string | null) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <header className="bg-[#1a1a1a]/95 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-center">
          <BrandLogo size="sm" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="text-center">
            <h1 className="font-display font-bold text-2xl text-white mb-2">Volunteer Feedback Survey</h1>
            {marketplace && (
              <p className="text-white/70">
                {marketplace.name}
                {marketplace.event_date && ` • ${formatDate(marketplace.event_date)}`}
                {marketplace.location && ` • ${marketplace.location}`}
              </p>
            )}
          </div>

          {/* Name & Email */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-4">
            <div>
              <Label className="text-white mb-1 block">Full Name *</Label>
              <Input
                value={volunteerName}
                onChange={(e) => setVolunteerName(e.target.value)}
                placeholder="Enter your full name"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                maxLength={100}
              />
            </div>
            <div>
              <Label className="text-white mb-1 block">Email Address *</Label>
              <Input
                type="email"
                value={volunteerEmail}
                onChange={(e) => setVolunteerEmail(e.target.value)}
                placeholder="Enter your email"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                maxLength={255}
              />
            </div>
          </div>

          {/* Question 1 */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <label className="block text-white font-medium mb-3">
              How would you describe your GIF experience in one word?
            </label>
            <Textarea
              value={experienceWord}
              onChange={(e) => setExperienceWord(e.target.value)}
              placeholder="Enter your answer..."
              className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              rows={2}
            />
          </div>

          {/* Question 2 */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <label className="block text-white font-medium mb-3">
              Would you volunteer for Gift It Forward again in the future?
            </label>
            <RadioGroup value={wouldVolunteerAgain || ''} onValueChange={setWouldVolunteerAgain} className="flex gap-6">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="true" id="ext-yes" className="border-white/40 text-primary" />
                <Label htmlFor="ext-yes" className="text-white cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="false" id="ext-no" className="border-white/40 text-primary" />
                <Label htmlFor="ext-no" className="text-white cursor-pointer">No</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Question 3 */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <label className="block text-white font-medium mb-3">
              What could be improved for future volunteer experiences?
            </label>
            <Textarea
              value={improvementSuggestions}
              onChange={(e) => setImprovementSuggestions(e.target.value)}
              placeholder="Share your suggestions..."
              className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              rows={4}
            />
          </div>

          <Button size="lg" onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Submit & Get Certificate
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
