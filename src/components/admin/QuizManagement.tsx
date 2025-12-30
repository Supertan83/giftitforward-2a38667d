import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit2,
  Eye,
  Save,
  GripVertical,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  Award,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface SurveyOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface SurveyQuestion {
  id: string;
  question: string;
  options: SurveyOption[];
}

interface Survey {
  id: string;
  title: string;
  description: string;
  questions: SurveyQuestion[];
  createdAt: Date;
}

// Sample survey data based on the uploaded PDF
const sampleSurvey: Survey = {
  id: '1',
  title: 'Volunteer Knowledge Check: Your Role in the Circular Economy',
  description: 'Test your understanding of circular economy principles and the Gift It Forward program.',
  createdAt: new Date(),
  questions: [
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
      question: 'One major reason companies don\'t act on circularity is:',
      options: [
        { id: 'q5a', text: 'They don\'t have enough waste', isCorrect: false },
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
  ],
};

interface SurveyManagementProps {
  onBack: () => void;
}

export const QuizManagement = ({ onBack }: SurveyManagementProps) => {
  const [surveys, setSurveys] = useState<Survey[]>([sampleSurvey]);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewSurvey, setPreviewSurvey] = useState<Survey | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [volunteerName, setVolunteerName] = useState('');
  const { toast } = useToast();

  const createNewSurvey = () => {
    const newSurvey: Survey = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      questions: [],
      createdAt: new Date(),
    };
    setEditingSurvey(newSurvey);
    setIsEditing(true);
  };

  const editSurvey = (survey: Survey) => {
    setEditingSurvey({ ...survey, questions: survey.questions.map(q => ({ ...q, options: [...q.options] })) });
    setIsEditing(true);
  };

  const addQuestion = () => {
    if (!editingSurvey) return;
    const newQuestion: SurveyQuestion = {
      id: crypto.randomUUID(),
      question: '',
      options: [
        { id: crypto.randomUUID(), text: '', isCorrect: false },
        { id: crypto.randomUUID(), text: '', isCorrect: false },
        { id: crypto.randomUUID(), text: '', isCorrect: false },
        { id: crypto.randomUUID(), text: '', isCorrect: false },
      ],
    };
    setEditingSurvey({
      ...editingSurvey,
      questions: [...editingSurvey.questions, newQuestion],
    });
  };

  const updateQuestion = (questionId: string, updates: Partial<SurveyQuestion>) => {
    if (!editingSurvey) return;
    setEditingSurvey({
      ...editingSurvey,
      questions: editingSurvey.questions.map(q =>
        q.id === questionId ? { ...q, ...updates } : q
      ),
    });
  };

  const updateOption = (questionId: string, optionId: string, updates: Partial<SurveyOption>) => {
    if (!editingSurvey) return;
    setEditingSurvey({
      ...editingSurvey,
      questions: editingSurvey.questions.map(q =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map(o =>
                o.id === optionId ? { ...o, ...updates } : o
              ),
            }
          : q
      ),
    });
  };

  const setCorrectAnswer = (questionId: string, optionId: string) => {
    if (!editingSurvey) return;
    setEditingSurvey({
      ...editingSurvey,
      questions: editingSurvey.questions.map(q =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map(o => ({
                ...o,
                isCorrect: o.id === optionId,
              })),
            }
          : q
      ),
    });
  };

  const deleteQuestion = (questionId: string) => {
    if (!editingSurvey) return;
    setEditingSurvey({
      ...editingSurvey,
      questions: editingSurvey.questions.filter(q => q.id !== questionId),
    });
  };

  const saveSurvey = () => {
    if (!editingSurvey) return;
    
    if (!editingSurvey.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a survey title',
        variant: 'destructive',
      });
      return;
    }

    if (editingSurvey.questions.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please add at least one question',
        variant: 'destructive',
      });
      return;
    }

    for (const q of editingSurvey.questions) {
      if (!q.question.trim()) {
        toast({
          title: 'Validation Error',
          description: 'All questions must have text',
          variant: 'destructive',
        });
        return;
      }
      if (!q.options.some(o => o.isCorrect)) {
        toast({
          title: 'Validation Error',
          description: 'Each question must have a correct answer selected',
          variant: 'destructive',
        });
        return;
      }
      if (q.options.some(o => !o.text.trim())) {
        toast({
          title: 'Validation Error',
          description: 'All answer options must have text',
          variant: 'destructive',
        });
        return;
      }
    }

    const existingIndex = surveys.findIndex(q => q.id === editingSurvey.id);
    if (existingIndex >= 0) {
      setSurveys(surveys.map(q => q.id === editingSurvey.id ? editingSurvey : q));
    } else {
      setSurveys([...surveys, editingSurvey]);
    }

    setEditingSurvey(null);
    setIsEditing(false);
    toast({
      title: 'Survey Saved',
      description: 'Your survey has been saved successfully',
    });
  };

  const deleteSurvey = (surveyId: string) => {
    setSurveys(surveys.filter(q => q.id !== surveyId));
    toast({
      title: 'Survey Deleted',
      description: 'The survey has been removed',
    });
  };

  const openPreview = (survey: Survey) => {
    setPreviewSurvey(survey);
    setPreviewIndex(0);
    setPreviewAnswers({});
    setShowResults(false);
    setShowPreview(true);
  };

  const handlePreviewAnswer = (questionId: string, optionId: string) => {
    setPreviewAnswers({ ...previewAnswers, [questionId]: optionId });
  };

  const calculateScore = () => {
    if (!previewSurvey) return { correct: 0, total: 0, percentage: 0 };
    let correct = 0;
    previewSurvey.questions.forEach(q => {
      const selectedOption = q.options.find(o => o.id === previewAnswers[q.id]);
      if (selectedOption?.isCorrect) correct++;
    });
    return {
      correct,
      total: previewSurvey.questions.length,
      percentage: Math.round((correct / previewSurvey.questions.length) * 100),
    };
  };

  const generateCertificate = async (volunteerName: string) => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    try {
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

      // Load logos image
      const logoResponse = await fetch('/images/certificate-logos.png');
      const logoBlob = await logoResponse.blob();
      const logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });
      
      // Add logos centered at top (adjust dimensions as needed)
      const logoWidth = 80;
      const logoHeight = 20;
      doc.addImage(logoBase64, 'PNG', (pageWidth - logoWidth) / 2, 15, logoWidth, logoHeight);

      // Add volunteer name in the middle (on the name line area)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(28);
      doc.setTextColor(255, 255, 255); // White text for dark background
      doc.text(volunteerName || 'Volunteer Name', pageWidth / 2, 100, { align: 'center' });

      // Save the PDF
      doc.save(`certificate-of-attendance-${volunteerName.replace(/\s+/g, '-').toLowerCase() || 'volunteer'}.pdf`);
      
      toast({
        title: 'Certificate Downloaded',
        description: 'Your certificate has been generated and downloaded.',
      });
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate certificate. Please try again.',
        variant: 'destructive',
      });
    }
  };

  // Survey List View
  if (!isEditing) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border sticky top-0 z-10">
          <div className="container max-w-6xl py-3 md:py-4 px-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <h1 className="font-display font-bold text-lg md:text-xl">Survey Management</h1>
                <p className="text-sm text-muted-foreground">Create and manage volunteer surveys</p>
              </div>
              <Button onClick={createNewSurvey}>
                <Plus className="h-4 w-4 mr-2" />
                Create Survey
              </Button>
            </div>
          </div>
        </header>

        <main className="container max-w-6xl py-6 px-4">
          {surveys.length === 0 ? (
            <Card className="p-12 text-center">
              <FileQuestion className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-display font-semibold text-lg mb-2">No Surveys Yet</h3>
              <p className="text-muted-foreground mb-4">Create your first survey to test volunteer knowledge</p>
              <Button onClick={createNewSurvey}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Survey
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {surveys.map((survey, index) => (
                <motion.div
                  key={survey.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{survey.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {survey.description || 'No description'}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => openPreview(survey)}>
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => editSurvey(survey)}>
                            <Edit2 className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteSurvey(survey.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileQuestion className="h-4 w-4" />
                          {survey.questions.length} questions
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </main>

        {/* Preview Modal */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="font-display">{previewSurvey?.title}</DialogTitle>
              <DialogDescription>{previewSurvey?.description}</DialogDescription>
            </DialogHeader>

            {previewSurvey && !showResults && (
              <div className="flex-1 overflow-y-auto py-4">
                <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span>Question {previewIndex + 1} of {previewSurvey.questions.length}</span>
                  <span className="font-medium text-foreground">
                    {Object.keys(previewAnswers).length} answered
                  </span>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={previewIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <h3 className="font-semibold text-lg">
                      {previewSurvey.questions[previewIndex].question}
                    </h3>
                    <div className="space-y-2">
                      {previewSurvey.questions[previewIndex].options.map((option, idx) => {
                        const currentQuestionId = previewSurvey.questions[previewIndex].id;
                        const hasAnswered = previewAnswers[currentQuestionId] !== undefined;
                        const isSelected = previewAnswers[currentQuestionId] === option.id;
                        const isCorrect = option.isCorrect;
                        
                        let borderClass = 'border-border hover:border-primary/50';
                        if (hasAnswered) {
                          if (isCorrect) {
                            borderClass = 'border-success bg-success/10';
                          } else if (isSelected) {
                            borderClass = 'border-destructive bg-destructive/10';
                          } else {
                            borderClass = 'border-border opacity-50';
                          }
                        } else if (isSelected) {
                          borderClass = 'border-primary bg-primary-soft';
                        }
                        
                        return (
                          <button
                            key={option.id}
                            onClick={() => !hasAnswered && handlePreviewAnswer(currentQuestionId, option.id)}
                            disabled={hasAnswered}
                            className={`w-full p-4 rounded-lg border-2 text-left transition-all ${borderClass} ${hasAnswered ? 'cursor-default' : 'cursor-pointer'}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                                {option.text}
                              </div>
                              {hasAnswered && isCorrect && (
                                <Check className="w-5 h-5 text-success" />
                              )}
                              {hasAnswered && isSelected && !isCorrect && (
                                <X className="w-5 h-5 text-destructive" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </AnimatePresence>

                <div className="flex justify-between mt-6 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                    disabled={previewIndex === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  {previewIndex === previewSurvey.questions.length - 1 ? (
                    <Button
                      onClick={() => setShowResults(true)}
                      disabled={Object.keys(previewAnswers).length < previewSurvey.questions.length}
                    >
                      Submit Survey
                    </Button>
                  ) : (
                    <Button onClick={() => setPreviewIndex(previewIndex + 1)}>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {showResults && previewSurvey && (
              <div className="flex-1 overflow-y-auto py-4 text-center">
                <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center bg-success/10">
                  <Award className="w-12 h-12 text-success" />
                </div>
                <h3 className="font-display font-bold text-2xl mb-2">Survey Complete!</h3>
                <p className="text-muted-foreground mb-6">
                  Enter your name to download your certificate.
                </p>

                <div className="max-w-sm mx-auto mb-6">
                  <Label htmlFor="volunteerName" className="block text-left mb-2">Your Full Name</Label>
                  <Input
                    id="volunteerName"
                    value={volunteerName}
                    onChange={(e) => setVolunteerName(e.target.value)}
                    placeholder="Enter your full name"
                    className="text-center"
                  />
                </div>

                <div className="flex gap-3 justify-center flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowResults(false);
                      setPreviewIndex(0);
                      setPreviewAnswers({});
                      setVolunteerName('');
                    }}
                  >
                    Retake Survey
                  </Button>
                  <Button 
                    onClick={() => generateCertificate(volunteerName)}
                    disabled={!volunteerName.trim()}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Certificate
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Survey Editor View
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-4xl py-3 md:py-4 px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="font-display font-bold text-lg md:text-xl">
                {editingSurvey?.id && surveys.find(q => q.id === editingSurvey.id) ? 'Edit Survey' : 'Create New Survey'}
              </h1>
            </div>
            <Button onClick={saveSurvey}>
              <Save className="h-4 w-4 mr-2" />
              Save Survey
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl py-6 px-4">
        {editingSurvey && (
          <div className="space-y-6">
            {/* Survey Details */}
            <Card>
              <CardHeader>
                <CardTitle>Survey Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Survey Title</Label>
                  <Input
                    value={editingSurvey.title}
                    onChange={(e) => setEditingSurvey({ ...editingSurvey, title: e.target.value })}
                    placeholder="Enter survey title..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editingSurvey.description}
                    onChange={(e) => setEditingSurvey({ ...editingSurvey, description: e.target.value })}
                    placeholder="Enter survey description..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Questions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-lg">Questions ({editingSurvey.questions.length})</h2>
                <Button variant="outline" onClick={addQuestion}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </div>

              {editingSurvey.questions.length === 0 ? (
                <Card className="p-8 text-center">
                  <FileQuestion className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No questions yet. Click "Add Question" to get started.</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {editingSurvey.questions.map((question, qIndex) => (
                    <motion.div
                      key={question.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded bg-muted cursor-grab">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 space-y-2">
                              <Label>Question {qIndex + 1}</Label>
                              <Textarea
                                value={question.question}
                                onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                                placeholder="Enter your question..."
                                rows={2}
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => deleteQuestion(question.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Label className="mb-3 block">Answer Options (click to mark correct)</Label>
                          <div className="space-y-2">
                            {question.options.map((option, oIndex) => (
                              <div key={option.id} className="flex items-center gap-2">
                                <button
                                  onClick={() => setCorrectAnswer(question.id, option.id)}
                                  className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                                    option.isCorrect
                                      ? 'border-success bg-success text-success-foreground'
                                      : 'border-border hover:border-primary/50'
                                  }`}
                                >
                                  {option.isCorrect ? (
                                    <Check className="h-4 w-4" />
                                  ) : (
                                    <span className="text-sm font-medium text-muted-foreground">
                                      {String.fromCharCode(65 + oIndex)}
                                    </span>
                                  )}
                                </button>
                                <Input
                                  value={option.text}
                                  onChange={(e) => updateOption(question.id, option.id, { text: e.target.value })}
                                  placeholder={`Option ${String.fromCharCode(65 + oIndex)}...`}
                                  className="flex-1"
                                />
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
