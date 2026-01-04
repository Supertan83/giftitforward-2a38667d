import { useState, useMemo } from 'react';
import { ArrowLeft, QrCode, Users, Search, Loader2, User, Clock, MapPin, Plus, UserPlus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface VolunteerQRCard {
  id: string;
  unique_id: string;
  volunteer_id: string | null;
  status: string;
  marketplace_id: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  total_hours_worked: number | null;
  created_at: string;
  volunteer?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    events_json: unknown;
  } | null;
  marketplace?: {
    id: string;
    name: string;
  } | null;
}

interface VolunteerQRCardsViewerProps {
  onBack: () => void;
}

// Check if QR card is a family member card (contains -F pattern)
const isFamilyCard = (uniqueId: string): boolean => {
  return /-F\d+[A-Z0-9]+$/.test(uniqueId);
};

// Get parent QR ID from family card ID
const getParentQRId = (uniqueId: string): string | null => {
  const match = uniqueId.match(/^(.+)-F\d+[A-Z0-9]+$/);
  return match ? match[1] : null;
};

// Extract unique dependents from events_json
const extractUniqueDependents = (eventsJson: unknown): Array<{ name: string; type: string }> => {
  if (!eventsJson || !Array.isArray(eventsJson)) return [];
  
  const dependentsMap = new Map<string, { name: string; type: string }>();
  
  for (const event of eventsJson) {
    if (event.dependents && Array.isArray(event.dependents)) {
      for (const dep of event.dependents) {
        const key = dep.name?.toLowerCase()?.trim();
        if (key && !dependentsMap.has(key)) {
          dependentsMap.set(key, {
            name: dep.name,
            type: dep.type || 'adult'
          });
        }
      }
    }
  }
  
  return Array.from(dependentsMap.values());
};

