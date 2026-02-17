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
import { LanguageToggle } from '@/components/survey/LanguageToggle';
import { surveyTranslations, type SurveyLanguage } from '@/lib/surveyTranslations';

interface SurveyData {
  id: string;
  volunteer_name: string;
  volunteer_email: string;
  volunteer_card_id: string | null;
  completed_at: string | null;
  certificate_sent_at: string | null;
}

interface SurveyQuestion {
  id: string;
  question_text: string;
  question_text_ar: string | null;
  question_type: string;
  options: string[];
  options_ar: string[];
  is_required: boolean;
  sort_order: number;
}

export default function VolunteerSurveyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const { toast } = useToast();

  const [language, setLanguage] = useState<SurveyLanguage>('en');
  const t = surveyTranslations[language];

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

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
    fetchSurveyAndQuestions();
  }, [token]);

  const fetchSurveyAndQuestions = async () => {
    try {
      const [surveyRes, questionsRes] = await Promise.all([
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-survey?action=get&token=${encodeURIComponent(token!)}`,
          { method: 'GET', headers: { 'Content-Type': 'application/json' } }
        ),
        supabase
          .from('survey_questions')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true }),
      ]);

      const surveyResult = await surveyRes.json();

      if (!surveyResult.success) {
        setError(surveyResult.error || 'Survey not found.');
        setLoading(false);
        return;
      }

      setSurveyData(surveyResult.survey);

      if (questionsRes.data) {
        setQuestions(questionsRes.data.map(q => ({
          ...q,
          options: Array.isArray(q.options) ? q.options as string[] : [],
          options_ar: Array.isArray((q as any).options_ar) ? (q as any).options_ar as string[] : [],
          question_text_ar: (q as any).question_text_ar ?? null,
        })));
      }

      if (surveyResult.survey.completed_at) {
        setShowCertificate(true);
        setCertificateSent(!!surveyResult.survey.certificate_sent_at);
      }
    } catch (err) {
      console.error('Error fetching survey:', err);
      setError('Failed to load survey. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const setAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const getQuestionText = (q: SurveyQuestion) =>
    language === 'ar' && q.question_text_ar ? q.question_text_ar : q.question_text;

  const getQuestionOptions = (q: SurveyQuestion) =>
    language === 'ar' && q.options_ar.length > 0 ? q.options_ar : q.options;

  const handleSubmit = async () => {
    for (const q of questions) {
      if (q.is_required && !answers[q.id]?.trim()) {
        toast({ title: t.answerRequired, variant: 'destructive' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data, error: submitError } = await supabase.functions.invoke('submit-survey', {
        body: { surveyToken: token, answers },
      });

      if (submitError) throw submitError;
      if (data && !data.success) throw new Error(data.error || 'Failed to submit survey');

      setShowCertificate(true);
      sendCertificateEmail();
      toast({ title: t.submitted, description: t.submittedDesc });
    } catch (err: any) {
      toast({ title: t.submissionFailed, description: err.message || t.tryAgain, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const parseVolunteerName = () => {
    const nameParts = (surveyData?.volunteer_name || 'Volunteer').split(' ');
    return { firstName: nameParts[0] || '', lastName: nameParts.slice(1).join(' ') || '' };
  };

  const downloadCertificate = async () => {
    if (!surveyData) return;
    setIsGenerating(true);
    try {
      const { firstName, lastName } = parseVolunteerName();
      const blob = await generateCertificatePDFBlob({ firstName, lastName, type: 'attendance' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance-certificate-${surveyData.volunteer_name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: t.certificateDownloaded });
    } catch {
      toast({ title: t.downloadFailed, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const sendCertificateEmail = async () => {
    if (!surveyData) return;
    setIsSendingEmail(true);
    try {
      const { firstName, lastName } = parseVolunteerName();
      const base64Data = await generateCertificatePDF({ firstName, lastName, type: 'attendance' });
      const { error } = await supabase.functions.invoke('send-certificate', {
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: surveyData.volunteer_email.trim(),
          certificateBase64: base64Data,
          certificateType: 'attendance',
        },
      });
      if (error) throw error;
      setCertificateSent(true);
      await supabase.functions.invoke('submit-survey?action=update-certificate-sent', {
        body: { surveyToken: token },
      });
      toast({ title: t.certificateSentTitle, description: t.emailedTo(surveyData.volunteer_email) });
    } catch {
      toast({ title: t.emailFailed, description: t.emailFailedDesc, variant: 'destructive' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const renderQuestionInput = (q: SurveyQuestion) => {
    const value = answers[q.id] || '';
    const opts = getQuestionOptions(q);

    switch (q.question_type) {
      case 'short_text':
        return (
          <Input
            value={value}
            onChange={e => setAnswer(q.id, e.target.value)}
            placeholder={t.enterAnswer}
            className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
            maxLength={500}
          />
        );
      case 'long_text':
        return (
          <Textarea
            value={value}
            onChange={e => setAnswer(q.id, e.target.value)}
            placeholder={t.enterAnswer}
            className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
            rows={4}
            maxLength={2000}
          />
        );
      case 'yes_no':
        return (
          <RadioGroup value={value} onValueChange={v => setAnswer(q.id, v)} className="flex gap-6">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id={`${q.id}-yes`} className="border-white/40 text-primary" />
              <Label htmlFor={`${q.id}-yes`} className="text-white cursor-pointer">{t.yes}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id={`${q.id}-no`} className="border-white/40 text-primary" />
              <Label htmlFor={`${q.id}-no`} className="text-white cursor-pointer">{t.no}</Label>
            </div>
          </RadioGroup>
        );
      case 'multiple_choice':
        return (
          <RadioGroup value={value} onValueChange={v => setAnswer(q.id, v)} className="space-y-2">
            {opts.map((opt, i) => (
              <div key={i} className="flex items-center space-x-2">
                <RadioGroupItem value={q.options[i] || opt} id={`${q.id}-${i}`} className="border-white/40 text-primary" />
                <Label htmlFor={`${q.id}-${i}`} className="text-white cursor-pointer">{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'rating':
        return (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setAnswer(q.id, String(n))}
                className={`w-10 h-10 rounded-lg border transition-colors flex items-center justify-center ${
                  value === String(n)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-white/5 border-white/20 text-white/60 hover:bg-white/10'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        );
      default:
        return <Input value={value} onChange={e => setAnswer(q.id, e.target.value)} className="bg-white/5 border-white/20 text-white" />;
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

  if (showCertificate && surveyData) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center bg-success/20">
            <Award className="w-12 h-12 text-success" />
          </div>
          <h2 className="font-display font-bold text-2xl text-white mb-2">{t.thankYou}</h2>
          <p className="text-white/70 mb-4">{t.certificateReady(surveyData.volunteer_name)}</p>

          <div className="mb-6 p-3 rounded-lg bg-white/5 border border-white/10">
            {isSendingEmail ? (
              <div className="flex items-center justify-center gap-2 text-white/70">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.sendingCertificate(surveyData.volunteer_email)}</span>
              </div>
            ) : certificateSent ? (
              <div className="flex items-center justify-center gap-2 text-success">
                <Check className="w-4 h-4" />
                <span>{t.certificateSent(surveyData.volunteer_email)}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-white/50">
                <Mail className="w-4 h-4" />
                <span>{t.certificateWillSend(surveyData.volunteer_email)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <Button size="lg" onClick={downloadCertificate} disabled={isGenerating} className="w-full">
              {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              {t.downloadCertificate}
            </Button>
            {!certificateSent && !isSendingEmail && (
              <Button size="lg" variant="outline" onClick={sendCertificateEmail} className="w-full">
                <Mail className="w-4 h-4 mr-2" />
                {t.resendTo(surveyData.volunteer_email)}
              </Button>
            )}
            <Button size="lg" variant="ghost" onClick={() => navigate('/')} className="w-full text-white/70 hover:text-white">
              {t.finish}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="bg-[#1a1a1a]/95 backdrop-blur border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <BrandLogo size="sm" />
          <LanguageToggle language={language} onChange={setLanguage} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="text-center">
            <h1 className="font-display font-bold text-2xl text-white mb-2">{t.pageTitle}</h1>
            <p className="text-white/70">{t.subtitleWithName(surveyData?.volunteer_name || '')}</p>
          </div>

          {/* Dynamic Questions */}
          {questions.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-white/50" />
            </div>
          ) : (
            questions.map(q => (
              <div key={q.id} className="bg-white/5 rounded-xl p-6 border border-white/10">
                <label className="block text-white font-medium mb-3">
                  {getQuestionText(q)} {q.is_required && '*'}
                </label>
                {renderQuestionInput(q)}
              </div>
            ))
          )}

          <Button size="lg" onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {t.submit}
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
