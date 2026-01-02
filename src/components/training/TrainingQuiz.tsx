import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import { Check, X, ChevronLeft, ChevronRight, Award, Download, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { TrainingUserInfo } from '@/pages/TrainingPage';

interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: QuizOption[];
}

// Quiz questions based on the Circular Economy training
const quizQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'What is the main goal of Gift It Forward 2026?',
    options: [
      { id: 'q1a', text: 'To sell unused goods for profit', isCorrect: false },
      { id: 'q1b', text: 'To redistribute surplus items to low-income communities while reducing emissions', isCorrect: true },
      { id: 'q1c', text: 'To collect waste for recycling only', isCorrect: false },
      { id: 'q1d', text: 'To store unsold goods for future use', isCorrect: false },
    ],
  },
  {
    id: 'q2',
    question: 'What is the Circular Economy?',
    options: [
      { id: 'q2a', text: 'A circular economy keeps products and materials in use for as long as possible, reducing waste and extracting more value from every resource', isCorrect: true },
      { id: 'q2b', text: 'A type of economic model found in Asian countries', isCorrect: false },
      { id: 'q2c', text: 'An economic model that takes, makes, and wastes', isCorrect: false },
      { id: 'q2d', text: 'There is no such thing as a circular economy', isCorrect: false },
    ],
  },
  {
    id: 'q3',
    question: 'What are "avoided emissions"?',
    options: [
      { id: 'q3a', text: 'The emissions from items sent to landfill', isCorrect: false },
      { id: 'q3b', text: 'The emissions saved when existing goods are reused instead of producing new ones', isCorrect: true },
      { id: 'q3c', text: 'The emissions measured from employee travel', isCorrect: false },
      { id: 'q3d', text: 'The emissions from recycling facilities', isCorrect: false },
    ],
  },
  {
    id: 'q4',
    question: 'In the Dubai Holding case study, what was achieved through circular redistribution?',
    options: [
      { id: 'q4a', text: 'Over 115t+ tonnes of surplus items were digitised and redistributed, reducing CO₂e', isCorrect: true },
      { id: 'q4b', text: 'Surplus items were stored for future sales', isCorrect: false },
      { id: 'q4c', text: 'All unsold items were recycled into packaging', isCorrect: false },
      { id: 'q4d', text: 'A marketing campaign for Scope 3 awareness only', isCorrect: false },
    ],
  },
  {
    id: 'q5',
    question: "One major reason companies don't act on circularity is:",
    options: [
      { id: 'q5a', text: "They don't have enough waste", isCorrect: false },
      { id: 'q5b', text: 'They lack visibility into what surplus they have and its carbon impact', isCorrect: true },
      { id: 'q5c', text: 'They are required by law to destroy items', isCorrect: false },
      { id: 'q5d', text: 'They already redistribute everything', isCorrect: false },
    ],
  },
  {
    id: 'q6',
    question: 'How does circular giving uplift communities?',
    options: [
      { id: 'q6a', text: 'By creating temporary warehouse jobs', isCorrect: false },
      { id: 'q6b', text: 'By ensuring usable goods reach children and workers who need them, improving lives', isCorrect: true },
      { id: 'q6c', text: 'By reducing the number of charity organizations', isCorrect: false },
      { id: 'q6d', text: 'By promoting luxury consumption', isCorrect: false },
    ],
  },
  {
    id: 'q7',
    question: 'What can corporate volunteers do after completing this training?',
    options: [
      { id: 'q7a', text: 'Forget about circularity and return to normal routines', isCorrect: false },
      { id: 'q7b', text: 'Become advocates for circular economy practices and share what they learned', isCorrect: true },
      { id: 'q7c', text: 'Focus only on recycling plastic', isCorrect: false },
      { id: 'q7d', text: 'Wait for companies to act first', isCorrect: false },
    ],
  },
];

interface TrainingQuizProps {
  userInfo: TrainingUserInfo;
  onComplete: () => void;
}

