import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Loader2, Award, Download, Mail, Check, Send } from 'lucide-react';
import gifLogo from '@/assets/gift-it-forward-logo.png';
import { generateCertificatePDF, generateCertificatePDFBlob } from '@/components/certificates/CertificateGenerator';
import { LanguageToggle } from '@/components/survey/LanguageToggle';
import { surveyTranslations, type SurveyLanguage } from '@/lib/surveyTranslations';

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

export default function ExternalSurveyPage() {
  const { toast } = useToast();

  const [language, setLanguage] = useState<SurveyLanguage>('en');
  const t = surveyTranslations[language];

  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [volunteerName, setVolunteerName] = useState('');
  const [volunteerEmail, setVolunteerEmail] = useState('');

  const [showCertificate, setShowCertificate] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [certificateSent, setCertificateSent] = useState(false);

  useEffect(() => {
    const fetchQuestions = async () => {
      const { data, error } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (!error && data) {
        setQuestions(data.map(q => ({
          ...q,
          options: Array.isArray(q.options) ? q.options as string[] : [],
          options_ar: Array.isArray((q as any).options_ar) ? (q as any).options_ar as string[] : [],
          question_text_ar: (q as any).question_text_ar ?? null,
        })));
      }
      setLoadingQuestions(false);
    };
    fetchQuestions();
  }, []);

  const setAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const getQuestionText = (q: SurveyQuestion) =>
    language === 'ar' && q.question_text_ar ? q.question_text_ar : q.question_text;

  const getQuestionOptions = (q: SurveyQuestion) =>
    language === 'ar' && q.options_ar.length > 0 ? q.options_ar : q.options;

  const parseVolunteerName = () => {
    const parts = volunteerName.trim().split(' ');
    return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '' };
  };

  const handleSubmit = async () => {
    if (!volunteerName.trim()) {
      toast({ title: t.nameRequired, description: t.nameRequiredDesc, variant: 'destructive' });
      return;
    }
    if (!volunteerEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(volunteerEmail)) {
      toast({ title: t.validEmail, description: t.validEmailDesc, variant: 'destructive' });
      return;
    }

    for (const q of questions) {
      if (q.is_required && !answers[q.id]?.trim()) {
        toast({ title: t.answerRequired, variant: 'destructive' });
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('submit-external-survey', {
        body: {
          volunteer_name: volunteerName.trim(),
          volunteer_email: volunteerEmail.trim(),
          answers,
        },
      });

      if (fnError) throw fnError;
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
      toast({ title: t.certificateDownloaded });
    } catch {
      toast({ title: t.downloadFailed, variant: 'destructive' });
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
        },
      });
      if (error) throw error;
      setCertificateSent(true);
      toast({ title: t.certificateSentTitle, description: t.emailedTo(volunteerEmail) });
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

  if (showCertificate) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4" dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center bg-success/20">
            <Award className="w-12 h-12 text-success" />
          </div>
          <h2 className="font-display font-bold text-2xl text-white mb-2">{t.thankYou}</h2>
          <p className="text-white/70 mb-4">{t.certificateReady(volunteerName)}</p>

          <div className="mb-6 p-3 rounded-lg bg-white/5 border border-white/10">
            {isSendingEmail ? (
              <div className="flex items-center justify-center gap-2 text-white/70">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.sendingCertificate(volunteerEmail)}</span>
              </div>
            ) : certificateSent ? (
              <div className="flex items-center justify-center gap-2 text-success">
                <Check className="w-4 h-4" />
                <span>{t.certificateSent(volunteerEmail)}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-white/50">
                <Mail className="w-4 h-4" />
                <span>{t.certificateWillSend(volunteerEmail)}</span>
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
                {t.resendTo(volunteerEmail)}
              </Button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <header className="bg-white border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <img src={gifLogo} alt="Gift It Forward" className="h-10 object-contain" />
          <LanguageToggle language={language} onChange={setLanguage} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <div className="text-center">
            <h1 className="font-display font-bold text-2xl text-white mb-2">{t.pageTitle}</h1>
            <p className="text-white/70">{t.subtitle}</p>
          </div>

          {/* Name & Email */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-4">
            <div>
              <Label className="text-white mb-1 block">{t.fullName}</Label>
              <Input
                value={volunteerName}
                onChange={(e) => setVolunteerName(e.target.value)}
                placeholder={t.fullNamePlaceholder}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                maxLength={100}
              />
            </div>
            <div>
              <Label className="text-white mb-1 block">{t.email}</Label>
              <Input
                type="email"
                value={volunteerEmail}
                onChange={(e) => setVolunteerEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
                maxLength={255}
              />
            </div>
          </div>

          {/* Dynamic Questions */}
          {loadingQuestions ? (
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

          <Button size="lg" onClick={handleSubmit} disabled={submitting || loadingQuestions} className="w-full">
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {t.submit}
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
