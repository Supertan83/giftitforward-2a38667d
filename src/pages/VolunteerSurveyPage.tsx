import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Award, Download, Mail, Check, Send } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import jsPDF from 'jspdf';

interface SurveyData {
  id: string;
  volunteer_name: string;
  volunteer_email: string;
  volunteer_card_id: string | null;
  experience_word: string | null;
  would_volunteer_again: boolean | null;
  improvement_suggestions: string | null;
  completed_at: string | null;
  certificate_sent_at: string | null;
}

export default function VolunteerSurveyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [experienceWord, setExperienceWord] = useState('');
  const [wouldVolunteerAgain, setWouldVolunteerAgain] = useState<string | null>(null);
  const [improvementSuggestions, setImprovementSuggestions] = useState('');

  // Certificate state
  const [showCertificate, setShowCertificate] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [certificateSent, setCertificateSent] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Invalid survey link. Please use the link from your email.');
      setLoading(false);
      return;
    }

    fetchSurvey();
  }, [token]);

  const fetchSurvey = async () => {
    try {
      // Use edge function to fetch survey (server-side token validation)
      const { data, error: fetchError } = await supabase.functions.invoke('submit-survey', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: null,
      });

      // The invoke method doesn't support GET with query params, so we need to use a different approach
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-survey?action=get&token=${encodeURIComponent(token!)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'Survey not found. The link may be invalid or expired.');
        setLoading(false);
        return;
      }

      setSurveyData(result.survey);

      // If already completed, show certificate
      if (result.survey.completed_at) {
        setExperienceWord(result.survey.experience_word || '');
        setWouldVolunteerAgain(result.survey.would_volunteer_again?.toString() || null);
        setImprovementSuggestions(result.survey.improvement_suggestions || '');
        setShowCertificate(true);
        setCertificateSent(!!result.survey.certificate_sent_at);
      }
    } catch (err) {
      console.error('Error fetching survey:', err);
      setError('Failed to load survey. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!experienceWord.trim()) {
      toast({
        title: 'Please answer all questions',
        description: 'Describe your GIF experience in one word.',
        variant: 'destructive',
      });
      return;
    }

    if (wouldVolunteerAgain === null) {
      toast({
        title: 'Please answer all questions',
        description: 'Would you volunteer again?',
        variant: 'destructive',
      });
      return;
    }

    if (!improvementSuggestions.trim()) {
      toast({
        title: 'Please answer all questions',
        description: 'Share what could be improved.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      // Use edge function for secure server-side submission
      const { data, error: submitError } = await supabase.functions.invoke('submit-survey', {
        body: {
          surveyToken: token,
          experienceWord: experienceWord.trim(),
          wouldVolunteerAgain: wouldVolunteerAgain === 'true',
          improvementSuggestions: improvementSuggestions.trim(),
        },
      });

      if (submitError) throw submitError;

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to submit survey');
      }

      setShowCertificate(true);
      
      // Auto-send certificate email
      sendCertificateEmail();

      toast({
        title: 'Survey Submitted!',
        description: 'Thank you for your feedback.',
      });
    } catch (err: any) {
      console.error('Error submitting survey:', err);
      toast({
        title: 'Submission Failed',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const generateCertificatePDF = async (): Promise<string> => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const fullName = surveyData?.volunteer_name || 'Volunteer';

    // Load background image
    const bgResponse = await fetch('/images/certificate-background.png');
    const bgBlob = await bgResponse.blob();
    const bgBase64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(bgBlob);
    });

    // Add background image (full page)
    doc.addImage(bgBase64, 'PNG', 0, 0, pageWidth, pageHeight);

    // Add volunteer name in the middle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(0, 0, 0);
    doc.text(fullName, pageWidth / 2, 100, { align: 'center' });

    return doc.output('datauristring');
  };

  const downloadCertificate = async () => {
    if (!surveyData) return;
    
    setIsGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const fullName = surveyData.volunteer_name;

      const bgResponse = await fetch('/images/certificate-background.png');
      const bgBlob = await bgResponse.blob();
      const bgBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(bgBlob);
      });

      doc.addImage(bgBase64, 'PNG', 0, 0, pageWidth, pageHeight);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(0, 0, 0);
      doc.text(fullName, pageWidth / 2, 100, { align: 'center' });

      doc.save(`certificate-${fullName.replace(/\s+/g, '-').toLowerCase()}.pdf`);

      toast({
        title: 'Certificate Downloaded',
        description: 'Your certificate has been saved to your device.',
      });
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast({
        title: 'Download Failed',
        description: 'Failed to generate certificate. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const sendCertificateEmail = async () => {
    if (!surveyData) return;

    setIsSendingEmail(true);
    try {
      const pdfDataUri = await generateCertificatePDF();
      const base64Data = pdfDataUri.split(',')[1];

      const nameParts = surveyData.volunteer_name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const { data, error } = await supabase.functions.invoke('send-certificate', {
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: surveyData.volunteer_email.trim(),
          certificateBase64: base64Data,
        },
      });

      if (error) throw error;

      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to send certificate email');
      }

      setCertificateSent(true);

      // Update certificate_sent_at via edge function
      await supabase.functions.invoke('submit-survey?action=update-certificate-sent', {
        body: { surveyToken: token },
      });

      toast({
        title: 'Certificate Sent!',
        description: `Your certificate has been emailed to ${surveyData.volunteer_email}`,
      });
    } catch (error: any) {
      console.error('Error sending certificate email:', error);
      toast({
        title: 'Email Failed',
        description: error.message || 'Failed to send certificate email. Please download your certificate instead.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-destructive/20">
            <span className="text-3xl">⚠️</span>
          </div>
          <h1 className="font-display font-bold text-xl text-white mb-2">
            Survey Not Available
          </h1>
          <p className="text-white/70 mb-6">{error}</p>
          <Button onClick={() => navigate('/')}>Return Home</Button>
        </div>
      </div>
    );
  }

  // Certificate view after completion
  if (showCertificate && surveyData) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center bg-success/20">
            <Award className="w-12 h-12 text-success" />
          </div>
          <h2 className="font-display font-bold text-2xl text-white mb-2">
            Thank You for Volunteering!
          </h2>
          <p className="text-white/70 mb-4">
            {surveyData.volunteer_name}, your certificate of participation is ready.
          </p>

          {/* Email status indicator */}
          <div className="mb-6 p-3 rounded-lg bg-white/5 border border-white/10">
            {isSendingEmail ? (
              <div className="flex items-center justify-center gap-2 text-white/70">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending certificate to {surveyData.volunteer_email}...</span>
              </div>
            ) : certificateSent ? (
              <div className="flex items-center justify-center gap-2 text-success">
                <Check className="w-4 h-4" />
                <span>Certificate sent to {surveyData.volunteer_email}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-white/50">
                <Mail className="w-4 h-4" />
                <span>Certificate will be sent to {surveyData.volunteer_email}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              onClick={downloadCertificate}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download Certificate
            </Button>

            {!certificateSent && !isSendingEmail && (
              <Button
                size="lg"
                variant="outline"
                onClick={sendCertificateEmail}
                className="w-full"
              >
                <Mail className="w-4 h-4 mr-2" />
                Resend to {surveyData.volunteer_email}
              </Button>
            )}

            <Button
              size="lg"
              variant="ghost"
              onClick={() => navigate('/')}
              className="w-full text-white/70 hover:text-white"
            >
              Finish
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Survey form
  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      {/* Header */}
      <header className="bg-[#1a1a1a]/95 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-center">
          <BrandLogo size="sm" />
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Title */}
          <div className="text-center">
            <h1 className="font-display font-bold text-2xl text-white mb-2">
              Volunteer Feedback Survey
            </h1>
            <p className="text-white/70">
              Hi {surveyData?.volunteer_name}! Please share your experience.
            </p>
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
            <RadioGroup
              value={wouldVolunteerAgain || ''}
              onValueChange={setWouldVolunteerAgain}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="true"
                  id="yes"
                  className="border-white/40 text-primary"
                />
                <Label htmlFor="yes" className="text-white cursor-pointer">
                  Yes
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem
                  value="false"
                  id="no"
                  className="border-white/40 text-primary"
                />
                <Label htmlFor="no" className="text-white cursor-pointer">
                  No
                </Label>
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

          {/* Submit Button */}
          <Button
            size="lg"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Submit & Get Certificate
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
