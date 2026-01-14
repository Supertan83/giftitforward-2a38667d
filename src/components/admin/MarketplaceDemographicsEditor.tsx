import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Save, 
  Edit2, 
  X, 
  Plus, 
  Trash2,
  UserCheck,
  Baby,
  Home,
  Loader2,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MarketplaceDemographics {
  demographics_total_families: number;
  demographics_total_adults: number;
  demographics_total_children: number;
  demographics_male_adults: number;
  demographics_female_adults: number;
  demographics_male_children: number;
  demographics_female_children: number;
  demographics_nationalities: Record<string, number>;
  demographics_notes: string | null;
  demographics_updated_at: string | null;
}

interface MarketplaceDemographicsEditorProps {
  marketplaceId: string;
  marketplaceName: string;
  onUpdate?: () => void;
}

export const MarketplaceDemographicsEditor = ({
  marketplaceId,
  marketplaceName,
  onUpdate
}: MarketplaceDemographicsEditorProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [demographics, setDemographics] = useState<MarketplaceDemographics>({
    demographics_total_families: 0,
    demographics_total_adults: 0,
    demographics_total_children: 0,
    demographics_male_adults: 0,
    demographics_female_adults: 0,
    demographics_male_children: 0,
    demographics_female_children: 0,
    demographics_nationalities: {},
    demographics_notes: null,
    demographics_updated_at: null
  });
  
  const [newNationality, setNewNationality] = useState('');
  const [newNationalityCount, setNewNationalityCount] = useState(0);

  useEffect(() => {
    loadDemographics();
  }, [marketplaceId]);

  const loadDemographics = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('marketplace_events')
        .select(`
          demographics_total_families,
          demographics_total_adults,
          demographics_total_children,
          demographics_male_adults,
          demographics_female_adults,
          demographics_male_children,
          demographics_female_children,
          demographics_nationalities,
          demographics_notes,
          demographics_updated_at
        `)
        .eq('id', marketplaceId)
        .single();

      if (error) throw error;

      if (data) {
        setDemographics({
          demographics_total_families: data.demographics_total_families || 0,
          demographics_total_adults: data.demographics_total_adults || 0,
          demographics_total_children: data.demographics_total_children || 0,
          demographics_male_adults: data.demographics_male_adults || 0,
          demographics_female_adults: data.demographics_female_adults || 0,
          demographics_male_children: data.demographics_male_children || 0,
          demographics_female_children: data.demographics_female_children || 0,
          demographics_nationalities: (data.demographics_nationalities as Record<string, number>) || {},
          demographics_notes: data.demographics_notes,
          demographics_updated_at: data.demographics_updated_at
        });
      }
    } catch (error) {
      console.error('Error loading demographics:', error);
      toast.error('Failed to load demographics data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('marketplace_events')
        .update({
          demographics_total_families: demographics.demographics_total_families,
          demographics_total_adults: demographics.demographics_total_adults,
          demographics_total_children: demographics.demographics_total_children,
          demographics_male_adults: demographics.demographics_male_adults,
          demographics_female_adults: demographics.demographics_female_adults,
          demographics_male_children: demographics.demographics_male_children,
          demographics_female_children: demographics.demographics_female_children,
          demographics_nationalities: demographics.demographics_nationalities,
          demographics_notes: demographics.demographics_notes,
          demographics_updated_at: new Date().toISOString()
        })
        .eq('id', marketplaceId);

      if (error) throw error;

      toast.success('Demographics saved successfully');
      setIsEditing(false);
      onUpdate?.();
      loadDemographics();
    } catch (error) {
      console.error('Error saving demographics:', error);
      toast.error('Failed to save demographics');
    } finally {
      setIsSaving(false);
    }
  };

  const addNationality = () => {
    if (!newNationality.trim()) return;
    
    setDemographics(prev => ({
      ...prev,
      demographics_nationalities: {
        ...prev.demographics_nationalities,
        [newNationality.trim()]: newNationalityCount
      }
    }));
    setNewNationality('');
    setNewNationalityCount(0);
  };

  const removeNationality = (nationality: string) => {
    setDemographics(prev => {
      const updated = { ...prev.demographics_nationalities };
      delete updated[nationality];
      return { ...prev, demographics_nationalities: updated };
    });
  };

  const updateNationalityCount = (nationality: string, count: number) => {
    setDemographics(prev => ({
      ...prev,
      demographics_nationalities: {
        ...prev.demographics_nationalities,
        [nationality]: count
      }
    }));
  };

  const totalPeople = demographics.demographics_total_adults + demographics.demographics_total_children;
  const hasDemographicsData = demographics.demographics_updated_at !== null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="p-4 md:p-6 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-lg">Beneficiary Demographics</h3>
            <p className="text-xs text-muted-foreground">
              {hasDemographicsData 
                ? `Last updated: ${new Date(demographics.demographics_updated_at!).toLocaleDateString()}`
                : 'No data entered yet'
              }
            </p>
          </div>
        </div>
        
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit2 className="w-4 h-4 mr-2" />
            {hasDemographicsData ? 'Edit' : 'Add Data'}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="p-4 md:p-6">
        {!isEditing ? (
          // View Mode
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Home className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold">{demographics.demographics_total_families}</p>
                <p className="text-xs text-muted-foreground">Families</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <UserCheck className="w-5 h-5 mx-auto mb-2 text-emerald-500" />
                <p className="text-2xl font-bold">{demographics.demographics_total_adults}</p>
                <p className="text-xs text-muted-foreground">Adults</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Baby className="w-5 h-5 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold">{demographics.demographics_total_children}</p>
                <p className="text-xs text-muted-foreground">Children</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Users className="w-5 h-5 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold">{totalPeople}</p>
                <p className="text-xs text-muted-foreground">Total People</p>
              </div>
            </div>

            {/* Gender Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/20">
                <h4 className="font-medium text-sm mb-3 text-blue-600">Male Breakdown</h4>
                <div className="flex justify-between text-sm">
                  <span>Adults:</span>
                  <span className="font-medium">{demographics.demographics_male_adults}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Children:</span>
                  <span className="font-medium">{demographics.demographics_male_children}</span>
                </div>
              </div>
              <div className="bg-pink-500/5 rounded-lg p-4 border border-pink-500/20">
                <h4 className="font-medium text-sm mb-3 text-pink-600">Female Breakdown</h4>
                <div className="flex justify-between text-sm">
                  <span>Adults:</span>
                  <span className="font-medium">{demographics.demographics_female_adults}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Children:</span>
                  <span className="font-medium">{demographics.demographics_female_children}</span>
                </div>
              </div>
            </div>

            {/* Nationalities */}
            {Object.keys(demographics.demographics_nationalities).length > 0 && (
              <div>
                <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Nationality Breakdown
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {Object.entries(demographics.demographics_nationalities)
                    .sort((a, b) => b[1] - a[1])
                    .map(([nationality, count]) => (
                      <div key={nationality} className="bg-muted/50 rounded-lg px-3 py-2 flex justify-between items-center">
                        <span className="text-sm truncate">{nationality}</span>
                        <span className="font-medium text-sm ml-2">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {demographics.demographics_notes && (
              <div className="bg-muted/30 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2">Notes</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{demographics.demographics_notes}</p>
              </div>
            )}

            {!hasDemographicsData && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No demographics data entered yet.</p>
                <p className="text-sm">Click "Add Data" to enter beneficiary demographics.</p>
              </div>
            )}
          </motion.div>
        ) : (
          // Edit Mode
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Family & Totals */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="total_families">Total Families</Label>
                <Input
                  id="total_families"
                  type="number"
                  min="0"
                  value={demographics.demographics_total_families}
                  onChange={(e) => setDemographics(prev => ({
                    ...prev,
                    demographics_total_families: parseInt(e.target.value) || 0
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="total_adults">Total Adults</Label>
                <Input
                  id="total_adults"
                  type="number"
                  min="0"
                  value={demographics.demographics_total_adults}
                  onChange={(e) => setDemographics(prev => ({
                    ...prev,
                    demographics_total_adults: parseInt(e.target.value) || 0
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="total_children">Total Children</Label>
                <Input
                  id="total_children"
                  type="number"
                  min="0"
                  value={demographics.demographics_total_children}
                  onChange={(e) => setDemographics(prev => ({
                    ...prev,
                    demographics_total_children: parseInt(e.target.value) || 0
                  }))}
                />
              </div>
            </div>

            {/* Gender Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="male_adults">Male Adults</Label>
                <Input
                  id="male_adults"
                  type="number"
                  min="0"
                  value={demographics.demographics_male_adults}
                  onChange={(e) => setDemographics(prev => ({
                    ...prev,
                    demographics_male_adults: parseInt(e.target.value) || 0
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="female_adults">Female Adults</Label>
                <Input
                  id="female_adults"
                  type="number"
                  min="0"
                  value={demographics.demographics_female_adults}
                  onChange={(e) => setDemographics(prev => ({
                    ...prev,
                    demographics_female_adults: parseInt(e.target.value) || 0
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="male_children">Male Children</Label>
                <Input
                  id="male_children"
                  type="number"
                  min="0"
                  value={demographics.demographics_male_children}
                  onChange={(e) => setDemographics(prev => ({
                    ...prev,
                    demographics_male_children: parseInt(e.target.value) || 0
                  }))}
                />
              </div>
              <div>
                <Label htmlFor="female_children">Female Children</Label>
                <Input
                  id="female_children"
                  type="number"
                  min="0"
                  value={demographics.demographics_female_children}
                  onChange={(e) => setDemographics(prev => ({
                    ...prev,
                    demographics_female_children: parseInt(e.target.value) || 0
                  }))}
                />
              </div>
            </div>

            {/* Nationalities */}
            <div>
              <Label className="flex items-center gap-2 mb-3">
                <Globe className="w-4 h-4" />
                Nationalities
              </Label>
              
              {/* Existing nationalities */}
              <div className="space-y-2 mb-4">
                {Object.entries(demographics.demographics_nationalities).map(([nationality, count]) => (
                  <div key={nationality} className="flex items-center gap-2">
                    <Input
                      value={nationality}
                      disabled
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min="0"
                      value={count}
                      onChange={(e) => updateNationalityCount(nationality, parseInt(e.target.value) || 0)}
                      className="w-24"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeNationality(nationality)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add new nationality */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Nationality name"
                  value={newNationality}
                  onChange={(e) => setNewNationality(e.target.value)}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min="0"
                  placeholder="Count"
                  value={newNationalityCount || ''}
                  onChange={(e) => setNewNationalityCount(parseInt(e.target.value) || 0)}
                  className="w-24"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={addNationality}
                  disabled={!newNationality.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes about beneficiary demographics..."
                value={demographics.demographics_notes || ''}
                onChange={(e) => setDemographics(prev => ({
                  ...prev,
                  demographics_notes: e.target.value || null
                }))}
                rows={3}
              />
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
