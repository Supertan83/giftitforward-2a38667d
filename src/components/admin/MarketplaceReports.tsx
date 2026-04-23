import { useState, useEffect, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { VolunteerBulkHoursEditDialog, type BulkVolunteerEditTarget } from './VolunteerBulkHoursEditDialog';
import { motion } from 'framer-motion';
import { ArrowLeft, BarChart3, Users, Package, MapPin, Calendar, Clock, TrendingUp, ChevronDown, ChevronUp, Loader2, PieChart as PieChartIcon, Building2, Tags, Send, Pencil, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMarketplaces } from '@/hooks/useSupabaseData';
import { useMarketplaceReport, useAllMarketplaceReports } from '@/hooks/useMarketplaceAllocations';
import { MarketplaceDemographicsEditor } from './MarketplaceDemographicsEditor';
import { MarketplaceManualDataEditor } from './MarketplaceManualDataEditor';
import { useSurplussVolunteerBeneficiarySync } from '@/hooks/useSurplussVolunteerBeneficiarySync';
import { VolunteerHoursEditDialog } from './VolunteerHoursEditDialog';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
interface MarketplaceReportsProps {
  onBack: () => void;
}
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
export const MarketplaceReports = ({
  onBack
}: MarketplaceReportsProps) => {
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string>('');
  const [surplussEnv, setSurplussEnv] = useState<'staging' | 'production'>('production');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    beneficiaries: true,
    items: true,
    volunteers: true
  });
  const { isSyncing, syncToSurpluss } = useSurplussVolunteerBeneficiarySync();
  const [editingVolunteer, setEditingVolunteer] = useState<{
    cardId: string; name: string; checkedInAt: string | null; checkedOutAt: string | null; hoursWorked: number; marketplaceId?: string;
  } | null>(null);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  // Clear selection when marketplace changes
  useEffect(() => {
    setSelectedCardIds(new Set());
  }, [selectedMarketplaceId]);

  const toggleCard = (cardId: string) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };
  const {
    data: marketplaces = [],
    isLoading: loadingMarketplaces
  } = useMarketplaces();
  const {
    data: report,
    isLoading: loadingReport
  } = useMarketplaceReport(selectedMarketplaceId || undefined);
  const {
    data: allReports = [],
    isLoading: loadingAllReports
  } = useAllMarketplaceReports();
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  const formatGenderData = (data: Record<string, number>) => {
    return Object.entries(data).map(([name, value]) => ({
      name,
      value
    }));
  };
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="container max-w-6xl py-3 md:py-4 px-4">
          <div className="flex items-center gap-3 md:gap-4">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-bold text-base md:text-lg truncate">Marketplace Reports</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Detailed insights for each marketplace</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl py-4 md:py-6 px-4">
        {/* Marketplace Selector */}
        <div className="mb-6">
          <label className="text-sm font-medium text-muted-foreground mb-2 block">Select Marketplace</label>
          <Select value={selectedMarketplaceId} onValueChange={setSelectedMarketplaceId}>
            <SelectTrigger className="w-full md:w-[32rem]">
              <SelectValue placeholder="Choose a marketplace to view report..." />
            </SelectTrigger>
            <SelectContent className="min-w-[var(--radix-select-trigger-width)] max-w-[90vw]">
              {marketplaces.map(mp => <SelectItem key={mp.id} value={mp.id} className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{mp.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${mp.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : mp.status === 'active' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'}`}>
                      {mp.status}
                    </span>
                  </div>
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* All Marketplaces Overview */}
        {!selectedMarketplaceId && <div className="space-y-6">
            <h2 className="font-display font-bold text-lg">All Marketplaces Overview</h2>
            
            {loadingAllReports ? <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div> : allReports.length === 0 ? <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No marketplace data available</p>
              </div> : <div className="grid gap-4">
                {allReports.map((mp, index) => <motion.div key={mp.id} initial={{
            opacity: 0,
            y: 10
          }} animate={{
            opacity: 1,
            y: 0
          }} transition={{
            delay: index * 0.05
          }} className="bg-card rounded-xl border border-border p-4 md:p-6 shadow-card cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedMarketplaceId(mp.id)}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-display font-semibold text-lg">{mp.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${mp.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : mp.status === 'active' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'}`}>
                            {mp.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {mp.location && <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {mp.location}
                            </span>}
                          {mp.eventDate && <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(mp.eventDate).toLocaleDateString()}
                            </span>}
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4 md:gap-6">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-primary">{mp.beneficiaryCount}</p>
                          <p className="text-xs text-muted-foreground">Beneficiaries</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-emerald-500">{mp.totalDistributed}</p>
                          <p className="text-xs text-muted-foreground">Distributed</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-amber-500">{mp.totalRemaining}</p>
                          <p className="text-xs text-muted-foreground">Remaining</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>)}
              </div>}
          </div>}

        {/* Selected Marketplace Report */}
        {selectedMarketplaceId && <div className="space-y-6">
            {loadingReport ? <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div> : report ? <>
                {/* Marketplace Info Header */}
                <div className="bg-card rounded-xl border border-border p-4 md:p-6 shadow-card mb-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display font-bold text-xl">{report.marketplace.name}</h2>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                        {report.marketplace.location && <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {report.marketplace.location}
                          </span>}
                        {report.marketplace.eventDate && <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(report.marketplace.eventDate).toLocaleDateString()}
                          </span>}
                        {report.marketplace.outreachPartner && <span className="flex items-center gap-1 text-primary font-medium">
                            <Building2 className="w-4 h-4" />
                            {report.marketplace.outreachPartner}
                          </span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-start">
                      <span className={`text-sm px-3 py-1 rounded-full ${report.marketplace.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : report.marketplace.status === 'active' ? 'bg-blue-500/10 text-blue-600' : 'bg-amber-500/10 text-amber-600'}`}>
                        {report.marketplace.status}
                      </span>
                      <div className="flex items-center gap-2">
                        <Select value={surplussEnv} onValueChange={(v) => setSurplussEnv(v as 'staging' | 'production')}>
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="production">Production</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isSyncing}
                          onClick={() => syncToSurpluss(selectedMarketplaceId, surplussEnv)}
                          className="gap-1.5"
                        >
                          {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          Send to Surpluss
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{(report.marketplace as any).manualBeneficiaryCount ?? report.beneficiaries.total}</p>
                        <p className="text-xs text-muted-foreground">
                        <p className="text-xs text-muted-foreground">Beneficiaries</p>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <Package className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{report.items.totalDistributed}</p>
                        <p className="text-xs text-muted-foreground">Items Given</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{report.items.totalRemaining}</p>
                        <p className="text-xs text-muted-foreground">Items Left</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{report.volunteers?.totalHours.toFixed(1) || 0}</p>
                        <p className="text-xs text-muted-foreground">Volunteer Hours</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Beneficiary Demographics Editor */}
                <MarketplaceDemographicsEditor marketplaceId={selectedMarketplaceId} marketplaceName={report.marketplace.name} />

                {/* Marketplace Manual Data Editor */}
                <MarketplaceManualDataEditor marketplaceId={selectedMarketplaceId} marketplaceName={report.marketplace.name} />

                {/* Items Section */}
                <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                  <button onClick={() => toggleSection('items')} className="w-full p-4 md:p-6 flex items-center justify-between text-left hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-emerald-500" />
                      <h3 className="font-display font-semibold text-lg">Item Distribution</h3>
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                        {report.items.byItemType.length} Items
                      </span>
                    </div>
                    {expandedSections.items ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  
                  {expandedSections.items && <div className="px-4 md:px-6 pb-6">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-muted/50 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold">{report.items.totalAllocated}</p>
                          <p className="text-xs text-muted-foreground">Total Allocated</p>
                        </div>
                        <div className="bg-emerald-500/10 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold text-emerald-600">{report.items.totalDistributed}</p>
                          <p className="text-xs text-muted-foreground">Distributed</p>
                        </div>
                        <div className="bg-amber-500/10 rounded-lg p-4 text-center">
                          <p className="text-2xl font-bold text-amber-600">{report.items.totalRemaining}</p>
                          <p className="text-xs text-muted-foreground">Remaining</p>
                        </div>
                      </div>

                      {/* Grouped by Category - Table Layout */}
                      {report.items.byItemType.length > 0 ? (() => {
                        const grouped = report.items.byItemType.reduce((acc, item) => {
                          const cat = item.category || 'Uncategorized';
                          if (!acc[cat]) acc[cat] = [];
                          acc[cat].push(item);
                          return acc;
                        }, {} as Record<string, typeof report.items.byItemType>);

                        return <div className="space-y-6">
                          {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => {
                            const catAllocated = items.reduce((s, i) => s + i.allocated, 0);
                            const catDistributed = items.reduce((s, i) => s + i.distributed, 0);
                            const catRemaining = items.reduce((s, i) => s + i.remaining, 0);
                            return <div key={category} className="bg-muted/20 rounded-xl border border-border overflow-hidden">
                              <div className="flex items-center justify-between p-4 bg-muted/40">
                                <div className="flex items-center gap-3">
                                  <h4 className="font-display font-semibold">{category}</h4>
                                  <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                                    {items.length} Items
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="text-muted-foreground">Allocated: <span className="font-semibold text-foreground">{catAllocated.toLocaleString()}</span></span>
                                  <span className="text-muted-foreground">Distributed: <span className="font-semibold text-emerald-600">{catDistributed.toLocaleString()}</span></span>
                                  <span className="text-muted-foreground">Remaining: <span className="font-semibold text-primary">{catRemaining.toLocaleString()}</span></span>
                                </div>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm table-fixed">
                                  <colgroup>
                                    <col className="w-[40%]" />
                                    <col className="w-[20%]" />
                                    <col className="w-[20%]" />
                                    <col className="w-[20%]" />
                                  </colgroup>
                                  <thead>
                                    <tr className="border-b border-border">
                                      <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item Name</th>
                                      <th className="text-center py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Allocated</th>
                                      <th className="text-center py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Distributed</th>
                                      <th className="text-right py-2.5 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Remaining</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map(item => <tr key={item.itemId} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                                      <td className="py-3 px-4">
                                        <p className="font-medium">{item.itemName}</p>
                                        {item.subcategory && <p className="text-xs text-muted-foreground">{item.subcategory}</p>}
                                      </td>
                                      <td className="py-3 px-4 text-center text-muted-foreground">{item.allocated > 0 ? item.allocated.toLocaleString() : '—'}</td>
                                      <td className="py-3 px-4 text-center text-muted-foreground">{item.distributed > 0 ? item.distributed.toLocaleString() : '—'}</td>
                                      <td className="py-3 px-4 text-right font-semibold text-primary">{item.remaining.toLocaleString()}</td>
                                    </tr>)}
                                  </tbody>
                                </table>
                              </div>
                            </div>;
                          })}
                        </div>;
                      })() : <div className="text-center py-8 text-muted-foreground">
                          <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p>No items allocated to this marketplace</p>
                        </div>}
                    </div>}
                </div>

                {/* Volunteers Section */}
                <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                  <button onClick={() => toggleSection('volunteers')} className="w-full p-4 md:p-6 flex items-center justify-between text-left hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-primary" />
                      <h3 className="font-display font-semibold text-lg">Volunteer Details</h3>
                    </div>
                    {expandedSections.volunteers ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  
                  {expandedSections.volunteers && <div className="px-4 md:px-6 pb-6 space-y-6">
                      <p className="text-sm text-muted-foreground">Comprehensive volunteer tracking and attendance data</p>
                      
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                        <div className="rounded-lg border p-3 md:p-4 bg-primary/5 border-primary/20">
                          <p className="text-xs text-muted-foreground mb-1">Total Registered</p>
                          <p className="text-xl md:text-2xl font-bold text-primary">{report.volunteers?.totalRegistered || 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Volunteers + Family</p>
                        </div>
                        <div className="rounded-lg border p-3 md:p-4 bg-success/5 border-success/20">
                          <p className="text-xs text-muted-foreground mb-1">Total Attended</p>
                          <p className="text-xl md:text-2xl font-bold text-success">{report.volunteers?.totalAttended || 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Volunteers</p>
                        </div>
                        <div className="rounded-lg border p-3 md:p-4 bg-violet-500/5 border-violet-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Family Members</p>
                          <p className="text-xl md:text-2xl font-bold text-violet-600">{report.volunteers?.familyMembers || 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Registered: {(report.volunteers?.totalRegistered || 0) - (report.volunteers?.familyMembers || 0)}</p>
                        </div>
                        <div className="rounded-lg border p-3 md:p-4 bg-blue-500/5 border-blue-500/20">
                          <p className="text-xs text-muted-foreground mb-1">Total Hours</p>
                          <p className="text-xl md:text-2xl font-bold text-blue-600">{report.volunteers?.totalHours.toFixed(1) || 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Hours Worked</p>
                        </div>
                        <div className="rounded-lg border p-3 md:p-4 bg-destructive/5 border-destructive/20">
                          <p className="text-xs text-muted-foreground mb-1">Drop-out Rate</p>
                          <p className="text-xl md:text-2xl font-bold text-destructive">{report.volunteers?.dropoutRate || 0}%</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{(report.volunteers?.totalRegistered || 0) - (report.volunteers?.familyMembers || 0) - (report.volunteers?.totalAttended || 0)} volunteers</p>
                        </div>
                        <div className="rounded-lg border p-3 md:p-4 bg-amber-500/5 border-amber-500/20">
                          <div className="flex items-center gap-1.5 mb-1">
                            <GraduationCap className="w-3.5 h-3.5 text-amber-600" />
                            <p className="text-xs text-muted-foreground">Training After Event</p>
                          </div>
                          <p className="text-xl md:text-2xl font-bold text-amber-600">{report.volunteers?.trainingCompletedAfterEvent || 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Completed post-event</p>
                        </div>
                      </div>

                      {/* Category Breakdown Table - Desktop */}
                      {report.volunteers?.categoryBreakdown && report.volunteers.categoryBreakdown.length > 0 && <>
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border text-muted-foreground">
                                <th className="text-left py-3 px-2 font-medium">Category</th>
                                <th className="text-left py-3 px-2 font-medium">Registered</th>
                                <th className="text-left py-3 px-2 font-medium">Attended</th>
                                <th className="text-left py-3 px-2 font-medium">Drop-out Rate</th>
                                <th className="text-left py-3 px-2 font-medium">Gender (M/F)</th>
                                <th className="text-left py-3 px-2 font-medium">Top Companies</th>
                              </tr>
                            </thead>
                            <tbody>
                              {report.volunteers.categoryBreakdown.map(row => (
                                <tr key={row.category} className="border-b border-border/50 last:border-0">
                                  <td className="py-3 px-2 font-medium text-foreground">{row.category}</td>
                                  <td className="py-3 px-2 text-foreground">{row.registered}</td>
                                  <td className="py-3 px-2 text-success font-medium">{row.attended}</td>
                                  <td className="py-3 px-2 text-warning font-medium">{row.dropoutRate}%</td>
                                  <td className="py-3 px-2 text-foreground">{row.maleCount} / {row.femaleCount}</td>
                                  <td className="py-3 px-2 text-muted-foreground text-xs">{row.topCompanies.join(', ')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Category Breakdown Cards - Mobile */}
                        <div className="space-y-3 md:hidden">
                          {report.volunteers.categoryBreakdown.map(row => (
                            <div key={row.category} className="border border-border rounded-lg p-3 space-y-2">
                              <p className="font-medium text-foreground text-sm">{row.category}</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-muted-foreground">Registered: </span>
                                  <span className="font-medium text-foreground">{row.registered}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Attended: </span>
                                  <span className="font-medium text-success">{row.attended}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Drop-out: </span>
                                  <span className="font-medium text-warning">{row.dropoutRate}%</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">M/F: </span>
                                  <span className="font-medium text-foreground">{row.maleCount} / {row.femaleCount}</span>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground">{row.topCompanies.join(', ')}</p>
                            </div>
                          ))}
                        </div>
                      </>}

                      {/* Individual Volunteer List */}
                      {report.volunteers?.volunteerList && report.volunteers.volunteerList.length > 0 && (() => {
                        const list = report.volunteers.volunteerList;
                        const selectableIds: string[] = list.map((v: any) => v.cardId).filter(Boolean);
                        const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedCardIds.has(id));
                        const someSelected = selectableIds.some(id => selectedCardIds.has(id));
                        const toggleAll = () => {
                          setSelectedCardIds(prev => {
                            if (allSelected) {
                              const next = new Set(prev);
                              selectableIds.forEach(id => next.delete(id));
                              return next;
                            }
                            const next = new Set(prev);
                            selectableIds.forEach(id => next.add(id));
                            return next;
                          });
                        };
                        const selectedTargets: BulkVolunteerEditTarget[] = list
                          .filter((v: any) => v.cardId && selectedCardIds.has(v.cardId))
                          .map((v: any) => ({ cardId: v.cardId, name: v.name }));

                        return (
                        <div>
                          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                            <h4 className="font-display font-semibold text-sm">Volunteer List</h4>
                            {selectedCardIds.size > 0 && (
                              <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-md px-3 py-1.5">
                                <span className="text-xs font-medium">{selectedCardIds.size} selected</span>
                                <Button size="sm" variant="default" className="h-7" onClick={() => setBulkEditOpen(true)}>
                                  <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Hours
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelectedCardIds(new Set())}>
                                  Clear
                                </Button>
                              </div>
                            )}
                          </div>
                        <div className="hidden md:block overflow-x-auto">
                          <table className="w-full text-sm table-fixed">
                            <colgroup>
                              <col className="w-[5%]" />
                              <col className="w-[22%]" />
                              <col className="w-[15%]" />
                              <col className="w-[15%]" />
                              <col className="w-[15%]" />
                              <col className="w-[14%]" />
                              <col className="w-[14%]" />
                            </colgroup>
                            <thead>
                              <tr className="border-b border-border text-muted-foreground">
                                <th className="py-3 px-2">
                                  <Checkbox checked={allSelected ? true : (someSelected ? 'indeterminate' : false)} onCheckedChange={toggleAll} aria-label="Select all" />
                                </th>
                                <th className="text-left py-3 px-2 font-medium">Name</th>
                                <th className="text-left py-3 px-2 font-medium">Category</th>
                                <th className="text-left py-3 px-2 font-medium">Company</th>
                                <th className="text-left py-3 px-2 font-medium">Status</th>
                                <th className="text-right py-3 px-2 font-medium">Hours</th>
                                <th className="text-center py-3 px-2 font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {list.map((vol: any, idx: number) => {
                                const cid = vol.cardId as string | undefined;
                                const checked = cid ? selectedCardIds.has(cid) : false;
                                return (
                                <tr key={idx} className="border-b border-border/50 last:border-0">
                                  <td className="py-2.5 px-2">
                                    {cid && (
                                      <Checkbox checked={checked} onCheckedChange={() => toggleCard(cid)} aria-label={`Select ${vol.name}`} />
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 font-medium text-foreground truncate">{vol.name}</td>
                                  <td className="py-2.5 px-2 text-muted-foreground text-xs">{vol.category}</td>
                                  <td className="py-2.5 px-2 text-muted-foreground text-xs truncate">{vol.company}</td>
                                  <td className="py-2.5 px-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      vol.status === 'checked_in' ? 'bg-emerald-500/10 text-emerald-600' :
                                      vol.status === 'checked_out' ? 'bg-blue-500/10 text-blue-600' :
                                      'bg-muted text-muted-foreground'
                                    }`}>
                                      {vol.status === 'checked_in' ? 'Checked In' : vol.status === 'checked_out' ? 'Checked Out' : 'Inactive'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-2 text-right font-medium">{vol.hoursWorked > 0 ? `${vol.hoursWorked.toFixed(1)}h` : '—'}</td>
                                  <td className="py-2.5 px-2 text-center">
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingVolunteer({
                                      cardId: vol.cardId,
                                      name: vol.name,
                                      checkedInAt: vol.checkedInAt,
                                      checkedOutAt: vol.checkedOutAt,
                                      hoursWorked: vol.hoursWorked,
                                      marketplaceId: selectedMarketplaceId || undefined,
                                    })}>
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                  </td>
                                </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {/* Mobile */}
                        <div className="space-y-2 md:hidden">
                          {list.map((vol: any, idx: number) => {
                            const cid = vol.cardId as string | undefined;
                            const checked = cid ? selectedCardIds.has(cid) : false;
                            return (
                            <div key={idx} className="border border-border rounded-lg p-3">
                              <div className="flex justify-between items-start mb-1 gap-2">
                                <div className="flex items-start gap-2 min-w-0">
                                  {cid && (
                                    <Checkbox checked={checked} onCheckedChange={() => toggleCard(cid)} className="mt-0.5" aria-label={`Select ${vol.name}`} />
                                  )}
                                  <p className="font-medium text-sm text-foreground truncate">{vol.name}</p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    vol.status === 'checked_in' ? 'bg-emerald-500/10 text-emerald-600' :
                                    vol.status === 'checked_out' ? 'bg-blue-500/10 text-blue-600' :
                                    'bg-muted text-muted-foreground'
                                  }`}>
                                    {vol.status === 'checked_in' ? 'Checked In' : vol.status === 'checked_out' ? 'Checked Out' : 'Inactive'}
                                  </span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingVolunteer({
                                    cardId: vol.cardId,
                                    name: vol.name,
                                    checkedInAt: vol.checkedInAt,
                                    checkedOutAt: vol.checkedOutAt,
                                    hoursWorked: vol.hoursWorked,
                                    marketplaceId: selectedMarketplaceId || undefined,
                                  })}>
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground pl-6">{vol.category} · {vol.company}</p>
                              {vol.hoursWorked > 0 && <p className="text-xs text-muted-foreground mt-1 pl-6">{vol.hoursWorked.toFixed(1)} hours</p>}
                            </div>
                            );
                          })}
                        </div>
                        <VolunteerBulkHoursEditDialog
                          volunteers={selectedTargets}
                          marketplaceId={selectedMarketplaceId || undefined}
                          open={bulkEditOpen}
                          onOpenChange={setBulkEditOpen}
                          onCompleted={() => setSelectedCardIds(new Set())}
                        />
                      </div>
                        );
                      })()}
                    </div>}
                </div>
              </> : <div className="text-center py-12 text-muted-foreground">
                <PieChartIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a marketplace to view its report</p>
              </div>}
          </div>}
      </main>
      <VolunteerHoursEditDialog
        volunteer={editingVolunteer}
        open={!!editingVolunteer}
        onOpenChange={(open) => { if (!open) setEditingVolunteer(null); }}
      />
    </div>;
};