import { useState } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ArrowLeft, GraduationCap, Check, X, RefreshCw, Search, Mail, RotateCcw, Loader2, Send } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TrainingCompletionViewerProps {
  onBack: () => void;
}

interface VolunteerTrainingStatus {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  training_completed: boolean;
  training_completed_at: string | null;
  created_at: string;
}

export const TrainingCompletionViewer = ({ onBack }: TrainingCompletionViewerProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'pending'>('all');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<VolunteerTrainingStatus | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: volunteers = [], isLoading, refetch } = useQuery({
    queryKey: ['volunteer-training-status'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_volunteers')
        .select('id, first_name, last_name, email, status, training_completed, training_completed_at, created_at')
        .order('training_completed_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as VolunteerTrainingStatus[];
    },
  });

  const filteredVolunteers = volunteers.filter((volunteer) => {
    const matchesSearch =
      volunteer.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      volunteer.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      volunteer.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'completed' && volunteer.training_completed) ||
      (filterStatus === 'pending' && !volunteer.training_completed);

    return matchesSearch && matchesFilter;
  });

  const completedCount = volunteers.filter((v) => v.training_completed).length;
  const pendingCount = volunteers.filter((v) => !v.training_completed).length;

  const handleResetClick = (volunteer: VolunteerTrainingStatus) => {
    setSelectedVolunteer(volunteer);
    setResetDialogOpen(true);
  };

  const handleSendReminder = async (volunteer: VolunteerTrainingStatus) => {
    setSendingReminderId(volunteer.id);
    try {
      const { data, error } = await supabase.functions.invoke('send-retake-training', {
        body: {
          volunteerId: volunteer.id,
          firstName: volunteer.first_name,
          lastName: volunteer.last_name,
          email: volunteer.email,
          isReminder: true,
        },
      });

      if (error) throw error;

      if (data?.success || data?.trainingReset) {
        toast({
          title: 'Reminder Sent',
          description: `Training reminder email sent to ${volunteer.first_name}.`,
        });
      } else {
        throw new Error(data?.error || 'Failed to send reminder');
      }
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send reminder email',
        variant: 'destructive',
      });
    } finally {
      setSendingReminderId(null);
    }
  };

  const handleResetConfirm = async () => {
    if (!selectedVolunteer) return;
    
    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-retake-training', {
        body: {
          volunteerId: selectedVolunteer.id,
          firstName: selectedVolunteer.first_name,
          lastName: selectedVolunteer.last_name,
          email: selectedVolunteer.email,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Training Reset',
          description: `${selectedVolunteer.first_name}'s training status has been reset and an email has been sent.`,
        });
        refetch();
      } else if (data?.trainingReset) {
        toast({
          title: 'Training Reset (Email Failed)',
          description: `Training status was reset but the email failed to send. ${data.error || ''}`,
          variant: 'destructive',
        });
        refetch();
      } else {
        throw new Error(data?.error || 'Failed to reset training');
      }
    } catch (error: any) {
      console.error('Error resetting training:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset training status',
        variant: 'destructive',
      });
    } finally {
      setIsResetting(false);
      setResetDialogOpen(false);
      setSelectedVolunteer(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-3 md:py-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <BrandLogo size="md" />
              <div>
                <h1 className="font-display font-bold text-base md:text-lg">Training Completion</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                  Track volunteer training progress
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{volunteers.length}</p>
                <p className="text-xs text-muted-foreground">Total Volunteers</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl border border-border p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Check className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{completedCount}</p>
                <p className="text-xs text-muted-foreground">Training Completed</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl border border-border p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <X className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pending Training</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
            >
              All
            </Button>
            <Button
              variant={filterStatus === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('completed')}
            >
              Completed
            </Button>
            <Button
              variant={filterStatus === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('pending')}
            >
              Pending
            </Button>
          </div>
        </div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border overflow-hidden"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Volunteer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Training Status</TableHead>
                  <TableHead>Completed At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVolunteers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No volunteers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVolunteers.map((volunteer) => (
                    <TableRow key={volunteer.id}>
                      <TableCell className="font-medium">
                        {volunteer.first_name} {volunteer.last_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm">{volunteer.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {volunteer.training_completed ? (
                          <Badge variant="default" className="bg-success text-success-foreground">
                            <Check className="w-3 h-3 mr-1" />
                            Completed
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <X className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {volunteer.training_completed_at ? (
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(volunteer.training_completed_at), 'MMM d, yyyy h:mm a')}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {volunteer.training_completed ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResetClick(volunteer)}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" />
                            Reset
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendReminder(volunteer)}
                            disabled={sendingReminderId === volunteer.id}
                          >
                            {sendingReminderId === volunteer.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5 mr-1" />
                                Resend
                              </>
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </motion.div>
      </main>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Training Status</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset the training status for{' '}
              <span className="font-semibold">
                {selectedVolunteer?.first_name} {selectedVolunteer?.last_name}
              </span>{' '}
              and send them an email with a link to retake the training.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetConfirm} disabled={isResetting}>
              {isResetting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset & Send Email
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TrainingCompletionViewer;