const TrainingQuiz = ({ userInfo, onComplete }: TrainingQuizProps) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [certificateSent, setCertificateSent] = useState(false);
  const [autoEmailAttempted, setAutoEmailAttempted] = useState(false);
  const { toast } = useToast();

  const progress = ((currentQuestion + 1) / quizQuestions.length) * 100;
  const currentQ = quizQuestions[currentQuestion];
  const hasAnsweredCurrent = answers[currentQ.id] !== undefined;
  const allAnswered = Object.keys(answers).length === quizQuestions.length;
  const isLastQuestion = currentQuestion === quizQuestions.length - 1;

  const handleAnswer = (optionId: string) => {
    if (hasAnsweredCurrent) return;
    setAnswers({ ...answers, [currentQ.id]: optionId });
  };

  const goToNext = () => {
    if (isLastQuestion && allAnswered) {
      setShowResults(true);
    } else if (!isLastQuestion) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const goToPrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
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
    const fullName = `${userInfo.firstName} ${userInfo.lastName}`;

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
    setIsGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const fullName = `${userInfo.firstName} ${userInfo.lastName}`;

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
    setIsSendingEmail(true);
    try {
      const pdfDataUri = await generateCertificatePDF();
      // Extract base64 data from data URI
      const base64Data = pdfDataUri.split(',')[1];

      const { data, error } = await supabase.functions.invoke('send-certificate', {
        body: {
          firstName: userInfo.firstName,
          lastName: userInfo.lastName,
          email: userInfo.email,
          certificateBase64: base64Data,
        },
      });

      if (error) throw error;

      setCertificateSent(true);
      toast({
        title: 'Certificate Sent!',
        description: `Your certificate has been emailed to ${userInfo.email}`,
      });
    } catch (error: any) {
      console.error('Error sending certificate email:', error);
      toast({
        title: 'Email Failed',
        description: error.message || 'Failed to send certificate email. Please download instead.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Auto-send certificate email when results are shown
  useEffect(() => {
    if (showResults && !autoEmailAttempted) {
      setAutoEmailAttempted(true);
      sendCertificateEmail();
    }
  }, [showResults, autoEmailAttempted]);

  // Results screen
  if (showResults) {
    return (
      <div className="h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center bg-success/20">
            <Award className="w-12 h-12 text-success" />
          </div>
          <h2 className="font-display font-bold text-2xl text-white mb-2">
            Training Complete!
          </h2>
          <p className="text-white/70 mb-4">
            Congratulations, {userInfo.firstName}! You've completed the Circular Economy Training Module.
          </p>

          {/* Email status indicator */}
          <div className="mb-6 p-3 rounded-lg bg-white/5 border border-white/10">
            {isSendingEmail ? (
              <div className="flex items-center justify-center gap-2 text-white/70">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending certificate to {userInfo.email}...</span>
              </div>
            ) : certificateSent ? (
              <div className="flex items-center justify-center gap-2 text-success">
                <Check className="w-4 h-4" />
                <span>Certificate sent to {userInfo.email}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-white/50">
                <Mail className="w-4 h-4" />
                <span>Certificate will be sent to {userInfo.email}</span>
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
                Resend to {userInfo.email}
              </Button>
            )}

            <Button
              size="lg"
              variant="ghost"
              onClick={onComplete}
              className="w-full text-white/70 hover:text-white"
            >
              Finish
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Quiz questions
  return (
    <div className="h-screen bg-[#1a1a1a] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#1a1a1a]/95 backdrop-blur border-b border-white/10 px-4 py-2">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white/70">
              Question {currentQuestion + 1} of {quizQuestions.length}
            </span>
          </div>
          <div className="flex-1 max-w-md mx-4">
            <Progress value={progress} className="h-1.5 bg-white/10" />
          </div>
          <span className="text-sm text-white/50">
            {Object.keys(answers).length} answered
          </span>
        </div>
      </header>

      {/* Question content */}
      <main className="flex-1 min-h-0 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <h2 className="font-display font-semibold text-xl text-white text-center">
                {currentQ.question}
              </h2>
              
              <div className="space-y-3">
                {currentQ.options.map((option, idx) => {
                  const isSelected = answers[currentQ.id] === option.id;
                  const isCorrect = option.isCorrect;
                  
                  let borderClass = 'border-white/20 hover:border-white/40';
                  let bgClass = 'bg-white/5';
                  
                  if (hasAnsweredCurrent) {
                    if (isCorrect) {
                      borderClass = 'border-success';
                      bgClass = 'bg-success/10';
                    } else if (isSelected) {
                      borderClass = 'border-destructive';
                      bgClass = 'bg-destructive/10';
                    } else {
                      borderClass = 'border-white/10';
                      bgClass = 'bg-white/5 opacity-50';
                    }
                  } else if (isSelected) {
                    borderClass = 'border-primary';
                    bgClass = 'bg-primary/10';
                  }
                  
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleAnswer(option.id)}
                      disabled={hasAnsweredCurrent}
                      className={`w-full p-4 rounded-lg border-2 text-left transition-all ${borderClass} ${bgClass} ${hasAnsweredCurrent ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-white">
                          <span className="font-medium mr-2 text-white/70">{String.fromCharCode(65 + idx)}.</span>
                          {option.text}
                        </div>
                        {hasAnsweredCurrent && isCorrect && (
                          <Check className="w-5 h-5 text-success flex-shrink-0 ml-2" />
                        )}
                        {hasAnsweredCurrent && isSelected && !isCorrect && (
                          <X className="w-5 h-5 text-destructive flex-shrink-0 ml-2" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Navigation */}
      <footer className="flex-shrink-0 py-4 px-4 bg-[#1a1a1a] border-t border-white/10">
        <div className="flex justify-between max-w-2xl mx-auto">
          <Button
            variant="outline"
            onClick={goToPrevious}
            disabled={currentQuestion === 0}
            className="border-white/20 text-white hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          
          {isLastQuestion ? (
            <Button
              onClick={goToNext}
              disabled={!allAnswered}
            >
              Complete Quiz
            </Button>
          ) : (
            <Button
              onClick={goToNext}
              disabled={!hasAnsweredCurrent}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default TrainingQuiz;
