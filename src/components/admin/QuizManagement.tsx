import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  CheckCircle2,
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

interface Quiz {
  id: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  passingScore: number;
  createdAt: Date;
}

// Sample quiz data based on the uploaded PDF
const sampleQuiz: Quiz = {
  id: '1',
  title: 'Volunteer Knowledge Check: Your Role in the Circular Economy',
  description: 'Test your understanding of circular economy principles and the Gift It Forward program.',
  passingScore: 70,
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

interface QuizManagementProps {
  onBack: () => void;
}

export const QuizManagement = ({ onBack }: QuizManagementProps) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([sampleQuiz]);
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewQuiz, setPreviewQuiz] = useState<Quiz | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const { toast } = useToast();

  const createNewQuiz = () => {
    const newQuiz: Quiz = {
      id: crypto.randomUUID(),
      title: '',
      description: '',
      questions: [],
      passingScore: 70,
      createdAt: new Date(),
    };
    setEditingQuiz(newQuiz);
    setIsEditing(true);
  };

  const editQuiz = (quiz: Quiz) => {
    setEditingQuiz({ ...quiz, questions: quiz.questions.map(q => ({ ...q, options: [...q.options] })) });
    setIsEditing(true);
  };

  const addQuestion = () => {
    if (!editingQuiz) return;
    const newQuestion: QuizQuestion = {
      id: crypto.randomUUID(),
      question: '',
      options: [
        { id: crypto.randomUUID(), text: '', isCorrect: false },
        { id: crypto.randomUUID(), text: '', isCorrect: false },
        { id: crypto.randomUUID(), text: '', isCorrect: false },
        { id: crypto.randomUUID(), text: '', isCorrect: false },
      ],
    };
    setEditingQuiz({
      ...editingQuiz,
      questions: [...editingQuiz.questions, newQuestion],
    });
  };

  const updateQuestion = (questionId: string, updates: Partial<QuizQuestion>) => {
    if (!editingQuiz) return;
    setEditingQuiz({
      ...editingQuiz,
      questions: editingQuiz.questions.map(q =>
        q.id === questionId ? { ...q, ...updates } : q
      ),
    });
  };

  const updateOption = (questionId: string, optionId: string, updates: Partial<QuizOption>) => {
    if (!editingQuiz) return;
    setEditingQuiz({
      ...editingQuiz,
      questions: editingQuiz.questions.map(q =>
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
    if (!editingQuiz) return;
    setEditingQuiz({
      ...editingQuiz,
      questions: editingQuiz.questions.map(q =>
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
    if (!editingQuiz) return;
    setEditingQuiz({
      ...editingQuiz,
      questions: editingQuiz.questions.filter(q => q.id !== questionId),
    });
  };

  const saveQuiz = () => {
    if (!editingQuiz) return;
    
    if (!editingQuiz.title.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a quiz title',
        variant: 'destructive',
      });
      return;
    }

    if (editingQuiz.questions.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please add at least one question',
        variant: 'destructive',
      });
      return;
    }

    for (const q of editingQuiz.questions) {
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

    const existingIndex = quizzes.findIndex(q => q.id === editingQuiz.id);
    if (existingIndex >= 0) {
      setQuizzes(quizzes.map(q => q.id === editingQuiz.id ? editingQuiz : q));
    } else {
      setQuizzes([...quizzes, editingQuiz]);
    }

    setEditingQuiz(null);
    setIsEditing(false);
    toast({
      title: 'Quiz Saved',
      description: 'Your quiz has been saved successfully',
    });
  };

  const deleteQuiz = (quizId: string) => {
    setQuizzes(quizzes.filter(q => q.id !== quizId));
    toast({
      title: 'Quiz Deleted',
      description: 'The quiz has been removed',
    });
  };

  const openPreview = (quiz: Quiz) => {
    setPreviewQuiz(quiz);
    setPreviewIndex(0);
    setPreviewAnswers({});
    setShowResults(false);
    setShowPreview(true);
  };

  const handlePreviewAnswer = (questionId: string, optionId: string) => {
    setPreviewAnswers({ ...previewAnswers, [questionId]: optionId });
  };

  const calculateScore = () => {
    if (!previewQuiz) return { correct: 0, total: 0, percentage: 0 };
    let correct = 0;
    previewQuiz.questions.forEach(q => {
      const selectedOption = q.options.find(o => o.id === previewAnswers[q.id]);
      if (selectedOption?.isCorrect) correct++;
    });
    return {
      correct,
      total: previewQuiz.questions.length,
      percentage: Math.round((correct / previewQuiz.questions.length) * 100),
    };
  };

  // Quiz List View
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
                <h1 className="font-display font-bold text-lg md:text-xl">Quiz Management</h1>
                <p className="text-sm text-muted-foreground">Create and manage volunteer quizzes</p>
              </div>
              <Button onClick={createNewQuiz}>
                <Plus className="h-4 w-4 mr-2" />
                Create Quiz
              </Button>
            </div>
          </div>
        </header>

        <main className="container max-w-6xl py-6 px-4">
          {quizzes.length === 0 ? (
            <Card className="p-12 text-center">
              <FileQuestion className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="font-display font-semibold text-lg mb-2">No Quizzes Yet</h3>
              <p className="text-muted-foreground mb-4">Create your first quiz to test volunteer knowledge</p>
              <Button onClick={createNewQuiz}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Quiz
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {quizzes.map((quiz, index) => (
                <motion.div
                  key={quiz.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{quiz.title}</CardTitle>
                          <CardDescription className="mt-1">
                            {quiz.description || 'No description'}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => openPreview(quiz)}>
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => editQuiz(quiz)}>
                            <Edit2 className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-destructive hover:text-destructive"
                            onClick={() => deleteQuiz(quiz.id)}
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
                          {quiz.questions.length} questions
                        </span>
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          {quiz.passingScore}% passing score
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
              <DialogTitle className="font-display">{previewQuiz?.title}</DialogTitle>
              <DialogDescription>{previewQuiz?.description}</DialogDescription>
            </DialogHeader>

            {previewQuiz && !showResults && (
              <div className="flex-1 overflow-y-auto py-4">
                <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
                  <span>Question {previewIndex + 1} of {previewQuiz.questions.length}</span>
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
                      {previewQuiz.questions[previewIndex].question}
                    </h3>
                    <div className="space-y-2">
                      {previewQuiz.questions[previewIndex].options.map((option, idx) => (
                        <button
                          key={option.id}
                          onClick={() => handlePreviewAnswer(previewQuiz.questions[previewIndex].id, option.id)}
                          className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                            previewAnswers[previewQuiz.questions[previewIndex].id] === option.id
                              ? 'border-primary bg-primary-soft'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>
                          {option.text}
                        </button>
                      ))}
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
                  {previewIndex === previewQuiz.questions.length - 1 ? (
                    <Button
                      onClick={() => setShowResults(true)}
                      disabled={Object.keys(previewAnswers).length < previewQuiz.questions.length}
                    >
                      Submit Quiz
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

            {showResults && previewQuiz && (
              <div className="flex-1 overflow-y-auto py-4 text-center">
                <div className={`w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center ${
                  calculateScore().percentage >= previewQuiz.passingScore
                    ? 'bg-success/10'
                    : 'bg-destructive/10'
                }`}>
                  {calculateScore().percentage >= previewQuiz.passingScore ? (
                    <Check className="w-12 h-12 text-success" />
                  ) : (
                    <X className="w-12 h-12 text-destructive" />
                  )}
                </div>
                <h3 className="font-display font-bold text-2xl mb-2">
                  {calculateScore().percentage >= previewQuiz.passingScore ? 'Congratulations!' : 'Keep Learning!'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  You scored {calculateScore().correct} out of {calculateScore().total} ({calculateScore().percentage}%)
                </p>
                <p className="text-sm text-muted-foreground mb-6">
                  Passing score: {previewQuiz.passingScore}%
                </p>

                <div className="space-y-3 text-left">
                  {previewQuiz.questions.map((q, idx) => {
                    const selectedOption = q.options.find(o => o.id === previewAnswers[q.id]);
                    const correctOption = q.options.find(o => o.isCorrect);
                    const isCorrect = selectedOption?.isCorrect;

                    return (
                      <div
                        key={q.id}
                        className={`p-3 rounded-lg border ${
                          isCorrect ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {isCorrect ? (
                            <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                          ) : (
                            <X className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                          )}
                          <div>
                            <p className="font-medium text-sm">Q{idx + 1}: {q.question}</p>
                            {!isCorrect && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Correct answer: {correctOption?.text}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Button
                  className="mt-6"
                  onClick={() => {
                    setShowResults(false);
                    setPreviewIndex(0);
                    setPreviewAnswers({});
                  }}
                >
                  Retake Quiz
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Quiz Editor View
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
                {editingQuiz?.id && quizzes.find(q => q.id === editingQuiz.id) ? 'Edit Quiz' : 'Create New Quiz'}
              </h1>
            </div>
            <Button onClick={saveQuiz}>
              <Save className="h-4 w-4 mr-2" />
              Save Quiz
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl py-6 px-4">
        {editingQuiz && (
          <div className="space-y-6">
            {/* Quiz Details */}
            <Card>
              <CardHeader>
                <CardTitle>Quiz Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Quiz Title</Label>
                  <Input
                    value={editingQuiz.title}
                    onChange={(e) => setEditingQuiz({ ...editingQuiz, title: e.target.value })}
                    placeholder="Enter quiz title..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={editingQuiz.description}
                    onChange={(e) => setEditingQuiz({ ...editingQuiz, description: e.target.value })}
                    placeholder="Enter quiz description..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Passing Score (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={editingQuiz.passingScore}
                    onChange={(e) => setEditingQuiz({ ...editingQuiz, passingScore: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Questions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display font-semibold text-lg">Questions ({editingQuiz.questions.length})</h2>
                <Button variant="outline" onClick={addQuestion}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Question
                </Button>
              </div>

              {editingQuiz.questions.length === 0 ? (
                <Card className="p-8 text-center">
                  <FileQuestion className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No questions yet. Click "Add Question" to get started.</p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {editingQuiz.questions.map((question, qIndex) => (
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
