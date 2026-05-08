import React, { useState, useMemo } from 'react';
import { useEmailTemplates } from '@/hooks/useEmailTemplates';
import { ArrowLeft, Check, X, Eye, Loader2, User, Mail, Phone, Building, Calendar as CalendarLucide, AlertCircle, Clock, RefreshCw, Send, MailOpen, Users, KeyRound, Search, Copy, QrCode, GraduationCap, Code, ChevronDown, ChevronRight, Briefcase, Upload, Trash2, Award, Download, CalendarIcon, FileSpreadsheet, FileText, Pencil, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMarketplaces } from '@/hooks/useSupabaseData';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';

import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CertificatePreviewDialog } from '@/components/certificates/CertificatePreviewDialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FamilyMembersTab } from '@/components/admin/FamilyMembersTab';

type ExportFormat = 'excel' | 'csv';

interface VolunteerQRCard {
  id: string;
  unique_id: string;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  survey_completed_at: string | null;
  marketplace_id: string | null;
}

interface PendingVolunteer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  gender: string | null;
  is_employee: boolean;
  employee_vertical: string | null;
  employee_join_date: string | null;
  employee_number: string | null;
  external_company: string | null;
  has_medical_condition: boolean;
  medical_condition_details: string | null;
  emergency_contact_name: string | null;
  emergency_contact_relationship: string | null;
  emergency_contact_number: string | null;
  is_fasting: boolean;
  events_list: string | null;
  events_json: unknown;
  status: 'pending' | 'approved' | 'rejected' | 'duplicate';
  approved_at: string | null;
  rejection_reason: string | null;
  temp_password: string | null;
  email_sent: boolean | null;
  email_sent_at: string | null;
  email_send_count: number | null;
  email_opened: boolean | null;
  email_opened_at: string | null;
  created_at: string;
  source_data: unknown;
  source: string | null;
  training_completed: boolean | null;
  training_completed_at: string | null;
  certificate_sent_at: string | null;
  created_user_id: string | null;
  volunteer_qr_cards?: VolunteerQRCard[];
}

interface PendingVolunteersProps {
  onBack: () => void;
}

