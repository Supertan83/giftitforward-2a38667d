import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Plus, Pencil, Copy, Trash2, Eye, Search, FileText,
  ChevronUp, ChevronDown, X, Save, ToggleLeft, ToggleRight, Upload, Link
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RichTextToolbar } from '@/components/admin/RichTextToolbar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { useEmailTemplates, useEmailTemplateMutations, type EmailTemplate, type EmailTemplateInput, type BodySection } from '@/hooks/useEmailTemplates';
import { format } from 'date-fns';

interface EmailTemplateCenterProps {
  onBack: () => void;
}

const CATEGORIES = [
  { value: 'welcome', label: 'Welcome' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'rejection', label: 'Rejection' },
  { value: 'approval', label: 'Approval' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'custom', label: 'Custom' },
];

const CATEGORY_COLORS: Record<string, string> = {
  welcome: 'bg-emerald-100 text-emerald-800',
  reminder: 'bg-amber-100 text-amber-800',
  rejection: 'bg-red-100 text-red-800',
  approval: 'bg-blue-100 text-blue-800',
  followup: 'bg-purple-100 text-purple-800',
  custom: 'bg-gray-100 text-gray-800',
};

const DYNAMIC_TOKENS = [
  { token: '{{first_name}}', label: 'First Name' },
  { token: '{{last_name}}', label: 'Last Name' },
  { token: '{{full_name}}', label: 'Full Name' },
  { token: '{{email}}', label: 'Email' },
  { token: '{{password}}', label: 'Password' },
  { token: '{{phone}}', label: 'Phone' },
  { token: '{{marketplace_name}}', label: 'Event Name' },
  { token: '{{marketplace_date}}', label: 'Event Date' },
  { token: '{{marketplace_time}}', label: 'Event Time' },
  { token: '{{marketplace_location}}', label: 'Event Location' },
  { token: '{{qr_card_id}}', label: 'QR Card ID' },
  { token: '{{login_url}}', label: 'Login URL' },
  { token: '{{training_url}}', label: 'Training URL' },
  { token: '{{current_date}}', label: "Today's Date" },
];

const EMPTY_TEMPLATE: EmailTemplateInput = {
  name: '',
  category: 'custom',
  subject: '',
  greeting: 'Dear {{first_name}},',
  body_sections: [{ type: 'paragraph', content: '' }],
  cta_text: null,
  cta_url: null,
  is_active: true,
};

