import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, RefreshCw, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CleanupTable {
  key: string;
  label: string;
  description: string;
  count: number | null;
  loading: boolean;
}

interface CleanupCategory {
  id: string;
  title: string;
  icon: string;
  tables: CleanupTable[];
}

interface DataCleanupManagerProps {
  onBack: () => void;
}

const TABLE_CONFIG: { id: string; title: string; icon: string; tables: { key: string; label: string; description: string }[] }[] = [
  {
    id: 'beneficiary',
    title: 'Beneficiary Data',
    icon: '👥',
    tables: [
      { key: 'qr_cards', label: 'QR Cards', description: 'Reset all cards to inactive (cards preserved)' },
      { key: 'transactions', label: 'Transactions', description: 'Clear all transaction history' },
      { key: 'archived_card_data', label: 'Archived Card Data', description: 'Clear archived beneficiary records' },
    ],
  },
  {
    id: 'volunteer',
    title: 'Volunteer Data',
    icon: '🙋',
    tables: [
      { key: 'volunteer_qr_cards', label: 'Volunteer QR Cards', description: 'Clear volunteer card assignments' },
      { key: 'volunteer_attendance', label: 'Volunteer Attendance', description: 'Clear attendance logs' },
      { key: 'pending_volunteers', label: 'Pending Volunteers', description: 'Clear registration queue' },
    ],
  },
  {
    id: 'marketplace',
    title: 'Marketplace & Inventory',
    icon: '🏪',
    tables: [
      { key: 'marketplace_item_allocations', label: 'Marketplace Allocations', description: 'Clear all item allocations' },
      { key: 'item_types', label: 'Item Type Counters', description: 'Reset distributed/allocated to 0 (keeps definitions)' },
      { key: 'marketplace_manual_counts', label: 'Manual Counts', description: 'Clear manual count entries' },
      { key: 'warehouse_returns', label: 'Warehouse Returns', description: 'Clear return records' },
      { key: 'allocation_traceability_logs', label: 'Traceability Logs', description: 'Clear audit trail' },
    ],
  },
  {
    id: 'survey',
    title: 'Survey Data',
    icon: '📋',
    tables: [
      { key: 'volunteer_surveys', label: 'Volunteer Surveys', description: 'Clear volunteer survey responses' },
      { key: 'external_survey_responses', label: 'External Survey Responses', description: 'Clear external survey responses' },
    ],
  },
  {
    id: 'comms',
    title: 'Communication Logs',
    icon: '📧',
    tables: [
      { key: 'email_send_logs', label: 'Email Send Logs', description: 'Clear email delivery logs' },
    ],
  },
];

