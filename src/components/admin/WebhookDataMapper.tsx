import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Loader2, ChevronRight, ChevronDown, Save, Play, Trash2, 
  ArrowRight, Check, AlertCircle, FileJson, Users, RefreshCw
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface WebhookEvent {
  id: string;
  payload: Record<string, unknown>;
  headers: Record<string, string> | null;
  source_ip: string | null;
  received_at: string;
  processed: boolean;
}

interface FieldMapping {
  email: string;
  name: string;
  phone: string;
}

interface MappingTemplate {
  id: string;
  name: string;
  description: string | null;
  source_identifier: string | null;
  field_mappings: FieldMapping;
  array_path: string | null;
  created_at: string;
}

// Recursively extract all paths from an object
function extractPaths(obj: unknown, prefix = ''): string[] {
  const paths: string[] = [];
  
  if (obj === null || obj === undefined) return paths;
  
  if (Array.isArray(obj)) {
    paths.push(prefix);
    if (obj.length > 0 && typeof obj[0] === 'object') {
      const subPaths = extractPaths(obj[0], '[]');
      subPaths.forEach(p => paths.push(prefix + p));
    }
  } else if (typeof obj === 'object') {
    Object.entries(obj as Record<string, unknown>).forEach(([key, value]) => {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      paths.push(newPrefix);
      const subPaths = extractPaths(value, newPrefix);
      paths.push(...subPaths);
    });
  }
  
  return paths;
}

// Get value from object using path like "data.volunteers[].email"
function getValueByPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    
    if (part.endsWith('[]')) {
      const key = part.slice(0, -2);
      current = (current as Record<string, unknown>)[key];
      if (Array.isArray(current) && current.length > 0) {
        current = current[0]; // Get first element for preview
      }
    } else if (part === '[]') {
      if (Array.isArray(current) && current.length > 0) {
        current = current[0];
      }
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  
  return current;
}

// Get array from object using path
function getArrayByPath(obj: unknown, arrayPath: string): unknown[] {
  if (!arrayPath) return [];
  
  const parts = arrayPath.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) return [];
    current = (current as Record<string, unknown>)[part];
  }
  
  return Array.isArray(current) ? current : [];
}