export const EmailTemplateCenter = ({ onBack }: EmailTemplateCenterProps) => {
  const [editingTemplate, setEditingTemplate] = useState<(EmailTemplateInput & { id?: string }) | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<EmailTemplate | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFieldRef, setActiveFieldRef] = useState<string | null>(null);

  const fieldRefs = useRef<Record<string, HTMLTextAreaElement | HTMLInputElement | null>>({});

  const { data: templates = [], isLoading } = useEmailTemplates();
  const { createTemplate, updateTemplate, deleteTemplate, duplicateTemplate } = useEmailTemplateMutations();
  const { toast } = useToast();
  const [uploadingImage, setUploadingImage] = useState<number | null>(null);

  const filteredTemplates = templates.filter(t => {
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) && !t.subject.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const insertToken = useCallback((token: string) => {
    if (!activeFieldRef || !editingTemplate) return;
    const el = fieldRefs.current[activeFieldRef];
    if (!el) return;

    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const before = el.value.substring(0, start);
    const after = el.value.substring(end);
    const newValue = before + token + after;

    if (activeFieldRef === 'subject') {
      setEditingTemplate({ ...editingTemplate, subject: newValue });
    } else if (activeFieldRef === 'greeting') {
      setEditingTemplate({ ...editingTemplate, greeting: newValue });
    } else if (activeFieldRef.startsWith('section-')) {
      const idx = parseInt(activeFieldRef.split('-')[1]);
      const sections = [...editingTemplate.body_sections];
      sections[idx] = { ...sections[idx], content: newValue };
      setEditingTemplate({ ...editingTemplate, body_sections: sections });
    } else if (activeFieldRef === 'cta_text') {
      setEditingTemplate({ ...editingTemplate, cta_text: newValue });
    } else if (activeFieldRef === 'cta_url') {
      setEditingTemplate({ ...editingTemplate, cta_url: newValue });
    }

    setTimeout(() => {
      if (el) {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      }
    }, 0);
  }, [activeFieldRef, editingTemplate]);

  const handleSave = async () => {
    if (!editingTemplate) return;
    if (!editingTemplate.name.trim() || !editingTemplate.subject.trim()) return;

    if (editingTemplate.id) {
      await updateTemplate.mutateAsync({ ...editingTemplate, id: editingTemplate.id } as EmailTemplateInput & { id: string });
    } else {
      await createTemplate.mutateAsync(editingTemplate);
    }
    setEditingTemplate(null);
  };

  const addSection = (type: BodySection['type']) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      body_sections: [...editingTemplate.body_sections, { type, content: '' }],
    });
  };

  const removeSection = (idx: number) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      body_sections: editingTemplate.body_sections.filter((_, i) => i !== idx),
    });
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    if (!editingTemplate) return;
    const sections = [...editingTemplate.body_sections];
    const target = idx + dir;
    if (target < 0 || target >= sections.length) return;
    [sections[idx], sections[target]] = [sections[target], sections[idx]];
    setEditingTemplate({ ...editingTemplate, body_sections: sections });
  };

  const updateSection = (idx: number, content: string) => {
    if (!editingTemplate) return;
    const sections = [...editingTemplate.body_sections];
    sections[idx] = { ...sections[idx], content };
    setEditingTemplate({ ...editingTemplate, body_sections: sections });
  };

  const updateSectionUrl = (idx: number, url: string) => {
    if (!editingTemplate) return;
    const sections = [...editingTemplate.body_sections];
    sections[idx] = { ...sections[idx], url: url || undefined };
    setEditingTemplate({ ...editingTemplate, body_sections: sections });
  };

  const handleImageUpload = async (idx: number, file: File) => {
    setUploadingImage(idx);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `template-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('email-assets')
        .upload(fileName, file, { upsert: true });
      if (error) throw error;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/email-assets/${fileName}`;
      updateSection(idx, url);
      toast({ title: 'Image Uploaded', description: 'Image added to template' });
    } catch (err: any) {
      toast({ title: 'Upload Failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingImage(null);
    }
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const heroImageUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/gif-hero-banner.jpg`;
  const dubaiHoldingLogoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/dubai-holding-logo.png`;

  const renderBrandedPreview = (tpl: EmailTemplateInput) => (
    <div className="bg-white rounded-lg overflow-hidden shadow-sm border max-w-[600px] mx-auto text-left" style={{ fontFamily: "'Rubik', Arial, sans-serif" }}>
      <img src={heroImageUrl} alt="Gift It Forward" className="w-full h-auto" />
      <div className="text-center py-3">
        <p className="text-[10px] tracking-[3px] uppercase" style={{ color: '#B8860B' }}>EXECUTION PARTNER</p>
      </div>
      <div className="text-center px-6 pb-3">
        <h1 className="text-lg font-bold" style={{ color: '#101820' }}>{tpl.subject || 'Email Subject'}</h1>
      </div>
      <div className="px-6 py-4 space-y-3 text-sm" style={{ color: '#333' }}>
        {tpl.greeting && <p>{highlightTokens(tpl.greeting)}</p>}
        {tpl.body_sections.map((sec, i) => (
          <div key={i}>
            {sec.type === 'paragraph' && <p dangerouslySetInnerHTML={{ __html: highlightTokensHtml(sec.content || '...') }} />}
            {sec.type === 'list' && (
              <ul className="list-disc pl-5 space-y-1">
                {(sec.content || '').split('\n').filter(Boolean).map((li, j) => (
                  <li key={j} dangerouslySetInnerHTML={{ __html: highlightTokensHtml(li) }} />
                ))}
              </ul>
            )}
            {sec.type === 'image' && sec.content && (
              <img src={sec.content} alt="" className="w-full h-auto rounded" />
            )}
            {sec.type === 'cta' && (
              <div className="text-center py-2">
                <a href={sec.url || '#'} className="inline-block px-6 py-2.5 rounded font-semibold text-white text-sm no-underline" style={{ backgroundColor: '#DA291C' }}>
                  {highlightTokens(sec.content || 'Click Here')}
                </a>
              </div>
            )}
          </div>
        ))}
        {tpl.cta_text && (
          <div className="text-center py-3">
            <a href={tpl.cta_url || '#'} className="inline-block px-6 py-2.5 rounded font-semibold text-white text-sm no-underline" style={{ backgroundColor: '#DA291C' }}>
              {highlightTokens(tpl.cta_text)}
            </a>
          </div>
        )}
      </div>
      <div className="flex justify-between items-center px-6 py-4 border-t">
        <img src={dubaiHoldingLogoUrl} alt="Dubai Holding" className="h-5" />
        <p className="text-[10px] italic" style={{ color: '#999' }}>For the Good of Tomorrow</p>
      </div>
    </div>
  );

  const highlightTokens = (text: string) => {
    const parts = text.split(/(\{\{[^}]+\}\})/g);
    return parts.map((part, i) =>
      part.match(/^\{\{.+\}\}$/) ? (
        <span key={i} className="bg-amber-100 text-amber-800 px-1 rounded text-xs font-mono">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const highlightTokensHtml = (text: string) => {
    return text.replace(
      /(\{\{[^}]+\}\})/g,
      '<span style="background:#fef3c7;color:#92400e;padding:0 4px;border-radius:3px;font-size:11px;font-family:monospace">$1</span>'
    );
  };

  // Editor view
  if (editingTemplate) {
    return (
      <div className="py-4 px-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon" onClick={() => setEditingTemplate(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="font-display font-bold text-lg">{editingTemplate.id ? 'Edit Template' : 'New Template'}</h2>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createTemplate.isPending || updateTemplate.isPending}>
              <Save className="h-4 w-4 mr-1" /> Save
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Editor */}
          <div className="space-y-4">
            {/* Token Palette */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Dynamic Tokens <span className="text-muted-foreground font-normal">(click to insert at cursor)</span></CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="flex flex-wrap gap-1.5">
                  {DYNAMIC_TOKENS.map(t => (
                    <button
                      key={t.token}
                      onClick={() => insertToken(t.token)}
                      className="text-xs px-2 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors font-mono"
                      title={t.label}
                    >
                      {t.token}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Basic Info */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Template Name</Label>
                    <Input
                      value={editingTemplate.name}
                      onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                      placeholder="e.g. Marketplace Reminder"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Select value={editingTemplate.category} onValueChange={v => setEditingTemplate({ ...editingTemplate, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Subject Line</Label>
                  <Input
                    ref={el => { fieldRefs.current['subject'] = el; }}
                    value={editingTemplate.subject}
                    onChange={e => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                    onFocus={() => setActiveFieldRef('subject')}
                    placeholder="e.g. Reminder: {{marketplace_name}} is coming up!"
                  />
                </div>
                <div>
                  <Label className="text-xs">Greeting</Label>
                  <Input
                    ref={el => { fieldRefs.current['greeting'] = el; }}
                    value={editingTemplate.greeting}
                    onChange={e => setEditingTemplate({ ...editingTemplate, greeting: e.target.value })}
                    onFocus={() => setActiveFieldRef('greeting')}
                    placeholder="Dear {{first_name}},"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Body Sections */}
            <Card>
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Body Sections</CardTitle>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => addSection('paragraph')} className="text-xs h-7">+ Paragraph</Button>
                    <Button size="sm" variant="outline" onClick={() => addSection('list')} className="text-xs h-7">+ List</Button>
                    <Button size="sm" variant="outline" onClick={() => addSection('cta')} className="text-xs h-7">+ CTA</Button>
                    <Button size="sm" variant="outline" onClick={() => addSection('image')} className="text-xs h-7">+ Image</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-3">
                {editingTemplate.body_sections.map((sec, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs capitalize">{sec.type}</Badge>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveSection(idx, -1)} disabled={idx === 0}>
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveSection(idx, 1)} disabled={idx === editingTemplate.body_sections.length - 1}>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeSection(idx)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {sec.type === 'image' ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            ref={el => { fieldRefs.current[`section-${idx}`] = el; }}
                            value={sec.content}
                            onChange={e => updateSection(idx, e.target.value)}
                            onFocus={() => setActiveFieldRef(`section-${idx}`)}
                            placeholder="Image URL"
                            className="flex-1"
                          />
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(idx, file);
                              }}
                            />
                            <Button type="button" size="sm" variant="outline" className="h-10" asChild>
                              <span>
                                <Upload className="h-3.5 w-3.5 mr-1" />
                                {uploadingImage === idx ? 'Uploading...' : 'Upload'}
                              </span>
                            </Button>
                          </label>
                        </div>
                        {sec.content && (
                          <img src={sec.content} alt="Preview" className="w-full h-auto rounded border max-h-40 object-contain" />
                        )}
                      </div>
                    ) : sec.type === 'cta' ? (
                      <div className="space-y-2">
                        <Input
                          ref={el => { fieldRefs.current[`section-${idx}`] = el; }}
                          value={sec.content}
                          onChange={e => updateSection(idx, e.target.value)}
                          onFocus={() => setActiveFieldRef(`section-${idx}`)}
                          placeholder="Button text"
                        />
                        <div className="flex items-center gap-2">
                          <Link className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <Input
                            value={sec.url || ''}
                            onChange={e => updateSectionUrl(idx, e.target.value)}
                            placeholder="Button URL (e.g. {{login_url}} or https://...)"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <RichTextToolbar
                          textareaRef={fieldRefs.current[`section-${idx}`] as HTMLTextAreaElement | null}
                          value={sec.content}
                          onChange={v => updateSection(idx, v)}
                        />
                        <Textarea
                          ref={el => { fieldRefs.current[`section-${idx}`] = el; }}
                          value={sec.content}
                          onChange={e => updateSection(idx, e.target.value)}
                          onFocus={() => setActiveFieldRef(`section-${idx}`)}
                          placeholder={sec.type === 'list' ? 'One item per line' : 'Paragraph text... Use toolbar for bold, italic, etc.'}
                          rows={sec.type === 'list' ? 4 : 3}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* CTA Button */}
            <Card>
              <CardContent className="pt-4 space-y-3">
                <Label className="text-xs font-semibold">Call-to-Action Button (optional)</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Button Text</Label>
                    <Input
                      ref={el => { fieldRefs.current['cta_text'] = el; }}
                      value={editingTemplate.cta_text || ''}
                      onChange={e => setEditingTemplate({ ...editingTemplate, cta_text: e.target.value || null })}
                      onFocus={() => setActiveFieldRef('cta_text')}
                      placeholder="e.g. View Schedule"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Button URL</Label>
                    <Input
                      ref={el => { fieldRefs.current['cta_url'] = el; }}
                      value={editingTemplate.cta_url || ''}
                      onChange={e => setEditingTemplate({ ...editingTemplate, cta_url: e.target.value || null })}
                      onFocus={() => setActiveFieldRef('cta_url')}
                      placeholder="e.g. {{login_url}}"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Live Preview */}
          <div className="space-y-3">
            <h3 className="font-display font-semibold text-sm text-muted-foreground">Live Preview</h3>
            <div className="sticky top-4">
              {renderBrandedPreview(editingTemplate)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="py-4 px-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="font-display font-bold text-xl">Email Templates</h2>
          <p className="text-sm text-muted-foreground">Create and manage branded email templates</p>
        </div>
        <div className="ml-auto">
          <Button onClick={() => setEditingTemplate({ ...EMPTY_TEMPLATE })}>
            <Plus className="h-4 w-4 mr-1" /> New Template
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading templates...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No templates yet. Create your first one!</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTemplates.map(tpl => (
                <TableRow key={tpl.id}>
                  <TableCell className="font-medium">{tpl.name}</TableCell>
                  <TableCell>
                    <Badge className={`${CATEGORY_COLORS[tpl.category] || CATEGORY_COLORS.custom} capitalize text-xs`}>
                      {tpl.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{tpl.subject}</TableCell>
                  <TableCell>
                    {tpl.is_active ? (
                      <Badge className="bg-emerald-100 text-emerald-800 text-xs">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {format(new Date(tpl.updated_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setPreviewTemplate(tpl)} title="Preview">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingTemplate(tpl)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => duplicateTemplate.mutate(tpl)} title="Duplicate">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(tpl)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview: {previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          {previewTemplate && renderBrandedPreview(previewTemplate)}
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteConfirm?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => { if (deleteConfirm) { deleteTemplate.mutate(deleteConfirm.id); setDeleteConfirm(null); } }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
