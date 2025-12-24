import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Package, Building, MapPin, ChevronDown, ChevronUp, ExternalLink, Loader2, Search, Filter } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ExternalItemsViewerProps {
  onBack: () => void;
}

interface ExternalItem {
  id: string;
  external_id: number;
  uuid: string | null;
  title: string;
  description: string | null;
  active: boolean;
  price: number | null;
  per: string | null;
  frequency: Record<string, boolean> | null;
  image_url: string | null;
  quantity: number;
  item_count: number;
  box_count: number | null;
  type_data: Record<string, unknown> | null;
  condition_id: number | null;
  company_id: string | null;
  address_id: string | null;
  material_group_id: string | null;
  third_level_subcategory_id: number | null;
  created_at: string;
  updated_at: string;
}

interface ExternalCompany {
  id: string;
  external_id: number;
  name: string;
  main_business: string | null;
  sector: string | null;
  company_size: string | null;
  designation: string | null;
}

interface ExternalAddress {
  id: string;
  external_id: number;
  address: string;
  city: string | null;
  country: string | null;
}

interface ExternalMaterialGroup {
  id: string;
  external_id: number;
  name: string;
  code: string | null;
  uom: string | null;
}

interface ExternalSdgGoal {
  id: string;
  external_id: number;
  name: string;
  code: string | null;
}

export const ExternalItemsViewer = ({ onBack }: ExternalItemsViewerProps) => {
  const { signOut } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Fetch external items
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['external-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_items')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ExternalItem[];
    }
  });

  // Fetch companies for lookup
  const { data: companies = [] } = useQuery({
    queryKey: ['external-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_companies')
        .select('*');
      
      if (error) throw error;
      return data as ExternalCompany[];
    }
  });

  // Fetch addresses for lookup
  const { data: addresses = [] } = useQuery({
    queryKey: ['external-addresses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_addresses')
        .select('*');
      
      if (error) throw error;
      return data as ExternalAddress[];
    }
  });

  // Fetch material groups for lookup
  const { data: materialGroups = [] } = useQuery({
    queryKey: ['external-material-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_material_groups')
        .select('*');
      
      if (error) throw error;
      return data as ExternalMaterialGroup[];
    }
  });

  // Fetch SDG goal mappings
  const { data: itemSdgGoals = [] } = useQuery({
    queryKey: ['external-item-sdg-goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_item_sdg_goals')
        .select('*');
      
      if (error) throw error;
      return data as { id: string; item_id: string; sdg_goal_id: string }[];
    }
  });

  // Fetch SDG goals
  const { data: sdgGoals = [] } = useQuery({
    queryKey: ['external-sdg-goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_sdg_goals')
        .select('*');
      
      if (error) throw error;
      return data as ExternalSdgGoal[];
    }
  });

  const getCompany = (companyId: string | null) => 
    companies.find(c => c.id === companyId);

  const getAddress = (addressId: string | null) => 
    addresses.find(a => a.id === addressId);

  const getMaterialGroup = (materialGroupId: string | null) => 
    materialGroups.find(m => m.id === materialGroupId);

  const getItemSdgGoals = (itemId: string) => {
    const goalIds = itemSdgGoals
      .filter(isg => isg.item_id === itemId)
      .map(isg => isg.sdg_goal_id);
    return sdgGoals.filter(g => goalIds.includes(g.id));
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getCompany(item.company_id)?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && item.active) ||
      (statusFilter === 'inactive' && !item.active);
    
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
                <p className="text-xs md:text-sm text-muted-foreground hidden sm:block">External Items Database</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} className="text-xs md:text-sm">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Back Button & Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="w-fit"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{items.length}</span> total items
            </div>
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-emerald-500">{items.filter(i => i.active).length}</span> active
            </div>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-card rounded-xl border border-border p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search items, companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Items List */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-display font-semibold text-lg">External Items</h2>
            <p className="text-sm text-muted-foreground">Items received from partner database webhook</p>
          </div>

          {itemsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No external items found</p>
              <p className="text-sm">Items will appear here when received via webhook</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredItems.map((item, index) => {
                const company = getCompany(item.company_id);
                const address = getAddress(item.address_id);
                const materialGroup = getMaterialGroup(item.material_group_id);
                const itemGoals = getItemSdgGoals(item.id);
                const isExpanded = expandedId === item.id;
                const typeData = item.type_data as { status?: string; offering_type?: string } | null;

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                  >
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="w-full text-left p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-foreground truncate">{item.title}</h3>
                            <Badge variant={item.active ? 'default' : 'secondary'} className="text-xs shrink-0">
                              {item.active ? 'Active' : 'Inactive'}
                            </Badge>
                            {typeData?.status && (
                              <Badge 
                                variant={typeData.status === 'APPROVED' ? 'outline' : 'secondary'} 
                                className="text-xs shrink-0"
                              >
                                {typeData.status}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            {company && (
                              <span className="flex items-center gap-1">
                                <Building className="w-3 h-3" />
                                {company.name}
                              </span>
                            )}
                            {materialGroup && (
                              <span>{materialGroup.name}</span>
                            )}
                            <span>Qty: {item.quantity}</span>
                            {item.item_count > 0 && (
                              <span>Items: {item.item_count}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground hidden sm:block">
                            ID: {item.external_id}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border bg-muted/30"
                      >
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Description */}
                          {item.description && (
                            <div className="md:col-span-2">
                              <h4 className="text-sm font-medium mb-1">Description</h4>
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>
                            </div>
                          )}

                          {/* Company Details */}
                          {company && (
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                                <Building className="w-3 h-3" /> Company
                              </h4>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <p className="font-medium text-foreground">{company.name}</p>
                                {company.main_business && <p>{company.main_business}</p>}
                                {company.sector && <p>Sector: {company.sector}</p>}
                                {company.company_size && <p>Size: {company.company_size}</p>}
                                {company.designation && <p>Contact: {company.designation}</p>}
                              </div>
                            </div>
                          )}

                          {/* Address */}
                          {address && (
                            <div>
                              <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> Location
                              </h4>
                              <div className="text-sm text-muted-foreground">
                                <p>{address.address}</p>
                                {address.city && <p>{address.city}, {address.country}</p>}
                              </div>
                            </div>
                          )}

                          {/* Item Details */}
                          <div>
                            <h4 className="text-sm font-medium mb-2">Item Details</h4>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>External ID: {item.external_id}</p>
                              <p>Quantity: {item.quantity}</p>
                              {item.item_count > 0 && <p>Item Count: {item.item_count}</p>}
                              {item.box_count && <p>Box Count: {item.box_count}</p>}
                              {materialGroup && <p>Material: {materialGroup.name} ({materialGroup.code})</p>}
                              {typeData?.offering_type && <p>Offering: {typeData.offering_type}</p>}
                            </div>
                          </div>

                          {/* SDG Goals */}
                          {itemGoals.length > 0 && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">SDG Goals</h4>
                              <div className="flex flex-wrap gap-1">
                                {itemGoals.map(goal => (
                                  <Badge key={goal.id} variant="outline" className="text-xs">
                                    {goal.code}: {goal.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Timestamps */}
                          <div className="md:col-span-2 pt-2 border-t border-border/50">
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                              <span>Created: {formatDate(item.created_at)}</span>
                              <span>Updated: {formatDate(item.updated_at)}</span>
                              {item.uuid && <span>UUID: {item.uuid}</span>}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
