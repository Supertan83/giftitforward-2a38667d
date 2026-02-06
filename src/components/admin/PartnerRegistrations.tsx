import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Users, 
  ChevronDown, 
  ChevronRight,
  Calendar,
  Phone,
  Mail,
  Building,
  Heart,
  AlertCircle,
  UserPlus,
  Loader2,
  RefreshCw,
  Search
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { usePagination } from '@/hooks/usePagination';
import { PaginationControls } from '@/components/ui/pagination-controls';

interface PartnerRegistrationsProps {
  onBack: () => void;
}

interface Dependent {
  id: string;
  dependent_type: string;
  dependent_index: number | null;
  name: string;
  gender: string | null;
}

interface RegistrationEvent {
  id: string;
  event_slug: string;
  event_date: string | null;
  family_members_joining: boolean;
  number_of_children: number;
  number_of_adults: number;
  fnb_required: boolean;
  event_dependents: Dependent[];
}

interface Registration {
  id: string;
  submission_date: string | null;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  work_email: string;
  gender: string | null;
  is_employee: boolean;
  employee_vertical: string | null;
  employee_number: string | null;
  has_medical_condition: boolean;
  medical_condition_details: string | null;
  emergency_contact_name: string | null;
  emergency_contact_number: string | null;
  is_fasting: boolean;
  events_list: string | null;
  created_at: string;
  registration_events: RegistrationEvent[];
}

