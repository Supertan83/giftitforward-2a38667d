import { useState } from 'react';
import { ArrowLeft, Check, X, Eye, Loader2, User, Mail, Phone, Building, Calendar, AlertCircle, Clock, RefreshCw } from 'lucide-react';
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
  created_at: string;
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

export const PendingVolunteers = ({ onBack }: PendingVolunteersProps) => {
  const [selectedVolunteer, setSelectedVolunteer] = useState<PendingVolunteer | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [approvedCredentials, setApprovedCredentials] = useState<{ email: string; password: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: volunteers = [], isLoading, refetch } = useQuery({
    queryKey: ['pending-volunteers', activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_volunteers')
        .select('*')
        .eq('status', activeTab)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PendingVolunteer[];
    }
  });

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
        password: data.temp_password
      });
      setShowCredentialsDialog(true);
      setShowDetailsDialog(false);
      toast({
        title: 'Volunteer Approved',
        description: `Account created for ${data.email}`,
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

  const handleApprove = (volunteer: PendingVolunteer) => {
    approveMutation.mutate(volunteer.id);
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
                <h1 className="font-display font-bold text-base md:text-lg">Pending Volunteers</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                  Review and approve volunteer applications
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
        {/* Stats */}
        {pendingCount.data !== undefined && pendingCount.data > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-6 flex items-center gap-3"
          >
            <Clock className="w-5 h-5 text-amber-600" />
            <span className="text-amber-700 font-medium">
              {pendingCount.data} volunteer{pendingCount.data !== 1 ? 's' : ''} awaiting approval
            </span>
          </motion.div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'pending' | 'approved' | 'rejected')}>
          <TabsList className="mb-4">
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="w-4 h-4" />
              Pending
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <Check className="w-4 h-4" />
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <X className="w-4 h-4" />
              Rejected
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : volunteers.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No {activeTab} volunteers</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Events</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {volunteers.map((volunteer) => (
                          <motion.tr
                            key={volunteer.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="group"
                          >
                            <TableCell className="font-medium">
                              {volunteer.first_name} {volunteer.last_name}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {volunteer.email}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {volunteer.is_employee ? 'Dubai Holding' : (volunteer.external_company || 'Not specified')}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {volunteer.events_list?.split(',').length || 0} events
                              </span>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatDate(volunteer.created_at)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(volunteer.status)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDetailsDialog(volunteer)}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                {activeTab === 'pending' && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                      onClick={() => handleApprove(volunteer)}
                                      disabled={approveMutation.isPending}
                                    >
                                      {approveMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <Check className="w-4 h-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                      onClick={() => openRejectDialog(volunteer)}
                                      disabled={rejectMutation.isPending}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                                {activeTab === 'approved' && volunteer.temp_password && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setApprovedCredentials({
                                        email: volunteer.email,
                                        password: volunteer.temp_password!
                                      });
                                      setShowCredentialsDialog(true);
                                    }}
                                  >
                                    View Credentials
                                  </Button>
                                )}
                              </div>
                            </TableCell>
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
                    <span>{selectedVolunteer.email}</span>
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

              {/* Company Info */}
              <div>
                <h3 className="font-semibold text-sm text-muted-foreground mb-3 uppercase tracking-wide">Company</h3>
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
              Share these credentials with the volunteer so they can log in
            </DialogDescription>
          </DialogHeader>
          {approvedCredentials && (
            <div className="space-y-4">
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
    </div>
  );
};