export const WebhookDataMapper = () => {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [arrayPath, setArrayPath] = useState('');
  const [fieldMappings, setFieldMappings] = useState<FieldMapping>({ email: '', name: '', phone: '' });
  const [templateName, setTemplateName] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch unprocessed webhook events
  const { data: events = [], isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ['unprocessed-webhook-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('processed', false)
        .order('received_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as WebhookEvent[];
    },
  });

  // Fetch saved templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['webhook-mapping-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_mapping_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        field_mappings: item.field_mappings as unknown as FieldMapping
      })) as MappingTemplate[];
    },
  });

  const selectedEvent = useMemo(() => {
    return events.find(e => e.id === selectedEventId);
  }, [events, selectedEventId]);

  const detectedPaths = useMemo(() => {
    if (!selectedEvent) return [];
    return extractPaths(selectedEvent.payload).filter(p => !p.endsWith('[]'));
  }, [selectedEvent]);

  const arrayPaths = useMemo(() => {
    return detectedPaths.filter(p => {
      const value = getValueByPath(selectedEvent?.payload, p);
      return Array.isArray(value);
    });
  }, [detectedPaths, selectedEvent]);

  const fieldPaths = useMemo(() => {
    if (!arrayPath || !selectedEvent) return [];
    const arr = getArrayByPath(selectedEvent.payload, arrayPath);
    if (arr.length === 0) return [];
    return Object.keys(arr[0] as Record<string, unknown>);
  }, [arrayPath, selectedEvent]);

  const previewData = useMemo(() => {
    if (!arrayPath || !selectedEvent) return [];
    const arr = getArrayByPath(selectedEvent.payload, arrayPath);
    return arr.slice(0, 3).map(item => ({
      email: fieldMappings.email ? (item as Record<string, unknown>)[fieldMappings.email] : '',
      name: fieldMappings.name ? (item as Record<string, unknown>)[fieldMappings.name] : '',
      phone: fieldMappings.phone ? (item as Record<string, unknown>)[fieldMappings.phone] : '',
    }));
  }, [arrayPath, selectedEvent, fieldMappings]);

  // Process mapped data mutation
  const processDataMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEvent || !arrayPath || !fieldMappings.email) {
        throw new Error('Missing required fields');
      }

      const { data, error } = await supabase.functions.invoke('webhook-receiver', {
        body: {
          action: 'process_mapped_data',
          event_id: selectedEvent.id,
          array_path: arrayPath,
          field_mappings: fieldMappings,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Data Processed',
        description: `Created ${data.results?.created || 0} volunteers, ${data.results?.failed || 0} failed`,
      });
      queryClient.invalidateQueries({ queryKey: ['unprocessed-webhook-events'] });
      queryClient.invalidateQueries({ queryKey: ['webhook-events'] });
      setSelectedEventId(null);
      resetForm();
    },
    onError: (error) => {
      toast({
        title: 'Processing Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Save template mutation
  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!templateName || !arrayPath || !fieldMappings.email) {
        throw new Error('Template name and email mapping are required');
      }

      const { error } = await supabase
        .from('webhook_mapping_templates')
        .insert([{
          name: templateName,
          array_path: arrayPath,
          field_mappings: JSON.parse(JSON.stringify(fieldMappings)),
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Template Saved' });
      queryClient.invalidateQueries({ queryKey: ['webhook-mapping-templates'] });
      setTemplateName('');
    },
    onError: (error) => {
      toast({ title: 'Save Failed', description: error.message, variant: 'destructive' });
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('webhook_mapping_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Template Deleted' });
      queryClient.invalidateQueries({ queryKey: ['webhook-mapping-templates'] });
    },
  });

  const applyTemplate = (template: MappingTemplate) => {
    setArrayPath(template.array_path || '');
    setFieldMappings(template.field_mappings);
    toast({ title: 'Template Applied', description: template.name });
  };

  const resetForm = () => {
    setArrayPath('');
    setFieldMappings({ email: '', name: '', phone: '' });
    setTemplateName('');
  };

  const togglePath = (path: string) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedPaths(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Saved Templates */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-4 md:p-6 shadow-card"
      >
        <h3 className="font-display font-bold text-lg mb-4">Saved Mapping Templates</h3>
        {templatesLoading ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No templates saved yet</p>
        ) : (
          <div className="grid gap-3">
            {templates.map(template => (
              <div key={template.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">{template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Array: {template.array_path} → email: {template.field_mappings.email}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => applyTemplate(template)}>
                    Apply
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => deleteTemplateMutation.mutate(template.id)}
                    disabled={deleteTemplateMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Unprocessed Events */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-xl border border-border p-4 md:p-6 shadow-card"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold text-lg">Unprocessed Webhook Events</h3>
          <Button variant="outline" size="sm" onClick={() => refetchEvents()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {eventsLoading ? (
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Check className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
            <p>All webhook events have been processed!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map(event => (
              <button
                key={event.id}
                onClick={() => setSelectedEventId(selectedEventId === event.id ? null : event.id)}
                className={`w-full p-3 rounded-lg border text-left transition-colors ${
                  selectedEventId === event.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileJson className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">Event {event.id.slice(0, 8)}...</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.received_at), 'MMM d, HH:mm')}
                        {event.source_ip && ` • ${event.source_ip}`}
                      </p>
                    </div>
                  </div>
                  {selectedEventId === event.id ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Field Mapper */}
      {selectedEvent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-4 md:p-6 shadow-card"
        >
          <h3 className="font-display font-bold text-lg mb-4">Map Fields</h3>
          
          {/* Payload Preview */}
          <div className="mb-6">
            <Label className="text-sm font-medium mb-2 block">Payload Preview</Label>
            <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-48 overflow-y-auto">
              {JSON.stringify(selectedEvent.payload, null, 2)}
            </pre>
          </div>

          {/* Array Path Selection */}
          <div className="mb-6">
            <Label className="text-sm font-medium mb-2 block">
              Select Data Array <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Choose which array contains the volunteer data
            </p>
            {arrayPaths.length === 0 ? (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>No arrays detected in payload</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {arrayPaths.map(path => (
                  <Button
                    key={path}
                    size="sm"
                    variant={arrayPath === path ? 'default' : 'outline'}
                    onClick={() => {
                      setArrayPath(path);
                      setFieldMappings({ email: '', name: '', phone: '' });
                    }}
                  >
                    {path}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Field Mappings */}
          {arrayPath && fieldPaths.length > 0 && (
            <div className="mb-6 space-y-4">
              <Label className="text-sm font-medium block">Map Source Fields to Volunteer Fields</Label>
              
              <div className="grid gap-4">
                {/* Email Mapping */}
                <div className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium">Email <span className="text-destructive">*</span></div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="flex flex-wrap gap-2">
                    {fieldPaths.map(field => (
                      <Button
                        key={`email-${field}`}
                        size="sm"
                        variant={fieldMappings.email === field ? 'default' : 'outline'}
                        onClick={() => setFieldMappings(m => ({ ...m, email: field }))}
                      >
                        {field}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Name Mapping */}
                <div className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium">Name</div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={fieldMappings.name === '' ? 'secondary' : 'outline'}
                      onClick={() => setFieldMappings(m => ({ ...m, name: '' }))}
                    >
                      (skip)
                    </Button>
                    {fieldPaths.map(field => (
                      <Button
                        key={`name-${field}`}
                        size="sm"
                        variant={fieldMappings.name === field ? 'default' : 'outline'}
                        onClick={() => setFieldMappings(m => ({ ...m, name: field }))}
                      >
                        {field}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Phone Mapping */}
                <div className="flex items-center gap-3">
                  <div className="w-24 text-sm font-medium">Phone</div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={fieldMappings.phone === '' ? 'secondary' : 'outline'}
                      onClick={() => setFieldMappings(m => ({ ...m, phone: '' }))}
                    >
                      (skip)
                    </Button>
                    {fieldPaths.map(field => (
                      <Button
                        key={`phone-${field}`}
                        size="sm"
                        variant={fieldMappings.phone === field ? 'default' : 'outline'}
                        onClick={() => setFieldMappings(m => ({ ...m, phone: field }))}
                      >
                        {field}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Preview */}
          {previewData.length > 0 && fieldMappings.email && (
            <div className="mb-6">
              <Label className="text-sm font-medium mb-2 block">Preview (first 3 records)</Label>
              <div className="bg-muted rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left font-medium">Email</th>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Phone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="px-3 py-2">{String(row.email) || '-'}</td>
                        <td className="px-3 py-2">{String(row.name) || '-'}</td>
                        <td className="px-3 py-2">{String(row.phone) || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => processDataMutation.mutate()}
              disabled={!fieldMappings.email || processDataMutation.isPending}
              className="gap-2"
            >
              {processDataMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Process & Create Volunteers
            </Button>

            <div className="flex items-center gap-2 flex-1">
              <Input
                placeholder="Template name..."
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="max-w-48"
              />
              <Button
                variant="outline"
                onClick={() => saveTemplateMutation.mutate()}
                disabled={!templateName || !fieldMappings.email || saveTemplateMutation.isPending}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                Save Template
              </Button>
            </div>

            <Button variant="ghost" onClick={resetForm}>
              Reset
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