// Convert event slug to readable name: "event-13---ejadah-camp" -> "Ejadah Camp"
const formatEventName = (slug: string): string => {
  // Remove "event-X---" prefix pattern
  let name = slug.replace(/^event-\d+---/, '');
  // Replace remaining dashes with spaces
  name = name.replace(/-/g, ' ');
  // Capitalize each word
  return name.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

// Extract unique dependents from events_json
interface Dependent {
  name: string;
  type: string;
  gender?: string;
  qrCode?: string;
}

const extractUniqueDependents = (eventsJson: unknown): Dependent[] => {
  if (!eventsJson || !Array.isArray(eventsJson)) return [];
  
  const dependentsMap = new Map<string, Dependent>();
  
  for (const event of eventsJson) {
    if (event.dependents && Array.isArray(event.dependents)) {
      for (const dep of event.dependents) {
        const key = dep.name?.toLowerCase()?.trim();
        if (key && !dependentsMap.has(key)) {
          dependentsMap.set(key, {
            name: dep.name,
            type: dep.type || 'adult',
            gender: dep.gender || undefined
          });
        }
      }
    }
  }
  
  return Array.from(dependentsMap.values());
};

export const PendingVolunteers = ({ onBack }: PendingVolunteersProps) => {
  const [selectedVolunteer, setSelectedVolunteer] = useState<PendingVolunteer | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [approvedCredentials, setApprovedCredentials] = useState<{ email: string; password: string; emailSent: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<'approved' | 'bulk_uploaded' | 'pending_missing_email' | 'duplicates' | 'family_members'>('approved');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [showCertificatePreview, setShowCertificatePreview] = useState(false);
  const [certificatePreviewVolunteer, setCertificatePreviewVolunteer] = useState<PendingVolunteer | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [volunteerToDelete, setVolunteerToDelete] = useState<PendingVolunteer | null>(null);
  const [showBulkDeleteConfirmDialog, setShowBulkDeleteConfirmDialog] = useState(false);
  const [showAddEmailDialog, setShowAddEmailDialog] = useState(false);
  const [addEmailVolunteer, setAddEmailVolunteer] = useState<PendingVolunteer | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Duplicate handling state
  const [showApplyChangesDialog, setShowApplyChangesDialog] = useState(false);
  const [duplicateToApply, setDuplicateToApply] = useState<PendingVolunteer | null>(null);
  const [originalVolunteer, setOriginalVolunteer] = useState<PendingVolunteer | null>(null);
  const [applyingChanges, setApplyingChanges] = useState(false);
  
  // Export report state
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportStartDate, setExportStartDate] = useState<Date | undefined>(undefined);
  const [exportEndDate, setExportEndDate] = useState<Date | undefined>(undefined);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');
  const [exportMarketplace, setExportMarketplace] = useState<string>('all');
  const [syncingSurpluss, setSyncingSurpluss] = useState(false);
  const [showSyncResultDialog, setShowSyncResultDialog] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [syncingBeneficiaries, setSyncingBeneficiaries] = useState(false);
  const [showBenSyncResultDialog, setShowBenSyncResultDialog] = useState(false);
  const [benSyncResult, setBenSyncResult] = useState<any>(null);
  const [generatingFamilyQRs, setGeneratingFamilyQRs] = useState(false);
  const [sendingFamilyCerts, setSendingFamilyCerts] = useState(false);
  const [showFamilyCertsDialog, setShowFamilyCertsDialog] = useState(false);
  const [familyCertsMarketplace, setFamilyCertsMarketplace] = useState<string>('');
  const [familyCertsVolunteers, setFamilyCertsVolunteers] = useState<any[]>([]);
  const [loadingFamilyCertsVolunteers, setLoadingFamilyCertsVolunteers] = useState(false);
  const [sendingCertForVolunteer, setSendingCertForVolunteer] = useState<string | null>(null);
  const [expandedVolunteers, setExpandedVolunteers] = useState<Set<string>>(new Set());
  
  // Reminder dialog state
  const [reminderDialogVolunteer, setReminderDialogVolunteer] = useState<PendingVolunteer | null>(null);
  const [reminderTemplateId, setReminderTemplateId] = useState<string>('');
  
  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    gender: '',
    external_company: '',
    employee_vertical: '',
    employee_number: '',
  });
  // Add event state
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);
  const [selectedEventsToAdd, setSelectedEventsToAdd] = useState<string[]>([]);
  const [isAddingEvents, setIsAddingEvents] = useState(false);
  // Remove event state
  const [showRemoveEventDialog, setShowRemoveEventDialog] = useState(false);
  const [eventToRemove, setEventToRemove] = useState<{ slug: string; name: string } | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch marketplaces for adding events and export filter
  const { data: marketplaces = [] } = useMarketplaces();
  
  // Fetch email templates for reminder dialog
  const { data: emailTemplates = [] } = useEmailTemplates();

  const { data: volunteers = [], isLoading, refetch } = useQuery({
    queryKey: ['pending-volunteers', activeTab],
    queryFn: async () => {
      const data = await fetchAllRows<PendingVolunteer>(() => {
        let query = supabase
          .from('pending_volunteers')
          .select(`
            *,
            volunteer_qr_cards!volunteer_qr_cards_volunteer_id_fkey (
              id,
              unique_id,
              status,
              checked_in_at,
              checked_out_at,
              survey_completed_at,
              marketplace_id
            )
          `);

        // Filter by status and source based on active tab
        if (activeTab === 'pending_missing_email') {
          query = query.eq('status', 'pending').like('email', '%@placeholder.invalid');
        } else if (activeTab === 'duplicates') {
          query = query.eq('status', 'duplicate');
        } else {
          // For approved and bulk_uploaded tabs, fetch ALL approved volunteers
          // so search can work across both tabs
          query = query.eq('status', 'approved');
        }

        return query.order('created_at', { ascending: false });
      });

      return data;
    }
  });

  // Extract unique events from all volunteers, deduplicating by normalized slug
  const uniqueEvents = useMemo(() => {
    const eventsMap = new Map<string, string>();
    volunteers.forEach(v => {
      if (v.events_list) {
        v.events_list.split(',').forEach(e => {
          const trimmed = e.trim();
          if (!trimmed) return;
          const formatted = formatEventName(trimmed);
          // Normalize key: lowercase, collapse whitespace, remove extra separators
          const normalizedKey = formatted.toLowerCase().replace(/\s+/g, ' ').trim();
          if (normalizedKey && !eventsMap.has(normalizedKey)) {
            eventsMap.set(normalizedKey, formatted);
          }
        });
      }
    });
    return Array.from(eventsMap.values()).sort();
  }, [volunteers]);

  // Filter volunteers by selected event and search query
  const filteredVolunteers = useMemo(() => {
    let result = volunteers;
    
    // When searching, show results across approved + bulk_uploaded tabs (not duplicates)
    const isSearching = searchQuery.trim().length > 0;
    
    // Apply source filter client-side only when NOT searching
    // - bulk_uploaded tab: only bulk-upload rows
    // - approved tab: ALL approved rows (partner submissions + bulk uploads)
    if (!isSearching && activeTab === 'bulk_uploaded') {
      result = result.filter(v => v.source === 'bulk_upload');
    }
    
    // Event filter
    if (eventFilter !== 'all') {
      const filterNormalized = eventFilter.toLowerCase().replace(/\s+/g, ' ').trim();
      result = result.filter(v => {
        if (!v.events_list) return false;
        return v.events_list.split(',').some(e => {
          const formatted = formatEventName(e.trim());
          const normalizedKey = formatted.toLowerCase().replace(/\s+/g, ' ').trim();
          return normalizedKey === filterNormalized;
        });
      });
    }
    
    // Search filter
    if (isSearching) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(v => {
        const fullName = `${v.first_name || ''} ${v.last_name || ''}`.toLowerCase();
        const email = v.email.toLowerCase();
        const phone = (v.phone_number || '').toLowerCase();
        const company = (v.external_company || '').toLowerCase();
        
        return fullName.includes(query) || 
               email.includes(query) || 
               phone.includes(query) ||
               company.includes(query);
      });
    }
    
    return result;
  }, [volunteers, eventFilter, searchQuery, activeTab]);

  const approveMutation = useMutation({
    mutationFn: async (pendingId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('webhook-receiver', {
        body: {
          action: 'approve_volunteer',
          pending_id: pendingId
        }
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error || 'Approval failed');
      
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
      setApprovedCredentials({
        email: data.email,
        password: data.temp_password,
        emailSent: data.email_sent ?? false
      });
      setShowCredentialsDialog(true);
      setShowDetailsDialog(false);
      toast({
        title: 'Volunteer Approved',
        description: data.email_sent 
          ? `Account created and welcome email sent to ${data.email}`
          : `Account created for ${data.email}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Approval Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ pendingId, reason }: { pendingId: string; reason: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('webhook-receiver', {
        body: {
          action: 'reject_volunteer',
          pending_id: pendingId,
          reason
        }
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error || 'Rejection failed');
      
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
      setShowRejectDialog(false);
      setShowDetailsDialog(false);
      setRejectionReason('');
      toast({
        title: 'Application Rejected',
        description: `${data.email} has been rejected`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Rejection Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const resendEmailMutation = useMutation({
    mutationFn: async (pendingId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('webhook-receiver', {
        body: {
          action: 'resend_email',
          pending_id: pendingId
        }
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error || 'Failed to resend email');
      
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
      toast({
        title: 'Email Sent',
        description: `Welcome email resent to ${data.email} (${data.email_send_count} total)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Send Email',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  const sendReminderMutation = useMutation({
    mutationFn: async ({ volunteer, templateId }: { volunteer: PendingVolunteer; templateId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Create a single-recipient campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('email_campaigns' as any)
        .insert({
          name: `Reminder: ${volunteer.first_name} ${volunteer.last_name}`,
          template_id: templateId,
          status: 'draft',
          total_recipients: 1,
          created_by: userData.user?.id,
          recipient_filter: { type: 'individual_reminder' },
        } as any)
        .select()
        .single();
      if (campaignError) throw new Error(campaignError.message);

      const campaignId = (campaign as any).id;

      // Add the single recipient
      const { error: recipientError } = await supabase
        .from('email_campaign_recipients' as any)
        .insert({
          campaign_id: campaignId,
          volunteer_id: volunteer.id,
          recipient_email: volunteer.email,
          recipient_name: `${volunteer.first_name} ${volunteer.last_name}`,
          status: 'pending',
        } as any);
      if (recipientError) throw new Error(recipientError.message);

      // Invoke send-campaign-email
      const { data, error } = await supabase.functions.invoke('send-campaign-email', {
        body: { campaign_id: campaignId }
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      setSendingReminderId(null);
      setReminderDialogVolunteer(null);
      setReminderTemplateId('');
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
      toast({ title: 'Reminder Sent', description: 'Reminder email has been sent using the selected template.' });
    },
    onError: (error: Error) => {
      setSendingReminderId(null);
      toast({ title: 'Failed to Send Reminder', description: error.message, variant: 'destructive' });
    }
  });

  const [resendingSurveyId, setResendingSurveyId] = useState<string | null>(null);

  const resendSurveyMutation = useMutation({
    mutationFn: async (volunteer: PendingVolunteer) => {
      const primaryCard = (volunteer.volunteer_qr_cards || []).find(
        (c) => !/-F\d+/.test(c.unique_id)
      );
      if (!primaryCard) throw new Error('No QR card found for this volunteer');

      const { data, error } = await supabase.functions.invoke('send-survey', {
        body: {
          volunteerCardId: primaryCard.id,
          volunteerId: volunteer.id,
          volunteerName: `${volunteer.first_name} ${volunteer.last_name}`,
          volunteerEmail: volunteer.email,
          marketplaceId: primaryCard.marketplace_id || undefined,
        }
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to send survey');
      return data;
    },
    onSuccess: () => {
      setResendingSurveyId(null);
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
      toast({ title: 'Survey Sent', description: 'Survey email has been sent successfully.' });
    },
    onError: (error: Error) => {
      setResendingSurveyId(null);
      toast({ title: 'Failed to Send Survey', description: error.message, variant: 'destructive' });
    }
  });

  const bulkResendMutation = useMutation({
    mutationFn: async (pendingIds: string[]) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('webhook-receiver', {
        body: {
          action: 'bulk_resend_emails',
          pending_ids: pendingIds
        }
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error || 'Bulk send failed');
      
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
      setSelectedIds(new Set());
      toast({
        title: 'Bulk Email Sent',
        description: `${data.success_count} emails sent, ${data.fail_count} failed`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Bulk Send Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Delete mutation for bulk uploaded volunteers
  const deleteMutation = useMutation({
    mutationFn: async (pendingId: string) => {
      const volunteer = volunteers.find(v => v.id === pendingId);
      if (!volunteer) throw new Error('Volunteer not found');

      // Delete associated user account if exists
      if (volunteer.created_user_id) {
        const { error: deleteUserError } = await supabase.functions.invoke('delete-user', {
          body: { userId: volunteer.created_user_id }
        });
        // Ignore "user not found" errors
        if (deleteUserError && !deleteUserError.message?.includes('not found')) {
          console.error('Error deleting user:', deleteUserError);
        }
      }

      // Delete the pending volunteer record
      const { error } = await supabase
        .from('pending_volunteers')
        .delete()
        .eq('id', pendingId);

      if (error) throw error;
      return { email: volunteer.email };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
      queryClient.invalidateQueries({ queryKey: ['bulk-uploaded-volunteers-count'] });
      toast({
        title: 'Volunteer Deleted',
        description: `${data.email} has been removed`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const volunteersToDelete = volunteers.filter(v => ids.includes(v.id));
      let deletedCount = 0;
      let failedCount = 0;

      for (const volunteer of volunteersToDelete) {
        try {
          // Delete user account if exists
          if (volunteer.created_user_id) {
            await supabase.functions.invoke('delete-user', {
              body: { userId: volunteer.created_user_id }
            });
          }

          // Delete the pending volunteer record
          const { error } = await supabase
            .from('pending_volunteers')
            .delete()
            .eq('id', volunteer.id);

          if (error) throw error;
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete ${volunteer.email}:`, error);
          failedCount++;
        }
      }

      return { deletedCount, failedCount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
      queryClient.invalidateQueries({ queryKey: ['bulk-uploaded-volunteers-count'] });
      setSelectedIds(new Set());
      toast({
        title: 'Bulk Delete Complete',
        description: `${data.deletedCount} deleted, ${data.failedCount} failed`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Bulk Delete Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Add email mutation for pending volunteers
  const addEmailMutation = useMutation({
    mutationFn: async ({ pendingId, email }: { pendingId: string; email: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('webhook-receiver', {
        body: {
          action: 'add_volunteer_email',
          pending_id: pendingId,
          email: email.trim().toLowerCase()
        }
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data.success) throw new Error(response.data.error || 'Failed to add email');
      
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers-count'] });
      setShowAddEmailDialog(false);
      setAddEmailVolunteer(null);
      setNewEmail('');
      setApprovedCredentials({
        email: data.email,
        password: data.temp_password,
        emailSent: data.email_sent ?? false
      });
      setShowCredentialsDialog(true);
      toast({
        title: 'Volunteer Approved',
        description: data.email_sent 
          ? `Account created and welcome email sent to ${data.email}`
          : `Account created for ${data.email}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Add Email',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Edit volunteer mutation
  const editVolunteerMutation = useMutation({
    mutationFn: async ({ pendingId, updates }: { 
      pendingId: string; 
      updates: {
        first_name?: string;
        last_name?: string;
        email?: string;
        phone_number?: string | null;
        gender?: string | null;
        external_company?: string | null;
        employee_vertical?: string | null;
        employee_number?: string | null;
      }
    }) => {
      const { error } = await supabase
        .from('pending_volunteers')
        .update(updates)
        .eq('id', pendingId);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
      setIsEditMode(false);
      setShowDetailsDialog(false);
      toast({
        title: 'Volunteer Updated',
        description: 'The volunteer information has been updated',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Add event mutation
  const addEventMutation = useMutation({
    mutationFn: async ({ pendingId, eventName, marketplace }: { pendingId: string; eventName: string; marketplace?: { name: string; event_date?: string | null; start_time?: string | null; end_time?: string | null; location?: string | null } }) => {
      // Get the current volunteer to update their events
      const volunteer = volunteers.find(v => v.id === pendingId);
      if (!volunteer) throw new Error('Volunteer not found');

      // Convert marketplace name to event slug format
      const eventSlug = eventName.toLowerCase().replace(/\s+/g, '-');
      
      // Update events_list (comma-separated string)
      const currentEvents = volunteer.events_list ? volunteer.events_list.split(',').map(e => e.trim()) : [];
      if (!currentEvents.some(e => formatEventName(e) === eventName)) {
        currentEvents.push(eventSlug);
      }
      const newEventsList = currentEvents.join(',');

      // Format date like "March 12, 2026"
      const formatMktDate = (dateStr?: string | null) => {
        if (!dateStr) return null;
        try {
          const d = new Date(dateStr);
          return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        } catch { return null; }
      };

      // Format time range like "07.00 am - 01.30 pm"
      const formatMktTime = (start?: string | null, end?: string | null) => {
        if (!start && !end) return null;
        const fmt = (t: string) => {
          try {
            const [h, m] = t.split(':').map(Number);
            const ampm = h >= 12 ? 'pm' : 'am';
            const h12 = h % 12 || 12;
            return `${String(h12).padStart(2, '0')}.${String(m).padStart(2, '0')} ${ampm}`;
          } catch { return t; }
        };
        if (start && end) return `${fmt(start)} - ${fmt(end)}`;
        return start ? fmt(start) : fmt(end!);
      };

      // Update events_json (array of event objects) with full marketplace details
      const currentEventsJson = Array.isArray(volunteer.events_json) ? volunteer.events_json : [];
      const newEventJson: Record<string, unknown> = {
        event: eventSlug,
        name: marketplace?.name || eventName,
        eventDate: formatMktDate(marketplace?.event_date),
        eventTime: formatMktTime(marketplace?.start_time, marketplace?.end_time),
        eventLocation: marketplace?.location || null,
        addedManually: true,
        addedAt: new Date().toISOString()
      };
      const newEventsJson = [...currentEventsJson, newEventJson];

      const { error } = await supabase
        .from('pending_volunteers')
        .update({
          events_list: newEventsList,
          events_json: newEventsJson
        })
        .eq('id', pendingId);

      if (error) throw error;
      return { success: true, eventName };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
      // Update local selected volunteer with new event
      if (selectedVolunteer) {
        const updatedVolunteer = volunteers.find(v => v.id === selectedVolunteer.id);
        if (updatedVolunteer) {
          setSelectedVolunteer(updatedVolunteer);
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Add Event',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Remove event mutation
  const removeEventMutation = useMutation({
    mutationFn: async ({ pendingId, eventSlug }: { pendingId: string; eventSlug: string }) => {
      const volunteer = volunteers.find(v => v.id === pendingId);
      if (!volunteer) throw new Error('Volunteer not found');

      // Update events_list
      const currentEvents = volunteer.events_list ? volunteer.events_list.split(',').map(e => e.trim()) : [];
      const filteredEvents = currentEvents.filter(e => e !== eventSlug);
      const newEventsList = filteredEvents.length > 0 ? filteredEvents.join(',') : null;

      // Update events_json
      const currentEventsJson = Array.isArray(volunteer.events_json) ? volunteer.events_json : [];
      const newEventsJson = (currentEventsJson as any[]).filter((ej: any) => ej.event !== eventSlug);

      const { error } = await supabase
        .from('pending_volunteers')
        .update({
          events_list: newEventsList,
          events_json: newEventsJson.length > 0 ? newEventsJson : null
        })
        .eq('id', pendingId);

      if (error) throw error;

      // Also remove registration_events row if exists
      // Find matching partner_registration by email to get registration_id
      const { data: partnerReg } = await supabase
        .from('partner_registrations')
        .select('id')
        .eq('work_email', volunteer.email)
        .maybeSingle();

      if (partnerReg) {
        await supabase
          .from('registration_events')
          .delete()
          .eq('registration_id', partnerReg.id)
          .eq('event_slug', eventSlug);
      }

      return { success: true, eventSlug };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
      setShowRemoveEventDialog(false);
      setEventToRemove(null);
      toast({
        title: 'Event Removed',
        description: `${formatEventName(data.eventSlug)} has been removed from the volunteer's registration`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Remove Event',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const handleApprove = (volunteer: PendingVolunteer) => {
    approveMutation.mutate(volunteer.id);
  };

  const handleStartEdit = () => {
    if (selectedVolunteer) {
      setEditForm({
        first_name: selectedVolunteer.first_name || '',
        last_name: selectedVolunteer.last_name || '',
        email: selectedVolunteer.email || '',
        phone_number: selectedVolunteer.phone_number || '',
        gender: selectedVolunteer.gender || '',
        external_company: selectedVolunteer.external_company || '',
        employee_vertical: selectedVolunteer.employee_vertical || '',
        employee_number: selectedVolunteer.employee_number || '',
      });
      setIsEditMode(true);
    }
  };

  const handleSaveEdit = () => {
    if (!selectedVolunteer) return;
    editVolunteerMutation.mutate({
      pendingId: selectedVolunteer.id,
      updates: {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email || undefined,
        phone_number: editForm.phone_number || null,
        gender: editForm.gender || null,
        external_company: editForm.external_company || null,
        employee_vertical: editForm.employee_vertical || null,
        employee_number: editForm.employee_number || null,
      }
    });
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  const handleBulkResend = () => {
    if (selectedIds.size === 0) return;
    bulkResendMutation.mutate(Array.from(selectedIds));
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setShowBulkDeleteConfirmDialog(true);
  };

  const confirmBulkDelete = () => {
    setShowBulkDeleteConfirmDialog(false);
    bulkDeleteMutation.mutate(Array.from(selectedIds));
  };

  const handleDelete = (volunteer: PendingVolunteer) => {
    setVolunteerToDelete(volunteer);
    setShowDeleteConfirmDialog(true);
  };

  const confirmDelete = () => {
    if (volunteerToDelete) {
      deleteMutation.mutate(volunteerToDelete.id);
    }
    setShowDeleteConfirmDialog(false);
    setVolunteerToDelete(null);
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredVolunteers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredVolunteers.map(v => v.id)));
    }
  };

  const handleReject = () => {
    if (!selectedVolunteer) return;
    rejectMutation.mutate({ pendingId: selectedVolunteer.id, reason: rejectionReason });
  };

  const openRejectDialog = (volunteer: PendingVolunteer) => {
    setSelectedVolunteer(volunteer);
    setShowRejectDialog(true);
  };

  const openDetailsDialog = (volunteer: PendingVolunteer) => {
    setSelectedVolunteer(volunteer);
    setShowDetailsDialog(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = useQuery({
    queryKey: ['pending-volunteers-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('pending_volunteers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .like('email', '%@placeholder.invalid');
      if (error) throw error;
      return count || 0;
    }
  });

  const bulkUploadedCount = useQuery({
    queryKey: ['bulk-uploaded-volunteers-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('pending_volunteers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .eq('source', 'bulk_upload');
      if (error) throw error;
      return count || 0;
    }
  });

  const duplicatesCount = useQuery({
    queryKey: ['duplicate-volunteers-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('pending_volunteers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'duplicate');
      if (error) throw error;
      return count || 0;
    }
  });

  // Export report handler
  const handleExportReport = async () => {
    if (!exportStartDate || !exportEndDate) {
      toast({
        title: 'Select Date Range',
        description: 'Please select both start and end dates',
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);
    try {
      // Set end date to end of day
      const endOfDay = new Date(exportEndDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Query volunteers within date range — paginate to bypass 1000-row cap
      const rawData = await fetchAllRows<any>(() => {
        let query = supabase
          .from('pending_volunteers')
          .select(`*, volunteer_qr_cards!volunteer_qr_cards_volunteer_id_fkey (id, unique_id, status, checked_in_at, checked_out_at, survey_completed_at, marketplace_id)`)
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        // Only apply date range filter when exporting all marketplaces
        if (exportMarketplace === 'all') {
          query = query.gte('created_at', exportStartDate.toISOString()).lte('created_at', endOfDay.toISOString());
        }

        // Apply tab filter (approved tab exports ALL approved rows, including bulk uploads)
        if (activeTab === 'bulk_uploaded') {
          query = query.eq('source', 'bulk_upload');
        }

        return query;
      });

      // Apply marketplace filter client-side (events_list is comma-separated text)
      let data = rawData || [];
      if (exportMarketplace !== 'all') {
        const selectedMkt = marketplaces.find(m => m.id === exportMarketplace);
        if (selectedMkt) {
          const mktNormalized = selectedMkt.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          data = data.filter(v => {
            if (!v.events_list) return false;
            return v.events_list.split(',').some((e: string) => {
              const formatted = formatEventName(e.trim());
              const normalizedKey = formatted.toLowerCase().replace(/[^a-z0-9]/g, '');
              return normalizedKey === mktNormalized;
            });
          });
        }
      }

      if (!data || data.length === 0) {
        toast({
          title: 'No Data',
          description: 'No volunteers found for the selected criteria',
          variant: 'destructive',
        });
        setIsExporting(false);
        return;
      }

      // Fetch family QR cards for these volunteers
      const volunteerIds = data.map(v => v.id);
      const { data: familyCards } = await supabase
        .from('volunteer_qr_cards')
        .select('id, unique_id, volunteer_id, status, checked_in_at, checked_out_at, survey_completed_at')
        .in('volunteer_id', volunteerIds)
        .like('unique_id', '%-F%');

      // Fetch completed surveys for survey status matching
      const { data: completedSurveys } = await supabase
        .from('volunteer_surveys')
        .select('volunteer_email, marketplace_id, completed_at')
        .not('completed_at', 'is', null);

      const { data: externalSurveys } = await supabase
        .from('external_survey_responses')
        .select('volunteer_email, marketplace_id, completed_at')
        .not('completed_at', 'is', null);

      // Build a Set of "email|marketplace_id" keys for O(1) lookup
      const surveyCompletionSet = new Set<string>();
      for (const s of (completedSurveys || [])) {
        if (s.volunteer_email && s.marketplace_id) {
          surveyCompletionSet.add(`${s.volunteer_email.toLowerCase()}|${s.marketplace_id}`);
        }
        if (s.volunteer_email) {
          surveyCompletionSet.add(`${s.volunteer_email.toLowerCase()}|any`);
        }
      }
      for (const s of (externalSurveys || [])) {
        if (s.volunteer_email && s.marketplace_id) {
          surveyCompletionSet.add(`${s.volunteer_email.toLowerCase()}|${s.marketplace_id}`);
        }
        if (s.volunteer_email) {
          surveyCompletionSet.add(`${s.volunteer_email.toLowerCase()}|any`);
        }
      }

      // Build a map of volunteer_id -> family cards
      const familyCardsByVolunteer = new Map<string, typeof familyCards>();
      for (const fc of (familyCards || [])) {
        if (!fc.volunteer_id) continue;
        const existing = familyCardsByVolunteer.get(fc.volunteer_id) || [];
        existing.push(fc);
        familyCardsByVolunteer.set(fc.volunteer_id, existing);
      }

      // Helper to extract dependents
      const extractDeps = (eventsJson: unknown): Array<{ name: string }> => {
        if (!eventsJson || !Array.isArray(eventsJson)) return [];
        const map = new Map<string, string>();
        for (const ev of eventsJson) {
          if (ev.dependents && Array.isArray(ev.dependents)) {
            for (const dep of ev.dependents) {
              const key = dep.name?.toLowerCase()?.trim();
              if (key && !map.has(key)) map.set(key, dep.name);
            }
          }
        }
        return Array.from(map.values()).map(name => ({ name }));
      };

      // Resolve family member name
      const resolveName = (cardUniqueId: string, eventsJson: unknown, allSiblingCards: any[], volFirstName: string, volLastName: string): string => {
        const deps = extractDeps(eventsJson);
        if (deps.length === 0) return `Family of ${volFirstName} ${volLastName}`;
        const fMatch = cardUniqueId.match(/-F(\d+)/);
        const idx = fMatch ? parseInt(fMatch[1], 10) : 0;
        if (idx > 0 && idx <= deps.length) return deps[idx - 1].name;
        const sorted = allSiblingCards.filter((c: any) => /-F\d+/.test(c.unique_id)).sort((a: any, b: any) => {
          const aI = parseInt(a.unique_id.match(/-F(\d+)/)?.[1] || '0', 10);
          const bI = parseInt(b.unique_id.match(/-F(\d+)/)?.[1] || '0', 10);
          return aI - bI;
        });
        const posIdx = sorted.findIndex((c: any) => c.unique_id === cardUniqueId);
        if (posIdx >= 0 && posIdx < deps.length) return deps[posIdx].name;
        return `Family of ${volFirstName} ${volLastName}`;
      };

      // Create data rows with Type column
      const headers = [
        'Full Name',
        'Type',
        'Email',
        'Phone Number',
        'Gender',
        'Employee',
        'Employee ID',
        'Company/Vertical',
        'Events Registered',
        'QR Card ID',
        'Attendance Status',
        'Survey Status',
        'Certificate Sent',
        'Training Completed',
        'Email Sent',
        'Created Date'
      ];

      const rows: string[][] = [];
      let totalPrimary = 0;
      let totalFamily = 0;
      let totalAttended = 0;

      for (const v of data) {
        totalPrimary++;
        // Check if primary volunteer attended (has any checked_out card)
        const primaryCards = (v as any).volunteer_qr_cards as VolunteerQRCard[] | undefined;
        const primaryAttended = primaryCards?.some(c => c.status === 'checked_out' && !/-F\d+/.test(c.unique_id));
        if (primaryAttended) totalAttended++;

        // Determine survey status for attended volunteers
        let surveyStatus = '';
        if (primaryAttended) {
          const cardWithSurvey = primaryCards?.find(c => c.status === 'checked_out' && !/-F\d+/.test(c.unique_id) && c.survey_completed_at);
          if (cardWithSurvey) {
            surveyStatus = 'Yes';
          } else {
            const email = v.email?.toLowerCase();
            const mktId = primaryCards?.find(c => c.status === 'checked_out' && !/-F\d+/.test(c.unique_id))?.marketplace_id;
            if (email && mktId && surveyCompletionSet.has(`${email}|${mktId}`)) {
              surveyStatus = 'Yes';
            } else if (email && surveyCompletionSet.has(`${email}|any`)) {
              surveyStatus = 'Yes';
            } else {
              surveyStatus = 'No';
            }
          }
        }

        rows.push([
          `${v.first_name} ${v.last_name}`,
          'Primary',
          v.email || '',
          v.phone_number || '',
          v.gender || '',
          v.is_employee ? 'Yes' : 'No',
          v.employee_number || '',
          v.is_employee ? (v.employee_vertical || 'Dubai Holding') : (v.external_company || ''),
          v.events_list?.split(',').map((e: string) => formatEventName(e.trim())).join('; ') || '',
          primaryCards?.find(c => !/-F\d+/.test(c.unique_id))?.unique_id || '',
          primaryAttended ? 'Attended' : (primaryCards?.some(c => c.status === 'checked_in') ? 'Checked In' : 'Registered'),
          surveyStatus,
          v.certificate_sent_at ? 'Yes' : 'No',
          v.training_completed ? 'Yes' : 'No',
          v.email_sent ? 'Yes' : 'No',
          new Date(v.created_at).toLocaleDateString()
        ]);

        // Add family member rows
        const volFamilyCards = familyCardsByVolunteer.get(v.id) || [];
        for (const fc of volFamilyCards) {
          totalFamily++;
          const memberName = resolveName(fc.unique_id, v.events_json, volFamilyCards, v.first_name, v.last_name);
          const familyAttended = fc.status === 'checked_out';
          if (familyAttended) totalAttended++;

          const familySurveyStatus = familyAttended ? (fc.survey_completed_at ? 'Yes' : 'No') : '';

          rows.push([
            memberName,
            'Family Member',
            `via ${v.first_name} ${v.last_name} (${v.email})`,
            '',
            '',
            '',
            '',
            '',
            '',
            fc.unique_id,
            familyAttended ? 'Attended' : (fc.status === 'checked_in' ? 'Checked In' : 'Registered'),
            familySurveyStatus,
            fc.survey_completed_at ? 'Yes' : 'No',
            '',
            '',
            ''
          ]);
        }
      }

      // Add summary rows
      rows.push(Array(headers.length).fill(''));
      rows.push(['SUMMARY', ...Array(headers.length - 1).fill('')]);
      rows.push([`Total Registrations: ${totalPrimary + totalFamily}`, ...Array(headers.length - 1).fill('')]);
      rows.push([`Primary Volunteers: ${totalPrimary}`, ...Array(headers.length - 1).fill('')]);
      rows.push([`Family Members: ${totalFamily}`, ...Array(headers.length - 1).fill('')]);
      rows.push([`Actual Attendance (Checked Out): ${totalAttended}`, ...Array(headers.length - 1).fill('')]);

      const startStr = format(exportStartDate, 'yyyy-MM-dd');
      const endStr = format(exportEndDate, 'yyyy-MM-dd');
      const mktSuffix = exportMarketplace !== 'all' 
        ? `-${(marketplaces.find(m => m.id === exportMarketplace)?.name || '').toLowerCase().replace(/\s+/g, '-')}`
        : '';
      const baseFilename = `volunteers-report${mktSuffix}-${startStr}-to-${endStr}`;

      if (exportFormat === 'excel') {
        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        worksheet['!cols'] = [
          { wch: 30 }, // Full Name
          { wch: 15 }, // Type
          { wch: 35 }, // Email
          { wch: 15 }, // Phone
          { wch: 10 }, // Gender
          { wch: 10 }, // Employee
          { wch: 15 }, // Employee ID
          { wch: 20 }, // Company
          { wch: 40 }, // Events
          { wch: 22 }, // QR Card ID
          { wch: 15 }, // Attendance Status
          { wch: 15 }, // Survey Status
          { wch: 15 }, // Certificate Sent
          { wch: 15 }, // Training
          { wch: 12 }, // Email Sent
          { wch: 12 }, // Created Date
        ];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Volunteers');
        XLSX.writeFile(workbook, `${baseFilename}.xlsx`);
      } else {
        const escapeCsvValue = (value: string) => {
          if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        };
        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(escapeCsvValue).join(','))
        ].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseFilename}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      toast({
        title: 'Export Complete',
        description: `Exported ${totalPrimary} volunteers + ${totalFamily} family members to ${exportFormat === 'excel' ? 'Excel' : 'CSV'}`,
      });
      setShowExportDialog(false);
    } catch (error: unknown) {
      console.error('Export error:', error);
      toast({
        title: 'Export Failed',
        description: error instanceof Error ? error.message : 'Failed to export report',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-3 md:py-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <BrandLogo size="md" />
              <div>
                <h1 className="font-display font-bold text-base md:text-lg">Volunteers Added</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                  View approved volunteers
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                   setSyncingSurpluss(true);
                   setSyncProgress(null);
                  try {
                    // Build target marketplace list
                    const targets =
                      eventFilter !== 'all'
                        ? marketplaces.filter(m => m.name === eventFilter)
                        : marketplaces;

                    if (targets.length === 0) {
                      toast({ title: 'No marketplaces to sync', variant: 'destructive' });
                      return;
                    }

                    // Aggregate counters
                    const combined: any = {
                      success: true,
                      volunteers_sent: 0, volunteers_failed: 0, volunteers_skipped: 0,
                      volunteers_bulk_updated: 0, volunteers_attached_to_event: 0, volunteers_total: 0,
                      volunteer_details: [] as any[],
                      family_total: 0, family_sent: 0, family_skipped: 0, family_failed: 0,
                      demographics_sent: 0, demographics_failed: 0, demographics_details: [] as any[],
                      beneficiaries_sent: 0, beneficiaries_failed: 0, beneficiaries_skipped: 0, beneficiaries_total: 0,
                      marketplace_events_updated: 0, marketplace_events_failed: 0,
                      beneficiary_details: [] as any[],
                      errors: [] as string[],
                      per_marketplace: [] as any[],
                    };

                    for (let i = 0; i < targets.length; i++) {
                      const m = targets[i];
                      setSyncProgress({ current: i + 1, total: targets.length, name: m.name });
                      try {
                        const { data, error } = await supabase.functions.invoke(
                          'sync-surpluss-volunteer-beneficiary',
                          { body: { environment: 'production', marketplace_id: m.id } },
                        );
                        if (error) throw error;
                        const d = data || {};
                        combined.success = combined.success && (d.success !== false);
                        combined.volunteers_sent += d.volunteers_sent ?? 0;
                        combined.volunteers_failed += d.volunteers_failed ?? 0;
                        combined.volunteers_skipped += d.volunteers_skipped ?? 0;
                        combined.volunteers_bulk_updated += d.volunteers_bulk_updated ?? 0;
                        combined.volunteers_attached_to_event += d.volunteers_attached_to_event ?? 0;
                        combined.volunteers_total += d.volunteers_total ?? 0;
                        combined.volunteer_details.push(...(d.volunteer_details ?? []));
                        combined.family_total += d.family_total ?? 0;
                        combined.family_sent += d.family_sent ?? 0;
                        combined.family_skipped += d.family_skipped ?? 0;
                        combined.family_failed += d.family_failed ?? 0;
                        combined.demographics_sent += d.demographics_sent ?? 0;
                        combined.demographics_failed += d.demographics_failed ?? 0;
                        combined.demographics_details.push(...(d.demographics_details ?? []));
                        combined.beneficiaries_sent += d.beneficiaries_sent ?? 0;
                        combined.beneficiaries_failed += d.beneficiaries_failed ?? 0;
                        combined.beneficiaries_skipped += d.beneficiaries_skipped ?? 0;
                        combined.beneficiaries_total += d.beneficiaries_total ?? 0;
                        combined.marketplace_events_updated += d.marketplace_events_updated ?? 0;
                        combined.marketplace_events_failed += d.marketplace_events_failed ?? 0;
                        combined.beneficiary_details.push(...(d.beneficiary_details ?? []));
                        combined.errors.push(...(d.errors ?? []));
                        combined.per_marketplace.push({ name: m.id, label: m.name, status: 'ok', summary: d });
                      } catch (perErr) {
                        const reason = perErr instanceof Error ? perErr.message : String(perErr);
                        combined.success = false;
                        combined.errors.push(`[${m.name}] ${reason}`);
                        combined.volunteer_details.push({ name: m.name, status: 'failed', reason: `Marketplace sync failed: ${reason}` });
                        combined.per_marketplace.push({ name: m.id, label: m.name, status: 'failed', reason });
                      }
                    }

                    setSyncResult(combined);
                    setShowSyncResultDialog(true);
                  } catch (err) {
                    toast({
                      title: 'Sync Failed',
                      description: err instanceof Error ? err.message : 'Unknown error',
                      variant: 'destructive',
                    });
                  } finally {
                    setSyncingSurpluss(false);
                    setSyncProgress(null);
                  }
                }}
                disabled={syncingSurpluss || marketplaces.length === 0}
                className="gap-2"
              >
                {syncingSurpluss ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="hidden sm:inline">
                  {syncingSurpluss && syncProgress
                    ? `Syncing ${syncProgress.current}/${syncProgress.total} — ${syncProgress.name}`
                    : 'Sync to Surpluss'}
                </span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                  setSyncingBeneficiaries(true);
                  try {
                    const body: any = { environment: 'production' };
                    if (eventFilter !== 'all') {
                      body.marketplace_id = marketplaces.find(m => m.name === eventFilter)?.id;
                    } else if (marketplaces.length > 0) {
                      body.marketplace_ids = marketplaces.map(m => m.id);
                    }
                    const { data, error } = await supabase.functions.invoke('sync-surpluss-beneficiaries', { body });
                    if (error) throw error;
                    setBenSyncResult(data);
                    setShowBenSyncResultDialog(true);
                  } catch (err) {
                    toast({
                      title: 'Beneficiary Sync Failed',
                      description: err instanceof Error ? err.message : 'Unknown error',
                      variant: 'destructive',
                    });
                  } finally {
                    setSyncingBeneficiaries(false);
                  }
                }}
                disabled={syncingBeneficiaries || marketplaces.length === 0}
                className="gap-2"
              >
                {syncingBeneficiaries ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                <span className="hidden sm:inline">Sync Beneficiaries</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowExportDialog(true)} className="gap-2">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                  setGeneratingFamilyQRs(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('generate-missing-family-qrs');
                    if (error) throw error;
                    if (data?.totalCardsCreated > 0) {
                      toast({
                        title: 'Family QR Cards Generated',
                        description: `Created ${data.totalCardsCreated} family QR card(s) for ${data.volunteersFixed} volunteer(s).`,
                      });
                      refetch();
                    } else {
                      toast({
                        title: 'No Missing Cards',
                        description: 'All volunteers with family members already have their QR cards.',
                      });
                    }
                  } catch (err) {
                    toast({
                      title: 'Generation Failed',
                      description: err instanceof Error ? err.message : 'Unknown error',
                      variant: 'destructive',
                    });
                  } finally {
                    setGeneratingFamilyQRs(false);
                  }
                }}
                disabled={generatingFamilyQRs}
                className="gap-2"
              >
                {generatingFamilyQRs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                <span className="hidden sm:inline">Fix Family QRs</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setShowFamilyCertsDialog(true);
                  setFamilyCertsMarketplace('');
                  setFamilyCertsVolunteers([]);
                }}
                className="gap-2"
              >
                <Award className="w-4 h-4" />
                <span className="hidden sm:inline">Send Family Certs</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Search and Event Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          {/* Event Filter */}
          <div className="flex items-center gap-2">
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {uniqueEvents.map(event => (
                  <SelectItem key={event} value={event}>{event}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(eventFilter !== 'all' || searchQuery.trim()) && (
              <Badge variant="secondary" className="gap-1 shrink-0">
                {filteredVolunteers.length} result{filteredVolunteers.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'approved' | 'bulk_uploaded' | 'pending_missing_email' | 'duplicates' | 'family_members'); setSelectedIds(new Set()); }}>
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="approved" className="gap-2">
              <Check className="w-4 h-4" />
              Partner Volunteers
            </TabsTrigger>
            <TabsTrigger value="bulk_uploaded" className="gap-2">
              <Upload className="w-4 h-4" />
              Bulk Uploaded
              {(bulkUploadedCount.data ?? 0) > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {bulkUploadedCount.data}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="family_members" className="gap-2">
              <Users className="w-4 h-4" />
              Family Members
            </TabsTrigger>
            <TabsTrigger value="pending_missing_email" className="gap-2">
              <AlertCircle className="w-4 h-4" />
              Missing Email
              {(pendingCount.data ?? 0) > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                  {pendingCount.data}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="duplicates" className="gap-2">
              <Users className="w-4 h-4" />
              Duplicates
              {(duplicatesCount.data ?? 0) > 0 && (
                <Badge variant="outline" className="ml-1 h-5 px-1.5 text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
                  {duplicatesCount.data}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Family Members Tab */}
          <TabsContent value="family_members">
            <FamilyMembersTab 
              marketplaces={marketplaces}
              searchQuery={searchQuery}
              eventFilter={eventFilter}
            />
          </TabsContent>

          <TabsContent value={activeTab === 'family_members' ? '__none__' : activeTab}>
            <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : filteredVolunteers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>
                    {activeTab === 'pending_missing_email' 
                      ? 'No pending volunteers with missing emails'
                      : activeTab === 'bulk_uploaded' 
                        ? 'No bulk uploaded volunteers' 
                        : activeTab === 'duplicates'
                          ? 'No duplicate submissions to review'
                          : (eventFilter !== 'all' ? 'No volunteers for this event' : 'No approved volunteers')}
                  </p>
                </div>
              ) : (
                <div>
                  {filteredVolunteers.length > 0 && (
                    <div className="flex items-center gap-4 p-4 border-b border-border bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedIds.size === filteredVolunteers.length && filteredVolunteers.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                        <span className="text-sm text-muted-foreground">
                          {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
                        </span>
                      </div>
                      {selectedIds.size > 0 && (
                        <>
                          <Button
                            size="sm"
                            onClick={handleBulkResend}
                            disabled={bulkResendMutation.isPending || bulkDeleteMutation.isPending}
                            className="gap-2"
                          >
                            {bulkResendMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            Send Emails ({selectedIds.size})
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleBulkDelete}
                            disabled={bulkDeleteMutation.isPending || bulkResendMutation.isPending}
                            className="gap-2"
                          >
                            {bulkDeleteMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            Delete ({selectedIds.size})
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow>
                        {activeTab !== 'pending_missing_email' && activeTab !== 'duplicates' && <TableHead className="w-10"></TableHead>}
                        <TableHead className="w-[18%] min-w-[100px]">Name</TableHead>
                        {activeTab === 'pending_missing_email' ? (
                          <>
                            <TableHead className="w-[15%]">Phone</TableHead>
                            <TableHead className="hidden md:table-cell w-[20%]">Events</TableHead>
                            <TableHead className="hidden sm:table-cell w-[14%]">Submitted</TableHead>
                            <TableHead className="text-right w-[20%]">Actions</TableHead>
                          </>
                        ) : activeTab === 'duplicates' ? (
                          <>
                            <TableHead className="w-[22%] min-w-[120px]">Email</TableHead>
                            <TableHead className="hidden md:table-cell w-[18%]">Original Volunteer</TableHead>
                            <TableHead className="hidden lg:table-cell w-[15%]">New Events</TableHead>
                            <TableHead className="hidden sm:table-cell w-[12%]">Submitted</TableHead>
                            <TableHead className="text-right w-[18%]">Actions</TableHead>
                          </>
                        ) : (
                          <>
                            <TableHead className="w-[22%] min-w-[120px]">Email</TableHead>
                            <TableHead className="hidden md:table-cell w-[14%]">Company</TableHead>
                            <TableHead className="hidden lg:table-cell w-[10%]">Family</TableHead>
                            <TableHead className="hidden lg:table-cell w-[8%]">Events</TableHead>
                            <TableHead className="hidden sm:table-cell w-[14%]">Submitted</TableHead>
                            <TableHead className="hidden md:table-cell w-[12%]">Email Status</TableHead>
                            <TableHead className="text-right w-[14%]">Actions</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {filteredVolunteers.map((volunteer) => (
                          <React.Fragment key={volunteer.id}>
                          <motion.tr
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="group"
                          >
                            {activeTab === 'pending_missing_email' ? (
                              <>
                                <TableCell className="font-medium">
                                  {volunteer.first_name} {volunteer.last_name}
                                </TableCell>
                                <TableCell className="text-muted-foreground">
                                  {volunteer.phone_number || '—'}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <span className="text-sm text-muted-foreground truncate block max-w-[150px]" title={volunteer.events_list || ''}>
                                    {volunteer.events_list?.split(',').map(e => formatEventName(e.trim())).join(', ') || '—'}
                                  </span>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                                  {new Date(volunteer.created_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <TooltipProvider delayDuration={200}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => openDetailsDialog(volunteer)}
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>View Details</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setAddEmailVolunteer(volunteer);
                                        setNewEmail('');
                                        setShowAddEmailDialog(true);
                                      }}
                                      className="gap-1"
                                    >
                                      <Mail className="w-3.5 h-3.5" />
                                      Add Email
                                    </Button>
                                    <TooltipProvider delayDuration={200}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(volunteer)}
                                            disabled={deleteMutation.isPending}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Delete</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </TableCell>
                              </>
                            ) : activeTab === 'duplicates' ? (
                              <>
                                <TableCell className="font-medium">
                                  {volunteer.first_name} {volunteer.last_name}
                                </TableCell>
                                <TableCell className="text-muted-foreground truncate max-w-[120px]" title={volunteer.email}>
                                  {volunteer.email}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  {(() => {
                                    const sourceData = volunteer.source_data as { original_volunteer_name?: string; original_volunteer_id?: string } | null;
                                    return sourceData?.original_volunteer_name ? (
                                      <span className="text-sm text-muted-foreground truncate block max-w-[150px]" title={sourceData.original_volunteer_name}>
                                        {sourceData.original_volunteer_name}
                                      </span>
                                    ) : (
                                      <span className="text-sm text-muted-foreground">—</span>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  <span className="text-sm text-muted-foreground truncate block max-w-[100px]" title={volunteer.events_list || ''}>
                                    {volunteer.events_list?.split(',').map(e => formatEventName(e.trim())).join(', ') || '—'}
                                  </span>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                                  {new Date(volunteer.created_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-right">
                                  <TooltipProvider delayDuration={200}>
                                    <div className="flex items-center justify-end gap-1">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => openDetailsDialog(volunteer)}
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>View Details</TooltipContent>
                                      </Tooltip>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 gap-1 text-xs"
                                        onClick={async () => {
                                          setDuplicateToApply(volunteer);
                                          // Fetch original volunteer
                                          const sourceData = volunteer.source_data as { original_volunteer_id?: string } | null;
                                          if (sourceData?.original_volunteer_id) {
                                            const { data } = await supabase
                                              .from('pending_volunteers')
                                              .select('*')
                                              .eq('id', sourceData.original_volunteer_id)
                                              .single();
                                            setOriginalVolunteer(data as PendingVolunteer | null);
                                          }
                                          setShowApplyChangesDialog(true);
                                        }}
                                      >
                                        <Check className="w-3 h-3" />
                                        Apply
                                      </Button>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(volunteer)}
                                            disabled={deleteMutation.isPending}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Delete</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TooltipProvider>
                                </TableCell>
                              </>
                            ) : (
                              <>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedIds.has(volunteer.id)}
                                    onCheckedChange={() => toggleSelect(volunteer.id)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium truncate max-w-[140px]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate">{volunteer.first_name} {volunteer.last_name?.charAt(0)}.</span>
                                    {activeTab === 'approved' && volunteer.source === 'bulk_upload' && (
                                      <Badge variant="outline" className="h-4 px-1 text-[10px] font-medium bg-blue-500/10 text-blue-600 border-blue-500/30 shrink-0">
                                        Bulk
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground truncate max-w-[120px]" title={volunteer.email}>
                                  {volunteer.email}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <span className="text-sm text-muted-foreground truncate block max-w-[100px]">
                                    {volunteer.is_employee ? 'Dubai Holding' : (volunteer.external_company || 'Not specified')}
                                  </span>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  {(() => {
                                    const deps = extractUniqueDependents(volunteer.events_json);
                                    const familyCards = (volunteer.volunteer_qr_cards || []).filter(
                                      (c) => /-F\d+/.test(c.unique_id)
                                    );
                                    if (deps.length === 0 && familyCards.length === 0) {
                                      return <span className="text-sm text-muted-foreground">—</span>;
                                    }
                                    const count = Math.max(deps.length, familyCards.length);
                                    const isExpanded = expandedVolunteers.has(volunteer.id);
                                    return (
                                      <button
                                        className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedVolunteers(prev => {
                                            const next = new Set(prev);
                                            if (next.has(volunteer.id)) {
                                              next.delete(volunteer.id);
                                            } else {
                                              next.add(volunteer.id);
                                            }
                                            return next;
                                          });
                                        }}
                                      >
                                        {isExpanded ? (
                                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        ) : (
                                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        )}
                                        <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <span>{count}</span>
                                      </button>
                                    );
                                  })()}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  <span className="text-sm text-muted-foreground">
                                    {volunteer.events_list?.split(',').length || 0}
                                  </span>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                                  {new Date(volunteer.created_at).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <div className="flex flex-col gap-0.5">
                                    {volunteer.email_opened ? (
                                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 w-fit text-xs px-1.5 py-0">
                                        <MailOpen className="w-3 h-3 mr-0.5" />
                                        Opened
                                      </Badge>
                                    ) : volunteer.email_sent ? (
                                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 w-fit text-xs px-1.5 py-0">
                                        <Check className="w-3 h-3 mr-0.5" />
                                        Sent
                                      </Badge>
                                    ) : volunteer.email_send_count && volunteer.email_send_count > 0 ? (
                                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 w-fit text-xs px-1.5 py-0">
                                        <X className="w-3 h-3 mr-0.5" />
                                        Failed
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-muted text-muted-foreground w-fit text-xs px-1.5 py-0">
                                        <Clock className="w-3 h-3 mr-0.5" />
                                        Not sent
                                      </Badge>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <TooltipProvider delayDuration={200}>
                                    <div className="flex items-center justify-end gap-1">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => openDetailsDialog(volunteer)}
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>View Details</TooltipContent>
                                      </Tooltip>
                                      <DropdownMenu>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <DropdownMenuTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                              >
                                                <Mail className="w-3.5 h-3.5" />
                                              </Button>
                                            </DropdownMenuTrigger>
                                          </TooltipTrigger>
                                          <TooltipContent>Email Actions</TooltipContent>
                                        </Tooltip>
                                        <DropdownMenuContent align="end" className="w-48">
                                          <DropdownMenuItem
                                            onClick={() => resendEmailMutation.mutate(volunteer.id)}
                                            disabled={resendEmailMutation.isPending}
                                          >
                                            {resendEmailMutation.isPending ? (
                                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                              <Mail className="w-4 h-4 mr-2" />
                                            )}
                                            Resend Welcome Email
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setResendingSurveyId(volunteer.id);
                                              resendSurveyMutation.mutate(volunteer);
                                            }}
                                            disabled={resendingSurveyId === volunteer.id || !(volunteer.volunteer_qr_cards?.length)}
                                          >
                                            {resendingSurveyId === volunteer.id ? (
                                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                              <Send className="w-4 h-4 mr-2" />
                                            )}
                                            Resend Survey
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setReminderDialogVolunteer(volunteer);
                                              setReminderTemplateId('');
                                            }}
                                            disabled={sendingReminderId === volunteer.id}
                                          >
                                            {sendingReminderId === volunteer.id ? (
                                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            ) : (
                                              <RefreshCw className="w-4 h-4 mr-2" />
                                            )}
                                            Send Reminder
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => {
                                              setCertificatePreviewVolunteer(volunteer);
                                              setShowCertificatePreview(true);
                                            }}
                                          >
                                            <Award className="w-4 h-4 mr-2" />
                                            Resend Certificate
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(volunteer)}
                                            disabled={deleteMutation.isPending}
                                          >
                                            {deleteMutation.isPending ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <Trash2 className="w-3.5 h-3.5" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Delete</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TooltipProvider>
                                </TableCell>
                              </>
                            )}
                          </motion.tr>
                          {/* Family member sub-rows */}
                          {expandedVolunteers.has(volunteer.id) && (() => {
                            const familyCards = (volunteer.volunteer_qr_cards || []).filter(
                              (c) => /-F\d+/.test(c.unique_id)
                            );
                            if (familyCards.length === 0) return null;
                            const deps = extractUniqueDependents(volunteer.events_json);
                            const sortedCards = [...familyCards].sort((a, b) => {
                              const aIdx = parseInt(a.unique_id.match(/-F(\d)/)?.[1] || '0', 10);
                              const bIdx = parseInt(b.unique_id.match(/-F(\d)/)?.[1] || '0', 10);
                              return aIdx - bIdx;
                            });
                            return sortedCards.map((fc, posIdx) => {
                               const fMatch = fc.unique_id.match(/-F(\d)/);
                               const familyIndex = fMatch ? parseInt(fMatch[1], 10) : 0;
                              let memberName = '';
                              if (deps.length > 0 && familyIndex > 0 && familyIndex <= deps.length) {
                                memberName = deps[familyIndex - 1].name;
                              }
                              if (!memberName && deps.length > 0 && posIdx < deps.length) {
                                memberName = deps[posIdx].name;
                              }
                              if (!memberName) {
                                const volName = `${volunteer.first_name} ${volunteer.last_name}`;
                                memberName = `Family of ${volName}`;
                              }
                              const isCertSent = !!fc.survey_completed_at;
                              return (
                                <tr key={fc.id} className="bg-muted/30 border-b border-muted/50">
                                  <TableCell className="py-2" />
                                  <TableCell className="py-2 pl-8">
                                    <div className="flex items-center gap-2">
                                      <User className="w-3 h-3 text-muted-foreground" />
                                      <span className="text-sm">{memberName}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <span className="text-xs font-mono text-muted-foreground">{fc.unique_id}</span>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell py-2" />
                                  <TableCell className="hidden lg:table-cell py-2" />
                                  <TableCell className="hidden lg:table-cell py-2" />
                                  <TableCell className="hidden sm:table-cell py-2">
                                    {isCertSent ? (
                                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs px-1.5 py-0">
                                        <Check className="w-3 h-3 mr-0.5" />
                                        Cert Sent
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-muted text-muted-foreground text-xs px-1.5 py-0">
                                        <Clock className="w-3 h-3 mr-0.5" />
                                        Not Sent
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell py-2" />
                                  <TableCell className="py-2">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={() => {
                                            const nameParts = memberName.split(' ');
                                            const firstName = nameParts[0] || memberName;
                                            const lastName = nameParts.slice(1).join(' ') || '';
                                            setCertificatePreviewVolunteer({
                                              ...volunteer,
                                              first_name: firstName,
                                              last_name: lastName,
                                              certificate_sent_at: fc.survey_completed_at || null,
                                            });
                                            setShowCertificatePreview(true);
                                          }}
                                        >
                                          <Award className="w-3.5 h-3.5" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>View Certificate</TooltipContent>
                                    </Tooltip>
                                  </TableCell>
                                </tr>
                              );
                            });
                          })()}
                          </React.Fragment>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={(open) => {
        setShowDetailsDialog(open);
        if (!open) setIsEditMode(false);
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit Volunteer' : 'Volunteer Application Details'}</DialogTitle>
            <DialogDescription>
              {isEditMode 
                ? 'Update the volunteer information below'
                : 'Review the volunteer\'s information'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedVolunteer && !isEditMode && (
            <div className="space-y-6">
              {/* Personal Info */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{selectedVolunteer.first_name} {selectedVolunteer.last_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm break-all">{selectedVolunteer.email || '(No email)'}</span>
                  </div>
                  {selectedVolunteer.phone_number && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedVolunteer.phone_number}</span>
                    </div>
                  )}
                  {selectedVolunteer.gender && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Gender:</span> {selectedVolunteer.gender}
                    </div>
                  )}
                </div>
              </div>

              {/* QR Codes Section */}
              {selectedVolunteer.volunteer_qr_cards && selectedVolunteer.volunteer_qr_cards.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
                    <QrCode className="w-4 h-4" />
                    QR Codes ({selectedVolunteer.volunteer_qr_cards.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedVolunteer.volunteer_qr_cards.map((card, idx) => {
                      const isFamily = /-F\d+[A-Z0-9]+$/.test(card.unique_id);
                      return (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="text-xs font-mono bg-background px-2 py-1 rounded">{card.unique_id}</code>
                            {isFamily ? (
                              <Badge variant="outline" className="bg-teal-500/10 text-teal-600 border-teal-500/30 text-xs">
                                <Users className="w-3 h-3 mr-1" />
                                Family
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/30 text-xs">
                                <User className="w-3 h-3 mr-1" />
                                Volunteer
                              </Badge>
                            )}
                            <Badge variant={card.status === 'checked_in' ? 'default' : 'secondary'} className="text-xs">
                              {card.status}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => {
                              navigator.clipboard.writeText(card.unique_id);
                              toast({ title: 'QR code copied!' });
                            }}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Training Status */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  Training Status
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {selectedVolunteer.training_completed ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-amber-500" />
                    )}
                    <span>
                      Training: {selectedVolunteer.training_completed 
                        ? `Completed (${new Date(selectedVolunteer.training_completed_at!).toLocaleDateString()})`
                        : 'Not completed'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedVolunteer.certificate_sent_at ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span>
                      Certificate: {selectedVolunteer.certificate_sent_at 
                        ? `Sent (${new Date(selectedVolunteer.certificate_sent_at).toLocaleDateString()})`
                        : 'Not sent'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Family Members */}
              {(() => {
                const deps = extractUniqueDependents(selectedVolunteer.events_json);
                if (deps.length === 0) return null;
                // Get family QR cards for matching
                const familyCards = (selectedVolunteer.volunteer_qr_cards || []).filter(c => /-F\d+[A-Z0-9]+$/.test(c.unique_id));
                return (
                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Family Members ({deps.length})
                    </h3>
                    <div className="space-y-2">
                      {deps.map((dep, idx) => {
                        // Try to match family card by index (F1, F2, etc.)
                        const matchingCard = familyCards.find(c => {
                          const match = c.unique_id.match(/-F(\d)[A-Z0-9]+$/);
                          return match && parseInt(match[1]) === idx + 1;
                        });
                        return (
                          <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={dep.type === 'adult' ? 'default' : 'secondary'} className="text-xs">
                                {dep.type === 'adult' ? 'Adult' : 'Child'}
                              </Badge>
                              <span className="font-medium">{dep.name}</span>
                              {dep.gender && <span className="text-muted-foreground text-sm">({dep.gender})</span>}
                            </div>
                            {matchingCard && (
                              <div className="flex items-center gap-1">
                                <code className="text-xs font-mono bg-background px-2 py-0.5 rounded text-muted-foreground">
                                  {matchingCard.unique_id}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    navigator.clipboard.writeText(matchingCard.unique_id);
                                    toast({ title: 'Family QR code copied!' });
                                  }}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Company Info */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Employment
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedVolunteer.is_employee ? 'Dubai Holding' : (selectedVolunteer.external_company || 'Not specified')}</span>
                  </div>
                  {selectedVolunteer.is_employee && selectedVolunteer.employee_vertical && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Department:</span> {selectedVolunteer.employee_vertical}
                    </div>
                  )}
                  {selectedVolunteer.is_employee && selectedVolunteer.employee_number && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Employee #:</span> {selectedVolunteer.employee_number}
                    </div>
                  )}
                  {selectedVolunteer.employee_join_date && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Date of Joining:</span> {selectedVolunteer.employee_join_date}
                    </div>
                  )}
                </div>
              </div>

              {/* Emergency Contact */}
              {selectedVolunteer.emergency_contact_name && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">Emergency Contact</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Name:</span> {selectedVolunteer.emergency_contact_name}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Relationship:</span> {selectedVolunteer.emergency_contact_relationship}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span> {selectedVolunteer.emergency_contact_number}
                    </div>
                  </div>
                </div>
              )}

              {/* Medical & Other */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">Additional Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    {selectedVolunteer.has_medical_condition ? (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Check className="w-4 h-4 text-emerald-500" />
                    )}
                    <span>
                      {selectedVolunteer.has_medical_condition 
                        ? `Medical Condition: ${selectedVolunteer.medical_condition_details || 'Yes'}`
                        : 'No medical conditions'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fasting:</span> {selectedVolunteer.is_fasting ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>

              {/* Events */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <CalendarLucide className="w-4 h-4" />
                    Registered Events ({selectedVolunteer.events_list?.split(',').filter(e => e.trim()).length || 0})
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddEventDialog(true)}
                    className="h-7 text-xs gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add Event
                  </Button>
                </div>
                {selectedVolunteer.events_list ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedVolunteer.events_list.split(',').map((event, idx) => {
                      const slug = event.trim();
                      const name = formatEventName(slug);
                      return (
                        <Badge key={idx} variant="secondary" className="flex items-center gap-1 pr-1">
                          {name}
                          <button
                            onClick={() => {
                              setEventToRemove({ slug, name });
                              setShowRemoveEventDialog(true);
                            }}
                            className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors"
                            title={`Remove ${name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No events registered</p>
                )}
              </div>

              {/* Raw Webhook Data - Collapsible */}
              {selectedVolunteer.source_data && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-muted rounded-lg transition-colors group">
                    <Code className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Raw Webhook Data</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto group-data-[state=open]:rotate-180 transition-transform" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ScrollArea className="h-[300px] mt-2">
                      <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto font-mono whitespace-pre-wrap break-all">
                        {JSON.stringify(selectedVolunteer.source_data, null, 2)}
                      </pre>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Rejection reason if rejected */}
              {selectedVolunteer.status === 'rejected' && selectedVolunteer.rejection_reason && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h3 className="font-semibold text-sm text-red-600 mb-2">Rejection Reason</h3>
                  <p className="text-sm">{selectedVolunteer.rejection_reason}</p>
                </div>
              )}
            </div>
          )}

          {/* Edit Mode Form */}
          {selectedVolunteer && isEditMode && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First Name</Label>
                  <Input
                    value={editForm.first_name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name</Label>
                  <Input
                    value={editForm.last_name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editForm.phone_number}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone_number: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Gender</Label>
                  <Select 
                    value={editForm.gender || 'none'} 
                    onValueChange={(v) => setEditForm(prev => ({ ...prev, gender: v === 'none' ? '' : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not specified</SelectItem>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input
                    value={editForm.external_company}
                    onChange={(e) => setEditForm(prev => ({ ...prev, external_company: e.target.value }))}
                    placeholder="External company"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department/Vertical</Label>
                  <Input
                    value={editForm.employee_vertical}
                    onChange={(e) => setEditForm(prev => ({ ...prev, employee_vertical: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Employee Number</Label>
                  <Input
                    value={editForm.employee_number}
                    onChange={(e) => setEditForm(prev => ({ ...prev, employee_number: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dialog Footer - Different based on mode and status */}
          {selectedVolunteer && isEditMode ? (
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={editVolunteerMutation.isPending}
              >
                {editVolunteerMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          ) : selectedVolunteer?.status === 'pending' ? (
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartEdit}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                onClick={() => openRejectDialog(selectedVolunteer)}
                className="text-red-600 border-red-500/30 hover:bg-red-500/10"
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={() => handleApprove(selectedVolunteer)}
                disabled={approveMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {approveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Approve & Create Account
              </Button>
            </DialogFooter>
          ) : selectedVolunteer && (
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartEdit}
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => {
                  setShowDetailsDialog(false);
                  handleDelete(selectedVolunteer);
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to reject {selectedVolunteer?.first_name}'s application?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <X className="w-4 h-4 mr-2" />
              )}
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credentials Dialog */}
      <Dialog open={showCredentialsDialog} onOpenChange={setShowCredentialsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Account Credentials</DialogTitle>
            <DialogDescription>
              {approvedCredentials?.emailSent 
                ? 'A welcome email with these credentials has been sent to the volunteer.'
                : 'Share these credentials with the volunteer so they can log in.'}
            </DialogDescription>
          </DialogHeader>
          {approvedCredentials && (
            <div className="space-y-4">
              {approvedCredentials.emailSent && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <Mail className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm text-emerald-600 font-medium">Welcome email sent successfully</span>
                </div>
              )}
              {!approvedCredentials.emailSent && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-600">Email could not be sent - please share credentials manually</span>
                </div>
              )}
              <div className="bg-muted rounded-lg p-4 space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Email</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={approvedCredentials.email} readOnly className="font-mono" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(approvedCredentials.email);
                        toast({ title: 'Email copied!' });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Temporary Password</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input value={approvedCredentials.password} readOnly className="font-mono" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(approvedCredentials.password);
                        toast({ title: 'Password copied!' });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                The volunteer should change their password after first login.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowCredentialsDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certificate Preview Dialog */}
      {certificatePreviewVolunteer && (
        <CertificatePreviewDialog
          open={showCertificatePreview}
          onOpenChange={setShowCertificatePreview}
          firstName={certificatePreviewVolunteer.first_name}
          lastName={certificatePreviewVolunteer.last_name}
          trainingCompleted={certificatePreviewVolunteer.training_completed ?? false}
          surveyCompleted={!!certificatePreviewVolunteer.certificate_sent_at}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this volunteer?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete{' '}
              <span className="font-semibold">
                {volunteerToDelete?.first_name} {volunteerToDelete?.last_name}
              </span>{' '}
              ({volunteerToDelete?.email}) and their user account from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVolunteerToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteConfirmDialog} onOpenChange={setShowBulkDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete {selectedIds.size} volunteer(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected volunteers and their user accounts from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedIds.size} volunteer(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Email Dialog */}
      <Dialog open={showAddEmailDialog} onOpenChange={(open) => {
        setShowAddEmailDialog(open);
        if (!open) {
          setAddEmailVolunteer(null);
          setNewEmail('');
        }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base">Add Email Address</DialogTitle>
            <DialogDescription className="text-xs">
              Enter email to create volunteer account.
            </DialogDescription>
          </DialogHeader>
          
          {addEmailVolunteer && (
            <div className="space-y-3">
              <div className="bg-muted/50 rounded-md p-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium truncate">{addEmailVolunteer.first_name} {addEmailVolunteer.last_name}</span>
                </div>
                {addEmailVolunteer.phone_number && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{addEmailVolunteer.phone_number}</span>
                  </div>
                )}
                {addEmailVolunteer.events_list && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CalendarLucide className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{addEmailVolunteer.events_list.split(',').map(e => formatEventName(e.trim())).join(', ')}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email Address</label>
                <Input
                  type="email"
                  placeholder="volunteer@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="h-9"
                  autoFocus
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEmailDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (addEmailVolunteer && newEmail.trim()) {
                  addEmailMutation.mutate({ pendingId: addEmailVolunteer.id, email: newEmail.trim() });
                }
              }}
              disabled={!newEmail.trim() || !newEmail.includes('@') || addEmailMutation.isPending}
            >
              {addEmailMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Add Email & Create Account'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Report Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export Volunteer Report</DialogTitle>
            <DialogDescription>
              Use a date range or select a marketplace to export volunteer data
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !exportStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {exportStartDate ? format(exportStartDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={exportStartDate}
                    onSelect={setExportStartDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !exportEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {exportEndDate ? format(exportEndDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={exportEndDate}
                    onSelect={setExportEndDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Or Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium uppercase">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Marketplace Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Marketplace</label>
              <Select value={exportMarketplace} onValueChange={setExportMarketplace}>
                <SelectTrigger>
                  <SelectValue placeholder="All Marketplaces" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Marketplaces</SelectItem>
                  {marketplaces.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Export Format Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Export Format</label>
              <RadioGroup 
                value={exportFormat} 
                onValueChange={(value) => setExportFormat(value as ExportFormat)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="excel" id="format-excel" />
                  <Label htmlFor="format-excel" className="flex items-center gap-2 cursor-pointer">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    Excel (.xlsx)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="format-csv" />
                  <Label htmlFor="format-csv" className="flex items-center gap-2 cursor-pointer">
                    <FileText className="w-4 h-4 text-blue-600" />
                    CSV (.csv)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {exportStartDate && exportEndDate && (
              <p className="text-sm text-muted-foreground">
                Export will include volunteers from {format(exportStartDate, "MMM d, yyyy")} to {format(exportEndDate, "MMM d, yyyy")}
                {exportMarketplace !== 'all' && ` for ${marketplaces.find(m => m.id === exportMarketplace)?.name || ''}`}
              </p>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleExportReport}
              disabled={!exportStartDate || !exportEndDate || isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  {exportFormat === 'excel' ? <FileSpreadsheet className="w-4 h-4 mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                  Export {exportFormat === 'excel' ? 'Excel' : 'CSV'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Changes Dialog for Duplicates */}
      <Dialog open={showApplyChangesDialog} onOpenChange={(open) => {
        setShowApplyChangesDialog(open);
        if (!open) {
          setDuplicateToApply(null);
          setOriginalVolunteer(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply Changes from Duplicate Submission</DialogTitle>
            <DialogDescription>
              Review and apply changes from the new submission to the original volunteer record.
            </DialogDescription>
          </DialogHeader>
          
          {duplicateToApply && (
            <div className="space-y-4">
              {/* Comparison Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">Original Record</h4>
                  <div className="bg-muted/50 rounded-md p-3 space-y-2 text-sm">
                    {originalVolunteer ? (
                      <>
                        <p><strong>Name:</strong> {originalVolunteer.first_name} {originalVolunteer.last_name}</p>
                        <p><strong>Email:</strong> {originalVolunteer.email}</p>
                        <p><strong>Phone:</strong> {originalVolunteer.phone_number || '—'}</p>
                        <p><strong>Gender:</strong> {originalVolunteer.gender || '—'}</p>
                        <p><strong>Employee:</strong> {originalVolunteer.is_employee ? 'Yes' : 'No'}</p>
                        <p><strong>Events:</strong> {originalVolunteer.events_list?.split(',').map(e => formatEventName(e.trim())).join(', ') || '—'}</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground italic">Loading original record...</p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-amber-600">New Submission</h4>
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md p-3 space-y-2 text-sm">
                    <p><strong>Name:</strong> {duplicateToApply.first_name} {duplicateToApply.last_name}</p>
                    <p><strong>Email:</strong> {duplicateToApply.email}</p>
                    <p><strong>Phone:</strong> {duplicateToApply.phone_number || '—'}</p>
                    <p><strong>Gender:</strong> {duplicateToApply.gender || '—'}</p>
                    <p><strong>Employee:</strong> {duplicateToApply.is_employee ? 'Yes' : 'No'}</p>
                    <p><strong>Events:</strong> {duplicateToApply.events_list?.split(',').map(e => formatEventName(e.trim())).join(', ') || '—'}</p>
                  </div>
                </div>
              </div>
              
              {/* Changes Summary */}
              {originalVolunteer && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                  <h4 className="font-medium text-sm text-blue-700 dark:text-blue-400 mb-2">Changes that will be applied:</h4>
                  <ul className="text-sm text-blue-600 dark:text-blue-300 space-y-1">
                    {duplicateToApply.phone_number !== originalVolunteer.phone_number && duplicateToApply.phone_number && (
                      <li>• Phone: {originalVolunteer.phone_number || 'empty'} → {duplicateToApply.phone_number}</li>
                    )}
                    {duplicateToApply.gender !== originalVolunteer.gender && duplicateToApply.gender && (
                      <li>• Gender: {originalVolunteer.gender || 'empty'} → {duplicateToApply.gender}</li>
                    )}
                    {duplicateToApply.events_list !== originalVolunteer.events_list && duplicateToApply.events_list && (
                      <li>• Events will be updated with new registrations</li>
                    )}
                    {duplicateToApply.emergency_contact_name !== originalVolunteer.emergency_contact_name && duplicateToApply.emergency_contact_name && (
                      <li>• Emergency contact will be updated</li>
                    )}
                    {!duplicateToApply.phone_number && duplicateToApply.phone_number === originalVolunteer.phone_number &&
                     !duplicateToApply.gender && duplicateToApply.gender === originalVolunteer.gender &&
                     duplicateToApply.events_list === originalVolunteer.events_list && (
                      <li className="italic">No significant changes detected</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowApplyChangesDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (duplicateToApply) {
                  deleteMutation.mutate(duplicateToApply.id);
                  setShowApplyChangesDialog(false);
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Discard Duplicate
            </Button>
            <Button
              onClick={async () => {
                if (!duplicateToApply || !originalVolunteer) return;
                setApplyingChanges(true);
                
                try {
                  // Update original volunteer with new data
                  const updateData: Record<string, unknown> = {};
                  
                  if (duplicateToApply.phone_number && duplicateToApply.phone_number !== originalVolunteer.phone_number) {
                    updateData.phone_number = duplicateToApply.phone_number;
                  }
                  if (duplicateToApply.gender && duplicateToApply.gender !== originalVolunteer.gender) {
                    updateData.gender = duplicateToApply.gender;
                  }
                  if (duplicateToApply.emergency_contact_name) {
                    updateData.emergency_contact_name = duplicateToApply.emergency_contact_name;
                    updateData.emergency_contact_number = duplicateToApply.emergency_contact_number;
                    updateData.emergency_contact_relationship = duplicateToApply.emergency_contact_relationship;
                  }
                  
                  // Merge events lists
                  if (duplicateToApply.events_list && duplicateToApply.events_list !== originalVolunteer.events_list) {
                    const originalEvents = new Set((originalVolunteer.events_list || '').split(',').map(e => e.trim()).filter(Boolean));
                    const newEvents = duplicateToApply.events_list.split(',').map(e => e.trim()).filter(Boolean);
                    newEvents.forEach(e => originalEvents.add(e));
                    updateData.events_list = Array.from(originalEvents).join(',');
                    
                    // Merge events_json if present
                    if (duplicateToApply.events_json && Array.isArray(duplicateToApply.events_json)) {
                      const originalEventsJson = Array.isArray(originalVolunteer.events_json) ? originalVolunteer.events_json : [];
                      const existingSlugs = new Set(originalEventsJson.map((e: { event?: string }) => e.event));
                      const newEventsToAdd = (duplicateToApply.events_json as Array<{ event?: string }>).filter(e => !existingSlugs.has(e.event));
                      updateData.events_json = [...originalEventsJson, ...newEventsToAdd];
                    }
                  }
                  
                  if (Object.keys(updateData).length > 0) {
                    const { error: updateError } = await supabase
                      .from('pending_volunteers')
                      .update(updateData)
                      .eq('id', originalVolunteer.id);
                    
                    if (updateError) throw updateError;
                  }
                  
                  // Delete the duplicate record
                  const { error: deleteError } = await supabase
                    .from('pending_volunteers')
                    .delete()
                    .eq('id', duplicateToApply.id);
                  
                  if (deleteError) throw deleteError;
                  
                  queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
                  queryClient.invalidateQueries({ queryKey: ['duplicate-volunteers-count'] });
                  
                  toast({
                    title: 'Changes Applied',
                    description: `Updated ${originalVolunteer.first_name}'s record and removed the duplicate.`,
                  });
                  
                  setShowApplyChangesDialog(false);
                  setDuplicateToApply(null);
                  setOriginalVolunteer(null);
                } catch (error) {
                  toast({
                    title: 'Failed to Apply Changes',
                    description: error instanceof Error ? error.message : 'Unknown error',
                    variant: 'destructive',
                  });
                } finally {
                  setApplyingChanges(false);
                }
              }}
              disabled={applyingChanges || !originalVolunteer}
            >
              {applyingChanges ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Apply Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Event Dialog */}
      <Dialog open={showAddEventDialog} onOpenChange={(open) => {
        setShowAddEventDialog(open);
        if (!open) setSelectedEventsToAdd([]);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Events to Registration</DialogTitle>
            <DialogDescription>
              Select one or more events to add to {selectedVolunteer?.first_name}'s registration.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {(() => {
              const currentEvents = selectedVolunteer?.events_list
                ?.split(',')
                .map(e => formatEventName(e.trim())) || [];
              const availableMarketplaces = marketplaces.filter(m =>
                !currentEvents.includes(m.name)
              );
              const allNames = availableMarketplaces.map(m => m.name);
              const allSelected = allNames.length > 0 && allNames.every(n => selectedEventsToAdd.includes(n));

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Select Events</Label>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">{selectedEventsToAdd.length} selected</span>
                      {availableMarketplaces.length > 0 && (
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => setSelectedEventsToAdd(allSelected ? [] : allNames)}
                        >
                          {allSelected ? 'Clear all' : 'Select all'}
                        </button>
                      )}
                    </div>
                  </div>

                  {availableMarketplaces.length === 0 ? (
                    <div className="rounded-md border p-4 text-sm text-muted-foreground text-center">
                      No additional events available
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
                      {availableMarketplaces.map(marketplace => {
                        const checked = selectedEventsToAdd.includes(marketplace.name);
                        return (
                          <label
                            key={marketplace.id}
                            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setSelectedEventsToAdd(prev =>
                                  v ? [...prev, marketplace.name] : prev.filter(n => n !== marketplace.name)
                                );
                              }}
                            />
                            <div className="flex-1 text-sm">
                              <span>{marketplace.name}</span>
                              {marketplace.event_date && (
                                <span className="text-muted-foreground ml-2">
                                  ({new Date(marketplace.event_date).toLocaleDateString()})
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEventDialog(false)} disabled={isAddingEvents}>
              Cancel
            </Button>
             <Button
              onClick={async () => {
                if (!selectedVolunteer || selectedEventsToAdd.length === 0) return;
                setIsAddingEvents(true);

                const volunteer = volunteers.find(v => v.id === selectedVolunteer.id);
                if (!volunteer) {
                  setIsAddingEvents(false);
                  toast({ title: 'Volunteer not found', variant: 'destructive' });
                  return;
                }

                const formatMktDate = (dateStr?: string | null) => {
                  if (!dateStr) return null;
                  try {
                    const d = new Date(dateStr);
                    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                  } catch { return null; }
                };
                const formatMktTime = (start?: string | null, end?: string | null) => {
                  if (!start && !end) return null;
                  const fmt = (t: string) => {
                    try {
                      const [h, m] = t.split(':').map(Number);
                      const ampm = h >= 12 ? 'pm' : 'am';
                      const h12 = h % 12 || 12;
                      return `${String(h12).padStart(2, '0')}.${String(m).padStart(2, '0')} ${ampm}`;
                    } catch { return t; }
                  };
                  if (start && end) return `${fmt(start)} - ${fmt(end)}`;
                  return start ? fmt(start) : fmt(end!);
                };

                const currentEvents = volunteer.events_list ? volunteer.events_list.split(',').map(e => e.trim()).filter(Boolean) : [];
                const currentEventsJson = Array.isArray(volunteer.events_json) ? [...volunteer.events_json] as any[] : [];
                const added: string[] = [];
                const skipped: string[] = [];

                for (const name of selectedEventsToAdd) {
                  const eventSlug = name.toLowerCase().replace(/\s+/g, '-');
                  if (currentEvents.some(e => formatEventName(e) === name) || currentEvents.includes(eventSlug)) {
                    skipped.push(name);
                    continue;
                  }
                  const mkt = marketplaces.find(m => m.name === name);
                  currentEvents.push(eventSlug);
                  currentEventsJson.push({
                    event: eventSlug,
                    name: mkt?.name || name,
                    eventDate: formatMktDate(mkt?.event_date),
                    eventTime: formatMktTime(mkt?.start_time, mkt?.end_time),
                    eventLocation: mkt?.location || null,
                    addedManually: true,
                    addedAt: new Date().toISOString(),
                  });
                  added.push(name);
                }

                let errorMsg: string | null = null;
                if (added.length > 0) {
                  const { error } = await supabase
                    .from('pending_volunteers')
                    .update({
                      events_list: currentEvents.join(','),
                      events_json: currentEventsJson,
                    })
                    .eq('id', selectedVolunteer.id);
                  if (error) errorMsg = error.message;
                }

                setIsAddingEvents(false);
                setShowAddEventDialog(false);
                setSelectedEventsToAdd([]);

                if (errorMsg) {
                  toast({ title: 'Failed to Add Events', description: errorMsg, variant: 'destructive' });
                } else if (added.length > 0) {
                  queryClient.invalidateQueries({ queryKey: ['pending-volunteers'] });
                  toast({
                    title: added.length === 1 ? 'Event Added' : 'Events Added',
                    description: `${added.length} event${added.length === 1 ? '' : 's'} added to ${selectedVolunteer.first_name}'s registration${skipped.length ? ` (${skipped.length} already present)` : ''}`,
                  });
                } else if (skipped.length) {
                  toast({ title: 'No new events', description: 'All selected events were already added.' });
                }
              }}
              disabled={selectedEventsToAdd.length === 0 || isAddingEvents}
            >
              {isAddingEvents ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {selectedEventsToAdd.length > 1 ? `Add ${selectedEventsToAdd.length} Events` : 'Add Event'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Surpluss Sync Result Dialog */}
      <Dialog open={showSyncResultDialog} onOpenChange={setShowSyncResultDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Surpluss Sync Results
            </DialogTitle>
            <DialogDescription>
              {syncResult?.marketplace_name ? `Marketplace: ${syncResult.marketplace_name}` : 'Sync complete'}
            </DialogDescription>
          </DialogHeader>
          
          {syncResult && (
            <div className="space-y-4">
              {/* Volunteer Summary Stats */}
              <div>
                <p className="text-sm font-medium mb-2">Volunteers</p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{syncResult.volunteers_total || 0}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{syncResult.volunteers_sent || 0}</p>
                    <p className="text-xs text-muted-foreground">Sent</p>
                  </div>
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{syncResult.volunteers_skipped || 0}</p>
                    <p className="text-xs text-muted-foreground">Skipped</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{syncResult.volunteers_failed || 0}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
              </div>

              {/* Family Members Summary Stats */}
              <div>
                <p className="text-sm font-medium mb-2">Family Members</p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{syncResult.family_total || 0}</p>
                    <p className="text-xs text-muted-foreground">Found</p>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{syncResult.family_sent || 0}</p>
                    <p className="text-xs text-muted-foreground">Sent</p>
                  </div>
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{syncResult.family_skipped || 0}</p>
                    <p className="text-xs text-muted-foreground">Skipped</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{syncResult.family_failed || 0}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Beneficiaries (QR Cards)</p>
                <div className="grid grid-cols-4 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-2xl font-bold">{syncResult.beneficiaries_total || 0}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-center">
                    <p className="text-2xl font-bold text-green-600">{syncResult.beneficiaries_sent || 0}</p>
                    <p className="text-xs text-muted-foreground">Sent</p>
                  </div>
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{syncResult.beneficiaries_skipped || 0}</p>
                    <p className="text-xs text-muted-foreground">Skipped</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-center">
                    <p className="text-2xl font-bold text-red-600">{syncResult.beneficiaries_failed || 0}</p>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
              </div>

              {/* Demographics */}
              <div className="rounded-lg border p-3">
                <p className="text-sm font-medium mb-1">Demographics Update</p>
                <div className="flex items-center gap-2">
                  <Badge variant={(syncResult.demographics_sent || 0) > 0 ? 'default' : 'destructive'}>
                    {(syncResult.demographics_sent || 0) > 0 ? `${syncResult.demographics_sent} Updated` : 'None Updated'}
                  </Badge>
                  {(syncResult.demographics_failed || 0) > 0 && (
                    <Badge variant="destructive">{syncResult.demographics_failed} Failed</Badge>
                  )}
                </div>
              </div>

              {/* Volunteer Details */}
              {syncResult.volunteer_details?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Volunteer Details</p>
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-1">
                      {syncResult.volunteer_details.map((v: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/50">
                          <span className="truncate mr-2">{v.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {v.status === 'sent' && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Sent</Badge>}
                            {v.status === 'skipped' && (
                              <TooltipProvider><Tooltip><TooltipTrigger>
                                <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Skipped</Badge>
                              </TooltipTrigger><TooltipContent><p>{v.reason}</p></TooltipContent></Tooltip></TooltipProvider>
                            )}
                            {v.status === 'bulk_updated' && <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Updated</Badge>}
                            {v.status === 'failed' && (
                              <TooltipProvider><Tooltip><TooltipTrigger>
                                <Badge variant="destructive">Failed</Badge>
                              </TooltipTrigger><TooltipContent className="max-w-xs"><p>{v.reason}</p></TooltipContent></Tooltip></TooltipProvider>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Beneficiary Card Details */}
              {syncResult.beneficiary_card_details?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Beneficiary Details</p>
                  <ScrollArea className="max-h-[200px]">
                    <div className="space-y-1">
                      {syncResult.beneficiary_card_details.map((b: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/50">
                          <span className="truncate mr-2 font-mono text-xs">{b.unique_id}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {b.status === 'sent' && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Sent</Badge>}
                            {b.status === 'skipped' && (
                              <TooltipProvider><Tooltip><TooltipTrigger>
                                <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Skipped</Badge>
                              </TooltipTrigger><TooltipContent><p>{b.reason}</p></TooltipContent></Tooltip></TooltipProvider>
                            )}
                            {b.status === 'failed' && (
                              <TooltipProvider><Tooltip><TooltipTrigger>
                                <Badge variant="destructive">Failed</Badge>
                              </TooltipTrigger><TooltipContent className="max-w-xs"><p>{b.reason}</p></TooltipContent></Tooltip></TooltipProvider>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Errors */}
              {syncResult.errors?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">Errors</p>
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-1 max-h-[150px] overflow-y-auto">
                    {syncResult.errors.map((err: string, i: number) => (
                      <p key={i} className="text-xs text-destructive">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowSyncResultDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Beneficiary Sync Result Dialog */}
      <Dialog open={showBenSyncResultDialog} onOpenChange={setShowBenSyncResultDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Beneficiary Sync Results
            </DialogTitle>
          </DialogHeader>
          
          {benSyncResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{benSyncResult.beneficiaries_total || 0}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{benSyncResult.beneficiaries_sent || 0}</p>
                  <p className="text-xs text-muted-foreground">Sent</p>
                </div>
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-600">{benSyncResult.beneficiaries_skipped || 0}</p>
                  <p className="text-xs text-muted-foreground">Skipped</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-center">
                  <p className="text-2xl font-bold text-red-600">{benSyncResult.beneficiaries_failed || 0}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>

              {(benSyncResult.beneficiaries_bulk_updated || 0) > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3 text-center">
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {benSyncResult.beneficiaries_bulk_updated} Bulk Updated
                  </Badge>
                </div>
              )}

              {benSyncResult.beneficiary_details?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Details</p>
                  <ScrollArea className="max-h-[250px]">
                    <div className="space-y-1">
                      {benSyncResult.beneficiary_details.map((b: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm py-1.5 px-2 rounded hover:bg-muted/50">
                          <span className="truncate mr-2 font-mono text-xs">{b.unique_id}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            {b.status === 'sent' && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Sent</Badge>}
                            {b.status === 'bulk_updated' && <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Updated</Badge>}
                            {b.status === 'skipped' && (
                              <TooltipProvider><Tooltip><TooltipTrigger>
                                <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">Skipped</Badge>
                              </TooltipTrigger><TooltipContent><p>{b.reason}</p></TooltipContent></Tooltip></TooltipProvider>
                            )}
                            {b.status === 'failed' && (
                              <TooltipProvider><Tooltip><TooltipTrigger>
                                <Badge variant="destructive">Failed</Badge>
                              </TooltipTrigger><TooltipContent className="max-w-xs"><p>{b.reason}</p></TooltipContent></Tooltip></TooltipProvider>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {benSyncResult.errors?.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">Errors</p>
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-1 max-h-[150px] overflow-y-auto">
                    {benSyncResult.errors.map((err: string, i: number) => (
                      <p key={i} className="text-xs text-destructive">{err}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowBenSyncResultDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Family Certificates Dialog */}
      <Dialog open={showFamilyCertsDialog} onOpenChange={setShowFamilyCertsDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Send Family Member Certificates</DialogTitle>
            <DialogDescription>Select a completed marketplace to view all family members and their attendance status.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Select
              value={familyCertsMarketplace}
              onValueChange={async (val) => {
                setFamilyCertsMarketplace(val);
                setLoadingFamilyCertsVolunteers(true);
                try {
                  // Get ALL family cards for volunteers who have any card at this marketplace
                  // First get volunteer IDs that have cards at this marketplace
                  const { data: mpCards } = await supabase
                    .from('volunteer_qr_cards')
                    .select('volunteer_id')
                    .eq('marketplace_id', val)
                    .like('unique_id', '%-F%');

                  const volunteerIds = [...new Set((mpCards || []).map(c => c.volunteer_id).filter(Boolean))];

                  if (volunteerIds.length === 0) {
                    setFamilyCertsVolunteers([]);
                    return;
                  }

                  // Now get ALL family cards for these volunteers (any status, any marketplace)
                  const { data: allFamilyCards } = await supabase
                    .from('volunteer_qr_cards')
                    .select(`
                      id, unique_id, status, total_hours_worked, survey_completed_at, marketplace_id, checked_in_at, checked_out_at,
                      volunteer:pending_volunteers!volunteer_qr_cards_volunteer_id_fkey(id, first_name, last_name, email, events_json)
                    `)
                    .in('volunteer_id', volunteerIds)
                    .like('unique_id', '%-F%');

                  if (!allFamilyCards || allFamilyCards.length === 0) {
                    setFamilyCertsVolunteers([]);
                    return;
                  }

                  // Group by volunteer
                  const volMap = new Map<string, { volunteer: any; familyCards: any[] }>();
                  for (const fc of allFamilyCards) {
                    const vol = fc.volunteer as any;
                    if (!vol?.id) continue;
                    if (!volMap.has(vol.id)) {
                      volMap.set(vol.id, { volunteer: vol, familyCards: [] });
                    }
                    volMap.get(vol.id)!.familyCards.push(fc);
                  }
                  setFamilyCertsVolunteers(Array.from(volMap.values()));
                } catch (err) {
                  console.error(err);
                  setFamilyCertsVolunteers([]);
                } finally {
                  setLoadingFamilyCertsVolunteers(false);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a completed marketplace" />
              </SelectTrigger>
              <SelectContent>
                {marketplaces
                  .filter(m => m.status === 'completed')
                  .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''))
                  .map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} {m.event_date ? `(${m.event_date})` : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {loadingFamilyCertsVolunteers && (
              <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            )}

            {!loadingFamilyCertsVolunteers && familyCertsMarketplace && familyCertsVolunteers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No family members found for this marketplace.</p>
            )}

            {!loadingFamilyCertsVolunteers && familyCertsVolunteers.length > 0 && (
              <div className="max-h-[60vh] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Family Member</TableHead>
                      <TableHead>QR Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cert</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {familyCertsVolunteers.map(({ volunteer: vol, familyCards: fCards }) => {
                      const deps = extractUniqueDependents(vol.events_json);
                      return (
                        <React.Fragment key={vol.id}>
                          {/* Volunteer header row */}
                          <TableRow key={`vol-${vol.id}`} className="bg-muted/40">
                            <TableCell colSpan={5} className="py-2">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span className="font-semibold text-sm">
                                  {vol.first_name === vol.last_name ? vol.first_name : `${vol.first_name} ${vol.last_name}`}
                                </span>
                                <span className="text-xs text-muted-foreground">({vol.email})</span>
                                <span className="text-xs text-muted-foreground ml-auto">{fCards.length} family card(s)</span>
                              </div>
                            </TableCell>
                          </TableRow>
                          {/* Individual family member rows */}
                          {fCards.map((fc: any) => {
                            const fMatch = fc.unique_id.match(/-F(\d)/);
                            const familyIndex = fMatch ? parseInt(fMatch[1], 10) : 0;
                            let memberName = '';
                            // Try index-based lookup first
                            if (deps.length > 0 && familyIndex > 0 && familyIndex <= deps.length) {
                              memberName = deps[familyIndex - 1].name;
                            }
                            // Positional fallback: sort family cards by F-index, match position to dependents
                            if (!memberName && deps.length > 0) {
                              const sortedCards = [...fCards]
                                .filter((c: any) => /-F\d+/.test(c.unique_id))
                                .sort((a: any, b: any) => {
                                  const aIdx = parseInt(a.unique_id.match(/-F(\d)/)?.[1] || '0', 10);
                                  const bIdx = parseInt(b.unique_id.match(/-F(\d)/)?.[1] || '0', 10);
                                  return aIdx - bIdx;
                                });
                              const posIdx = sortedCards.findIndex((c: any) => c.id === fc.id);
                              if (posIdx >= 0 && posIdx < deps.length) {
                                memberName = deps[posIdx].name;
                              }
                            }
                            // Last resort
                            if (!memberName) {
                              const volName = vol.first_name === vol.last_name ? vol.first_name : `${vol.first_name} ${vol.last_name}`;
                              memberName = `Family of ${volName}`;
                            }

                            // Determine status
                            const isCertSent = !!fc.survey_completed_at;
                            let statusLabel = 'Inactive';
                            let statusClass = 'border-muted-foreground/30 text-muted-foreground';
                            if (isCertSent) {
                              statusLabel = 'Checked Out';
                              statusClass = 'bg-green-100 text-green-800 border-green-200';
                            } else if (fc.status === 'checked_out') {
                              statusLabel = 'Checked Out';
                              statusClass = 'bg-green-100 text-green-800 border-green-200';
                            } else if (fc.status === 'checked_in') {
                              statusLabel = 'Checked In';
                              statusClass = 'bg-blue-100 text-blue-800 border-blue-200';
                            }

                            const canSend = fc.status === 'checked_out';

                            return (
                              <TableRow key={fc.id} className="text-sm">
                                <TableCell className="pl-8">{memberName}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">{fc.unique_id}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={statusClass}>
                                    {statusLabel}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {isCertSent ? (
                                    <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">Sent</Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {canSend ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={sendingCertForVolunteer === fc.id}
                                      onClick={async () => {
                                        setSendingCertForVolunteer(fc.id);
                                        try {
                                          const { generateCertificatePDF } = await import('@/components/certificates/CertificateGenerator');
                                          const nameParts = memberName.trim().split(/\s+/);
                                          const familyFirstName = nameParts[0] || memberName;
                                          const familyLastName = nameParts.slice(1).join(' ') || '';

                                          const certificateBase64 = await generateCertificatePDF({
                                            firstName: familyFirstName,
                                            lastName: familyLastName,
                                            type: 'attendance',
                                          });
                                          await supabase.functions.invoke('send-certificate', {
                                            body: {
                                              firstName: familyFirstName,
                                              lastName: familyLastName,
                                              email: vol.email,
                                              certificateBase64,
                                              certificateType: 'attendance',
                                              marketplaceId: fc.marketplace_id,
                                              hoursWorked: fc.total_hours_worked || 0,
                                              isFamilyMember: true,
                                            },
                                          });
                                          await supabase
                                            .from('volunteer_qr_cards')
                                            .update({ survey_completed_at: new Date().toISOString() })
                                            .eq('id', fc.id);

                                          toast({
                                            title: 'Certificate Sent',
                                            description: `Certificate for ${memberName} sent to ${vol.email}`,
                                          });

                                          // Refresh
                                          const currentMp = familyCertsMarketplace;
                                          setFamilyCertsMarketplace('');
                                          setTimeout(() => setFamilyCertsMarketplace(currentMp), 100);
                                        } catch (err) {
                                          toast({
                                            title: 'Failed',
                                            description: err instanceof Error ? err.message : 'Unknown error',
                                            variant: 'destructive',
                                          });
                                        } finally {
                                          setSendingCertForVolunteer(null);
                                        }
                                      }}
                                      className="gap-1"
                                    >
                                      {sendingCertForVolunteer === fc.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <Send className="w-3 h-3" />
                                      )}
                                      {fc.survey_completed_at ? 'Resend' : 'Send'}
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFamilyCertsDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Event Confirmation Dialog */}
      <AlertDialog open={showRemoveEventDialog} onOpenChange={setShowRemoveEventDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{eventToRemove?.name}</strong> from {selectedVolunteer?.first_name} {selectedVolunteer?.last_name}'s registration? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setEventToRemove(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (selectedVolunteer && eventToRemove) {
                  removeEventMutation.mutate({
                    pendingId: selectedVolunteer.id,
                    eventSlug: eventToRemove.slug
                  });
                }
              }}
              disabled={removeEventMutation.isPending}
            >
              {removeEventMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Removing...</>
              ) : (
                'Remove Event'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Reminder Template Picker Dialog */}
      <Dialog open={!!reminderDialogVolunteer} onOpenChange={(open) => {
        if (!open) {
          setReminderDialogVolunteer(null);
          setReminderTemplateId('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Reminder Email</DialogTitle>
            <DialogDescription>
              Choose an email template to send a reminder to <strong>{reminderDialogVolunteer?.first_name} {reminderDialogVolunteer?.last_name}</strong> ({reminderDialogVolunteer?.email})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email Template</Label>
              <Select value={reminderTemplateId} onValueChange={setReminderTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {emailTemplates.filter(t => t.is_active).map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} ({template.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setReminderDialogVolunteer(null);
              setReminderTemplateId('');
            }}>
              Cancel
            </Button>
            <Button
              disabled={!reminderTemplateId || sendReminderMutation.isPending}
              onClick={() => {
                if (reminderDialogVolunteer && reminderTemplateId) {
                  setSendingReminderId(reminderDialogVolunteer.id);
                  sendReminderMutation.mutate({
                    volunteer: reminderDialogVolunteer,
                    templateId: reminderTemplateId,
                  });
                }
              }}
            >
              {sendReminderMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
              ) : (
                <><Send className="w-4 h-4" /> Send Reminder</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
