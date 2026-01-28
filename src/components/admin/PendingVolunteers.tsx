import { useState, useMemo } from 'react';
import { ArrowLeft, Check, X, Eye, Loader2, User, Mail, Phone, Building, Calendar, AlertCircle, Clock, RefreshCw, Send, MailOpen, Users, KeyRound, Search, Copy, QrCode, GraduationCap, Code, ChevronDown, Briefcase, Upload, Trash2, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CertificatePreviewDialog } from '@/components/certificates/CertificatePreviewDialog';

interface VolunteerQRCard {
  unique_id: string;
  status: string;
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
  status: 'pending' | 'approved' | 'rejected';
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
  const [activeTab, setActiveTab] = useState<'approved' | 'bulk_uploaded' | 'pending_missing_email'>('approved');
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
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: volunteers = [], isLoading, refetch } = useQuery({
    queryKey: ['pending-volunteers', activeTab],
    queryFn: async () => {
      let query = supabase
        .from('pending_volunteers')
        .select(`
          *,
          volunteer_qr_cards!volunteer_qr_cards_volunteer_id_fkey (
            unique_id,
            status
          )
        `);

      // Filter by status and source based on active tab
      if (activeTab === 'pending_missing_email') {
        query = query.eq('status', 'pending');
      } else {
        query = query.eq('status', 'approved');
        if (activeTab === 'bulk_uploaded') {
          query = query.eq('source', 'bulk_upload');
        } else {
          // Show webhook/manual (non-bulk) in the approved tab
          query = query.or('source.is.null,source.neq.bulk_upload');
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PendingVolunteer[];
    }
  });

  // Extract unique events from all volunteers
  const uniqueEvents = useMemo(() => {
    const eventsSet = new Set<string>();
    volunteers.forEach(v => {
      if (v.events_list) {
        v.events_list.split(',').forEach(e => {
          const formatted = formatEventName(e.trim());
          if (formatted) eventsSet.add(formatted);
        });
      }
    });
    return Array.from(eventsSet).sort();
  }, [volunteers]);

  // Filter volunteers by selected event
  const filteredVolunteers = useMemo(() => {
    if (eventFilter === 'all') return volunteers;
    return volunteers.filter(v => {
      if (!v.events_list) return false;
      return v.events_list.split(',').some(e => 
        formatEventName(e.trim()) === eventFilter
      );
    });
  }, [volunteers, eventFilter]);

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

  const handleApprove = (volunteer: PendingVolunteer) => {
    approveMutation.mutate(volunteer.id);
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
        .eq('status', 'pending');
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
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Event Filter */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by event" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {uniqueEvents.map(event => (
                  <SelectItem key={event} value={event}>{event}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {eventFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {filteredVolunteers.length} volunteer{filteredVolunteers.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'approved' | 'bulk_uploaded' | 'pending_missing_email'); setSelectedIds(new Set()); }}>
          <TabsList className="mb-4">
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
            <TabsTrigger value="pending_missing_email" className="gap-2">
              <AlertCircle className="w-4 h-4" />
              Missing Email
              {(pendingCount.data ?? 0) > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                  {pendingCount.data}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
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
                        {activeTab !== 'pending_missing_email' && <TableHead className="w-10"></TableHead>}
                        <TableHead className="w-[18%] min-w-[100px]">Name</TableHead>
                        {activeTab === 'pending_missing_email' ? (
                          <>
                            <TableHead className="w-[15%]">Phone</TableHead>
                            <TableHead className="hidden md:table-cell w-[20%]">Events</TableHead>
                            <TableHead className="hidden sm:table-cell w-[14%]">Submitted</TableHead>
                            <TableHead className="text-right w-[20%]">Actions</TableHead>
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
                          <motion.tr
                            key={volunteer.id}
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
                                  <div className="flex items-center justify-end gap-2">
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
                            ) : (
                              <>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedIds.has(volunteer.id)}
                                    onCheckedChange={() => toggleSelect(volunteer.id)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium truncate max-w-[100px]">
                                  {volunteer.first_name} {volunteer.last_name?.charAt(0)}.
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
                                    if (deps.length === 0) {
                                      return <span className="text-sm text-muted-foreground">—</span>;
                                    }
                                    return (
                                      <div className="flex items-center gap-1">
                                        <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                        <span className="text-sm font-medium">{deps.length}</span>
                                      </div>
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
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => {
                                              setCertificatePreviewVolunteer(volunteer);
                                              setShowCertificatePreview(true);
                                            }}
                                          >
                                            <Award className="w-3.5 h-3.5" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>View Certificates</TooltipContent>
                                      </Tooltip>
                                      {volunteer.temp_password && (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-7 w-7"
                                              onClick={() => {
                                                setApprovedCredentials({
                                                  email: volunteer.email,
                                                  password: volunteer.temp_password!,
                                                  emailSent: volunteer.email_sent ?? false
                                                });
                                                setShowCredentialsDialog(true);
                                              }}
                                            >
                                              <KeyRound className="w-3.5 h-3.5" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>View Credentials</TooltipContent>
                                        </Tooltip>
                                      )}
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => resendEmailMutation.mutate(volunteer.id)}
                                            disabled={resendEmailMutation.isPending || deleteMutation.isPending}
                                          >
                                            {resendEmailMutation.isPending ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <Mail className="w-3.5 h-3.5" />
                                            )}
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Resend Email</TooltipContent>
                                      </Tooltip>
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
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Volunteer Application Details</DialogTitle>
            <DialogDescription>
              Review the volunteer's information before approving or rejecting
            </DialogDescription>
          </DialogHeader>
          
          {selectedVolunteer && (
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
                    <span className="text-sm break-all">{selectedVolunteer.email}</span>
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
                    {selectedVolunteer.volunteer_qr_cards.map((card, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-background px-2 py-1 rounded">{card.unique_id}</code>
                          <Badge variant={card.status === 'active' ? 'default' : 'secondary'} className="text-xs">
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
                    ))}
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
                return (
                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Family Members ({deps.length})
                    </h3>
                    <div className="space-y-2">
                      {deps.map((dep, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            <Badge variant={dep.type === 'adult' ? 'default' : 'secondary'} className="text-xs">
                              {dep.type === 'adult' ? 'Adult' : 'Child'}
                            </Badge>
                            <span className="font-medium">{dep.name}</span>
                            {dep.gender && <span className="text-muted-foreground text-sm">({dep.gender})</span>}
                          </div>
                        </div>
                      ))}
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
              {selectedVolunteer.events_list && (
                <div>
                  <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">Registered Events</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedVolunteer.events_list.split(',').map((event, idx) => (
                      <Badge key={idx} variant="secondary">{formatEventName(event.trim())}</Badge>
                    ))}
                  </div>
                </div>
              )}

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

          {selectedVolunteer?.status === 'pending' && (
            <DialogFooter className="gap-2">
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Email Address</DialogTitle>
            <DialogDescription>
              Enter the email address for this volunteer to create their account.
            </DialogDescription>
          </DialogHeader>
          
          {addEmailVolunteer && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{addEmailVolunteer.first_name} {addEmailVolunteer.last_name}</span>
                </div>
                {addEmailVolunteer.phone_number && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{addEmailVolunteer.phone_number}</span>
                  </div>
                )}
                {addEmailVolunteer.events_list && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span className="truncate">{addEmailVolunteer.events_list.split(',').map(e => formatEventName(e.trim())).join(', ')}</span>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Email Address</label>
                <Input
                  type="email"
                  placeholder="volunteer@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
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
    </div>
  );
};