export const DataCleanupManager: React.FC<DataCleanupManagerProps> = ({ onBack }) => {
  const [categories, setCategories] = useState<CleanupCategory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [cleaning, setCleaning] = useState(false);
  const [results, setResults] = useState<Record<string, { action: string; count: number }> | null>(null);
  const { toast } = useToast();

  const fetchCounts = async () => {
    const cats: CleanupCategory[] = TABLE_CONFIG.map(cat => ({
      ...cat,
      tables: cat.tables.map(t => ({ ...t, count: null, loading: true })),
    }));
    setCategories(cats);

    const countPromises = TABLE_CONFIG.flatMap(cat =>
      cat.tables.map(async (t) => {
        try {
          const { count, error } = await supabase
            .from(t.key as any)
            .select('*', { count: 'exact', head: true });
          return { key: t.key, count: error ? null : (count ?? 0) };
        } catch {
          return { key: t.key, count: null };
        }
      })
    );

    const counts = await Promise.all(countPromises);
    const countMap = Object.fromEntries(counts.map(c => [c.key, c.count]));

    setCategories(
      TABLE_CONFIG.map(cat => ({
        ...cat,
        tables: cat.tables.map(t => ({
          ...t,
          count: countMap[t.key] ?? null,
          loading: false,
        })),
      }))
    );
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  const toggleTable = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCategory = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const keys = cat.tables.map(t => t.key);
    const allSelected = keys.every(k => selected.has(k));
    setSelected(prev => {
      const next = new Set(prev);
      keys.forEach(k => allSelected ? next.delete(k) : next.add(k));
      return next;
    });
  };

  const isCategoryFullySelected = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.tables.every(t => selected.has(t.key)) : false;
  };

  const isCategoryPartiallySelected = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return false;
    const some = cat.tables.some(t => selected.has(t.key));
    const all = cat.tables.every(t => selected.has(t.key));
    return some && !all;
  };

  const handleCleanup = async () => {
    if (confirmInput !== 'CLEAN') return;
    setCleaning(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('cleanup-data', {
        body: { tables: Array.from(selected) },
      });

      if (error) throw error;

      setResults(data.results);
      const totalCleaned = Object.values(data.results as Record<string, { count: number }>).reduce(
        (sum, r) => sum + r.count, 0
      );
      toast({
        title: 'Cleanup Complete',
        description: `${totalCleaned.toLocaleString()} records processed across ${selected.size} tables`,
      });

      setSelected(new Set());
      setShowConfirm(false);
      setConfirmInput('');
      fetchCounts();
    } catch (error) {
      toast({
        title: 'Cleanup Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setCleaning(false);
    }
  };

  const selectedTables = categories.flatMap(c => c.tables).filter(t => selected.has(t.key));
  const totalSelectedRecords = selectedTables.reduce((sum, t) => sum + (t.count || 0), 0);

  return (
    <div className="py-4 md:py-6 px-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-display font-bold flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Data Cleanup Manager
          </h1>
          <p className="text-sm text-muted-foreground">Select data to clear before a live marketplace event</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCounts}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh Counts
        </Button>
      </div>

      {results && (
        <Card className="mb-4 border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="py-3 px-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              Last cleanup results:
              {Object.entries(results).map(([table, r]) => (
                <Badge key={table} variant="secondary" className="text-xs">
                  {table}: {r.count} {r.action}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {categories.map(cat => (
          <Card key={cat.id}>
            <CardHeader className="py-3 px-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isCategoryFullySelected(cat.id)}
                  ref={(el) => {
                    if (el) {
                      (el as any).indeterminate = isCategoryPartiallySelected(cat.id);
                    }
                  }}
                  onCheckedChange={() => toggleCategory(cat.id)}
                />
                <span className="text-lg">{cat.icon}</span>
                <CardTitle className="text-sm font-semibold">{cat.title}</CardTitle>
                <Badge variant="outline" className="ml-auto text-xs">
                  {cat.tables.reduce((s, t) => s + (t.count || 0), 0).toLocaleString()} total
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-3">
              <div className="space-y-2">
                {cat.tables.map(t => (
                  <label
                    key={t.key}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selected.has(t.key)}
                      onCheckedChange={() => toggleTable(t.key)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{t.label}</span>
                        {t.loading ? (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : (
                          <Badge
                            variant={t.count && t.count > 0 ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {t.count?.toLocaleString() ?? '?'} records
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="sticky bottom-4 mt-6">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div className="text-sm">
                <span className="font-semibold">{selected.size}</span> tables selected ·{' '}
                <span className="font-semibold text-destructive">{totalSelectedRecords.toLocaleString()}</span> records to process
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowConfirm(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clean Selected Data
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirm Data Cleanup
            </DialogTitle>
            <DialogDescription>
              This will permanently remove or reset data from the following tables:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1 max-h-48 overflow-y-auto text-sm">
            {selectedTables.map(t => (
              <div key={t.key} className="flex justify-between py-1 px-2 rounded bg-muted/50">
                <span>{t.label}</span>
                <span className="text-muted-foreground">{t.count?.toLocaleString()} records</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              Type <span className="font-bold text-destructive">CLEAN</span> to confirm:
            </p>
            <Input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Type CLEAN"
              className="font-mono"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowConfirm(false); setConfirmInput(''); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmInput !== 'CLEAN' || cleaning}
              onClick={handleCleanup}
            >
              {cleaning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
              {cleaning ? 'Cleaning...' : 'Confirm Cleanup'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-6 p-3 rounded-lg bg-muted/50 border border-border">
        <p className="text-xs text-muted-foreground">
          <strong>Protected:</strong> Marketplace event definitions, item type definitions, and user accounts are never deleted.
          QR cards are reset (not deleted). Item type counters are reset to 0 (definitions preserved).
        </p>
      </div>
    </div>
  );
};