export const PartnerRegistrations = ({ onBack }: PartnerRegistrationsProps) => {
  const { signOut } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: registrations = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['partner-registrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_registrations')
        .select(`
          *,
          registration_events (
            *,
            event_dependents (*)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as Registration[];
    }
  });

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
    setExpandedEventId(null);
  };

  const toggleEventExpand = (id: string) => {
    setExpandedEventId(expandedEventId === id ? null : id);
  };

  // Filter registrations
  const filteredRegistrations = registrations.filter(reg => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return `${reg.first_name} ${reg.last_name}`.toLowerCase().includes(q) ||
           reg.work_email.toLowerCase().includes(q) ||
           (reg.phone_number || '').toLowerCase().includes(q);
  });

  // Pagination
  const pagination = usePagination(filteredRegistrations, { defaultPageSize: 25 });

  useEffect(() => {
    pagination.setCurrentPage(1);
  }, [searchQuery]);

  const formatEventSlug = (slug: string) => {
    return slug
      .replace(/^event-\d+---/, '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-3 md:py-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 md:gap-3">
              <BrandLogo size="md" />
              <div>
                <h1 className="font-display font-bold text-base md:text-lg">GIF (Gift it Forward)</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">Dubai Holdings Registrations</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} className="text-xs md:text-sm">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Back Button & Title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()} 
            disabled={isRefetching}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{registrations.length}</p>
                <p className="text-sm text-muted-foreground">Total Registrations</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {registrations.reduce((sum, r) => sum + (r.registration_events?.length || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Event Registrations</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {registrations.reduce((sum, r) => 
                    sum + r.registration_events?.reduce((eSum, e) => 
                      eSum + (e.event_dependents?.length || 0), 0) || 0, 0
                  )}
                </p>
                <p className="text-sm text-muted-foreground">Family Members</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Registrations List */}
        <div className="bg-card rounded-xl md:rounded-2xl border border-border shadow-card overflow-hidden">
          <div className="p-4 md:p-6 border-b border-border">
            <h2 className="font-display font-bold text-lg md:text-xl">Recent Registrations</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {filteredRegistrations.length} registration{filteredRegistrations.length !== 1 ? 's' : ''}
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredRegistrations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No registrations found</p>
            </div>
          ) : (
            <>
            <div className="divide-y divide-border">
              {pagination.paginatedItems.map((reg, index) => (
                <motion.div
                  key={reg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  {/* Registration Header */}
                  <button
                    onClick={() => toggleExpand(reg.id)}
                    className="w-full p-4 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary-soft flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary">
                            {reg.first_name.charAt(0)}{reg.last_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold">
                            {reg.first_name} {reg.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">{reg.work_email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-2">
                          {reg.is_employee && (
                            <Badge variant="outline" className="text-xs">
                              <Building className="w-3 h-3 mr-1" />
                              Employee
                            </Badge>
                          )}
                          {reg.has_medical_condition && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Medical
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {reg.registration_events?.length || 0} events
                          </Badge>
                        </div>
                        {expandedId === reg.id ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expandedId === reg.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-muted/30"
                      >
                        <div className="p-4 space-y-4">
                          {/* Contact Info */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              <span>{reg.phone_number || 'No phone'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              <span>{reg.work_email}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span>
                                {reg.submission_date 
                                  ? format(new Date(reg.submission_date), 'MMM d, yyyy h:mm a')
                                  : format(new Date(reg.created_at), 'MMM d, yyyy h:mm a')
                                }
                              </span>
                            </div>
                          </div>

                          {/* Additional Info */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            <div className="bg-card rounded-lg p-3 border border-border">
                              <p className="text-muted-foreground text-xs">Gender</p>
                              <p className="font-medium">{reg.gender || 'Not specified'}</p>
                            </div>
                            {reg.is_employee && reg.employee_vertical && (
                              <div className="bg-card rounded-lg p-3 border border-border">
                                <p className="text-muted-foreground text-xs">Vertical</p>
                                <p className="font-medium">{reg.employee_vertical}</p>
                              </div>
                            )}
                            {reg.is_employee && reg.employee_number && (
                              <div className="bg-card rounded-lg p-3 border border-border">
                                <p className="text-muted-foreground text-xs">Employee #</p>
                                <p className="font-medium">{reg.employee_number}</p>
                              </div>
                            )}
                            <div className="bg-card rounded-lg p-3 border border-border">
                              <p className="text-muted-foreground text-xs">Fasting</p>
                              <p className="font-medium">{reg.is_fasting ? 'Yes' : 'No'}</p>
                            </div>
                          </div>

                          {/* Medical Condition */}
                          {reg.has_medical_condition && reg.medical_condition_details && (
                            <div className="bg-destructive/10 rounded-lg p-3 border border-destructive/20">
                              <div className="flex items-center gap-2 mb-1">
                                <Heart className="w-4 h-4 text-destructive" />
                                <span className="font-medium text-destructive">Medical Condition</span>
                              </div>
                              <p className="text-sm">{reg.medical_condition_details}</p>
                            </div>
                          )}

                          {/* Emergency Contact */}
                          {reg.emergency_contact_name && (
                            <div className="bg-card rounded-lg p-3 border border-border">
                              <p className="text-muted-foreground text-xs mb-1">Emergency Contact</p>
                              <p className="font-medium">{reg.emergency_contact_name}</p>
                              {reg.emergency_contact_number && (
                                <p className="text-sm text-muted-foreground">{reg.emergency_contact_number}</p>
                              )}
                            </div>
                          )}

                          {/* Events */}
                          {reg.registration_events && reg.registration_events.length > 0 && (
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm">Registered Events</h4>
                              {reg.registration_events.map((event) => (
                                <div key={event.id} className="bg-card rounded-lg border border-border overflow-hidden">
                                  <button
                                    onClick={() => toggleEventExpand(event.id)}
                                    className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center justify-between"
                                  >
                                    <div>
                                      <p className="font-medium">{formatEventSlug(event.event_slug)}</p>
                                      <p className="text-sm text-muted-foreground">{event.event_date}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {event.family_members_joining && (
                                        <Badge variant="outline" className="text-xs">
                                          +{event.number_of_adults + event.number_of_children} guests
                                        </Badge>
                                      )}
                                      {event.fnb_required && (
                                        <Badge variant="secondary" className="text-xs">F&B</Badge>
                                      )}
                                      {expandedEventId === event.id ? (
                                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </div>
                                  </button>

                                  <AnimatePresence>
                                    {expandedEventId === event.id && event.event_dependents && event.event_dependents.length > 0 && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden border-t border-border"
                                      >
                                        <div className="p-3 bg-muted/30">
                                          <p className="text-xs font-medium text-muted-foreground mb-2">Family Members</p>
                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {event.event_dependents.map((dep) => (
                                              <div key={dep.id} className="bg-card rounded-lg p-2 border border-border text-sm">
                                                <p className="font-medium">{dep.name}</p>
                                                <p className="text-xs text-muted-foreground capitalize">
                                                  {dep.dependent_type === 'children' ? 'Child' : 'Adult'}
                                                  {dep.gender && ` • ${dep.gender}`}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
            <div className="border-t border-border">
              <PaginationControls
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                startIndex={pagination.startIndex}
                endIndex={pagination.endIndex}
                pageSize={pagination.pageSize}
                pageSizeOptions={pagination.pageSizeOptions}
                canGoNext={pagination.canGoNext}
                canGoPrevious={pagination.canGoPrevious}
                onPageChange={pagination.setCurrentPage}
                onPageSizeChange={pagination.setPageSize}
                onGoToFirst={pagination.goToFirstPage}
                onGoToLast={pagination.goToLastPage}
                onGoToNext={pagination.goToNextPage}
                onGoToPrevious={pagination.goToPreviousPage}
              />
            </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