export const VolunteerQRCardsViewer = ({ onBack }: VolunteerQRCardsViewerProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddFamilyDialog, setShowAddFamilyDialog] = useState(false);
  const [selectedVolunteerId, setSelectedVolunteerId] = useState<string | null>(null);
  const [newFamilyMemberName, setNewFamilyMemberName] = useState('');
  const [newFamilyMemberType, setNewFamilyMemberType] = useState<'adult' | 'children'>('adult');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: qrCards = [], isLoading } = useQuery({
    queryKey: ['volunteer-qr-cards-with-details'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('volunteer_qr_cards')
        .select(`
          *,
          volunteer:pending_volunteers(id, first_name, last_name, email, events_json),
          marketplace:marketplace_events(id, name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as VolunteerQRCard[];
    }
  });

  const addFamilyMemberMutation = useMutation({
    mutationFn: async ({ volunteerId, name, type }: { volunteerId: string; name: string; type: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('webhook-receiver', {
        body: {
          action: 'add_family_member',
          volunteer_id: volunteerId,
          family_member: { name, type }
        }
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || 'Failed to add family member');
      
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['volunteer-qr-cards-with-details'] });
      setShowAddFamilyDialog(false);
      setNewFamilyMemberName('');
      setNewFamilyMemberType('adult');
      toast({
        title: 'Family Member Added',
        description: `QR card ${data.qr_card_id} created for ${newFamilyMemberName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to Add Family Member',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  // Group cards by volunteer
  const groupedCards = useMemo(() => {
    const groups = new Map<string, { volunteer: VolunteerQRCard['volunteer']; cards: VolunteerQRCard[] }>();
    
    for (const card of qrCards) {
      const volId = card.volunteer_id || 'unassigned';
      if (!groups.has(volId)) {
        groups.set(volId, {
          volunteer: card.volunteer,
          cards: []
        });
      }
      groups.get(volId)!.cards.push(card);
    }
    
    return groups;
  }, [qrCards]);

  // Filtered cards
  const filteredCards = useMemo(() => {
    return qrCards.filter(card => {
      const matchesSearch = searchQuery === '' || 
        card.unique_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.volunteer?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.volunteer?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.volunteer?.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || card.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [qrCards, searchQuery, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'inactive':
        return <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-muted-foreground/30">Inactive</Badge>;
      case 'checked_in':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Checked In</Badge>;
      case 'checked_out':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">Checked Out</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const openAddFamilyDialog = (volunteerId: string) => {
    setSelectedVolunteerId(volunteerId);
    setShowAddFamilyDialog(true);
  };

  const handleAddFamilyMember = () => {
    if (!selectedVolunteerId || !newFamilyMemberName.trim()) return;
    addFamilyMemberMutation.mutate({
      volunteerId: selectedVolunteerId,
      name: newFamilyMemberName.trim(),
      type: newFamilyMemberType
    });
  };

  // Stats
  const stats = useMemo(() => {
    const total = qrCards.length;
    const volunteers = new Set(qrCards.map(c => c.volunteer_id).filter(Boolean)).size;
    const familyCards = qrCards.filter(c => isFamilyCard(c.unique_id)).length;
    const checkedIn = qrCards.filter(c => c.status === 'checked_in').length;
    
    return { total, volunteers, familyCards, checkedIn };
  }, [qrCards]);

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
                <h1 className="font-display font-bold text-base md:text-lg">Volunteer QR Cards</h1>
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">
                  View all volunteer and family member QR cards
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-xl border border-border p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <QrCode className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Cards</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card rounded-xl border border-border p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <User className="w-4 h-4 text-violet-500" />
              <span className="text-sm text-muted-foreground">Volunteers</span>
            </div>
            <p className="text-2xl font-bold">{stats.volunteers}</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card rounded-xl border border-border p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-teal-500" />
              <span className="text-sm text-muted-foreground">Family Cards</span>
            </div>
            <p className="text-2xl font-bold">{stats.familyCards}</p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-xl border border-border p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Checked In</span>
            </div>
            <p className="text-2xl font-bold">{stats.checkedIn}</p>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by QR ID, name, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="checked_in">Checked In</SelectItem>
              <SelectItem value="checked_out">Checked Out</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <QrCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No QR cards found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>QR Card ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Volunteer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Marketplace</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCards.map((card) => {
                    const isFamily = isFamilyCard(card.unique_id);
                    const dependents = card.volunteer ? extractUniqueDependents(card.volunteer.events_json) : [];
                    
                    return (
                      <TableRow key={card.id}>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                            {card.unique_id}
                          </code>
                        </TableCell>
                        <TableCell>
                          {isFamily ? (
                            <Badge variant="outline" className="bg-teal-500/10 text-teal-600 border-teal-500/30">
                              <Users className="w-3 h-3 mr-1" />
                              Family
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-violet-500/10 text-violet-600 border-violet-500/30">
                              <User className="w-3 h-3 mr-1" />
                              Volunteer
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {card.volunteer ? (
                            <div>
                              <p className="font-medium">
                                {card.volunteer.first_name} {card.volunteer.last_name}
                              </p>
                              <p className="text-xs text-muted-foreground">{card.volunteer.email}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(card.status)}
                        </TableCell>
                        <TableCell>
                          {card.marketplace ? (
                            <div className="flex items-center gap-1 text-sm">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              {card.marketplace.name}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {card.total_hours_worked ? (
                            <span className="font-medium">{card.total_hours_worked.toFixed(1)}h</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(card.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          {!isFamily && card.volunteer_id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openAddFamilyDialog(card.volunteer_id!)}
                              className="gap-1"
                            >
                              <UserPlus className="w-4 h-4" />
                              <span className="hidden sm:inline">Add Family</span>
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>

      {/* Add Family Member Dialog */}
      <Dialog open={showAddFamilyDialog} onOpenChange={setShowAddFamilyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Family Member</DialogTitle>
            <DialogDescription>
              Create a new QR card for a family member of this volunteer.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="familyMemberName">Name</Label>
              <Input
                id="familyMemberName"
                placeholder="Enter family member name"
                value={newFamilyMemberName}
                onChange={(e) => setNewFamilyMemberName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="familyMemberType">Type</Label>
              <Select value={newFamilyMemberType} onValueChange={(v) => setNewFamilyMemberType(v as 'adult' | 'children')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="adult">Adult</SelectItem>
                  <SelectItem value="children">Child</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFamilyDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddFamilyMember}
              disabled={!newFamilyMemberName.trim() || addFamilyMemberMutation.isPending}
            >
              {addFamilyMemberMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Add & Create QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
