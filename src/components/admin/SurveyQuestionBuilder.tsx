import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft, Plus, ArrowUp, ArrowDown, Trash2, Edit2, Save, X,
  GripVertical, Eye, EyeOff, Loader2, FileQuestion,
} from 'lucide-react';

interface SurveyQuestion {
  id: string;
  question_text: string;
  question_type: string;
  options: string[];
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

const QUESTION_TYPES = [
  { value: 'short_text', label: 'Short Text' },
  { value: 'long_text', label: 'Long Text' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'rating', label: 'Rating Scale (1-5)' },
];

const typeLabel = (type: string) => QUESTION_TYPES.find(t => t.value === type)?.label ?? type;

export const SurveyQuestionBuilder = ({ onBack }: { onBack: () => void }) => {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<SurveyQuestion | null>(null);

  // New question form
  const [showAdd, setShowAdd] = useState(false);
  const [newText, setNewText] = useState('');
  const [newType, setNewType] = useState('short_text');
  const [newRequired, setNewRequired] = useState(true);
  const [newOptions, setNewOptions] = useState<string[]>(['']);

  // Edit form
  const [editText, setEditText] = useState('');
  const [editType, setEditType] = useState('short_text');
  const [editRequired, setEditRequired] = useState(true);
  const [editActive, setEditActive] = useState(true);
  const [editOptions, setEditOptions] = useState<string[]>([]);

  const fetchQuestions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('survey_questions')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) {
      toast({ title: 'Failed to load questions', variant: 'destructive' });
    } else {
      setQuestions((data || []).map(q => ({ ...q, options: Array.isArray(q.options) ? q.options as string[] : [] })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchQuestions(); }, []);

  const handleAdd = async () => {
    if (!newText.trim()) {
      toast({ title: 'Question text is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const maxOrder = questions.length > 0 ? Math.max(...questions.map(q => q.sort_order)) : 0;
    const opts = newType === 'multiple_choice' ? newOptions.filter(o => o.trim()) : [];
    if (newType === 'multiple_choice' && opts.length < 2) {
      toast({ title: 'Multiple choice needs at least 2 options', variant: 'destructive' });
      setSaving(false);
      return;
    }
    const { error } = await supabase.from('survey_questions').insert({
      question_text: newText.trim(),
      question_type: newType,
      options: opts,
      is_required: newRequired,
      sort_order: maxOrder + 1,
    });
    if (error) {
      toast({ title: 'Failed to add question', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Question added' });
      resetAddForm();
      fetchQuestions();
    }
    setSaving(false);
  };

  const resetAddForm = () => {
    setShowAdd(false);
    setNewText('');
    setNewType('short_text');
    setNewRequired(true);
    setNewOptions(['']);
  };

  const startEdit = (q: SurveyQuestion) => {
    setEditingId(q.id);
    setEditText(q.question_text);
    setEditType(q.question_type);
    setEditRequired(q.is_required);
    setEditActive(q.is_active);
    setEditOptions(q.options.length > 0 ? [...q.options] : ['']);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editText.trim()) return;
    const opts = editType === 'multiple_choice' ? editOptions.filter(o => o.trim()) : [];
    if (editType === 'multiple_choice' && opts.length < 2) {
      toast({ title: 'Multiple choice needs at least 2 options', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('survey_questions').update({
      question_text: editText.trim(),
      question_type: editType,
      options: opts,
      is_required: editRequired,
      is_active: editActive,
    }).eq('id', editingId);
    if (error) {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Question updated' });
      setEditingId(null);
      fetchQuestions();
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await supabase.from('survey_questions').delete().eq('id', deleteConfirm.id);
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Question deleted' });
      fetchQuestions();
    }
    setDeleteConfirm(null);
  };

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    const idx = questions.findIndex(q => q.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= questions.length) return;

    const a = questions[idx];
    const b = questions[swapIdx];

    await Promise.all([
      supabase.from('survey_questions').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('survey_questions').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    fetchQuestions();
  };

  const renderOptionsEditor = (options: string[], setOptions: (o: string[]) => void) => (
    <div className="space-y-2 mt-2">
      <Label className="text-xs text-muted-foreground">Answer Options</Label>
      {options.map((opt, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={opt}
            onChange={(e) => {
              const copy = [...options];
              copy[i] = e.target.value;
              setOptions(copy);
            }}
            placeholder={`Option ${i + 1}`}
            className="flex-1"
            maxLength={200}
          />
          {options.length > 1 && (
            <Button variant="ghost" size="icon" onClick={() => setOptions(options.filter((_, j) => j !== i))}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => setOptions([...options, ''])}>
        <Plus className="h-3 w-3 mr-1" /> Add Option
      </Button>
    </div>
  );

  return (
    <div className="py-4 md:py-6 px-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h2 className="font-display font-bold text-xl">Survey Questions</h2>
          <p className="text-sm text-muted-foreground">Manage questions shown on the external volunteer survey</p>
        </div>
      </div>

      {/* Add button */}
      {!showAdd && (
        <Button onClick={() => setShowAdd(true)} className="mb-4">
          <Plus className="h-4 w-4 mr-2" /> Add Question
        </Button>
      )}

      {/* Add form */}
      {showAdd && (
        <Card className="mb-6 border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Question Text *</Label>
              <Input value={newText} onChange={e => setNewText(e.target.value)} placeholder="Enter question..." maxLength={500} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Switch checked={newRequired} onCheckedChange={setNewRequired} id="new-required" />
                <Label htmlFor="new-required">Required</Label>
              </div>
            </div>
            {newType === 'multiple_choice' && renderOptionsEditor(newOptions, setNewOptions)}
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Add
              </Button>
              <Button variant="outline" onClick={resetAddForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Questions list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No questions yet. Add your first question above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, idx) => (
            <Card key={q.id} className={`transition-colors ${!q.is_active ? 'opacity-50' : ''}`}>
              <CardContent className="p-4">
                {editingId === q.id ? (
                  /* Edit mode */
                  <div className="space-y-4">
                    <div>
                      <Label>Question Text *</Label>
                      <Input value={editText} onChange={e => setEditText(e.target.value)} maxLength={500} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Type</Label>
                        <Select value={editType} onValueChange={setEditType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Switch checked={editRequired} onCheckedChange={setEditRequired} id="edit-required" />
                          <Label htmlFor="edit-required">Required</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={editActive} onCheckedChange={setEditActive} id="edit-active" />
                          <Label htmlFor="edit-active">Active</Label>
                        </div>
                      </div>
                    </div>
                    {editType === 'multiple_choice' && renderOptionsEditor(editOptions, setEditOptions)}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleSaveEdit} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1 pt-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleReorder(q.id, 'up')} disabled={idx === 0}>
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleReorder(q.id, 'down')} disabled={idx === questions.length - 1}>
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-muted-foreground">Q{idx + 1}</span>
                        <Badge variant="secondary" className="text-xs">{typeLabel(q.question_type)}</Badge>
                        {q.is_required && <Badge variant="outline" className="text-xs">Required</Badge>}
                        {!q.is_active && <Badge variant="destructive" className="text-xs">Hidden</Badge>}
                      </div>
                      <p className="font-medium text-sm">{q.question_text}</p>
                      {q.question_type === 'multiple_choice' && q.options.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {q.options.map((opt, i) => (
                            <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded">{opt}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(q)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(q)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete: "{deleteConfirm?.question_text}"
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
