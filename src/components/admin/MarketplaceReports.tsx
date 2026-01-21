import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  BarChart3, 
  Users, 
  Package, 
  MapPin, 
  Calendar,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Loader2,
  PieChart as PieChartIcon,
  Building2,
  Tags
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useMarketplaces } from '@/hooks/useSupabaseData';
import { useMarketplaceReport, useAllMarketplaceReports } from '@/hooks/useMarketplaceAllocations';
import { MarketplaceDemographicsEditor } from './MarketplaceDemographicsEditor';
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

interface MarketplaceReportsProps {
  onBack: () => void;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const MarketplaceReports = ({ onBack }: MarketplaceReportsProps) => {
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    beneficiaries: true,
    items: true,
    volunteers: true,
  });

  const { data: marketplaces = [], isLoading: loadingMarketplaces } = useMarketplaces();
  const { data: report, isLoading: loadingReport } = useMarketplaceReport(selectedMarketplaceId || undefined);
  const { data: allReports = [], isLoading: loadingAllReports } = useAllMarketplaceReports();

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const formatGenderData = (data: Record<string, number>) => {
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  };

  return (
    <div className="min-h-screen bg-background">
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
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder="Choose a marketplace to view report..." />
            </SelectTrigger>
            <SelectContent>
              {marketplaces.map(mp => (
                <SelectItem key={mp.id} value={mp.id}>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    {mp.name}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      mp.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                      mp.status === 'active' ? 'bg-blue-500/10 text-blue-600' :
                      'bg-amber-500/10 text-amber-600'
                    }`}>
                      {mp.status}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* All Marketplaces Overview */}
        {!selectedMarketplaceId && (
          <div className="space-y-6">
            <h2 className="font-display font-bold text-lg">All Marketplaces Overview</h2>
            
            {loadingAllReports ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : allReports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No marketplace data available</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {allReports.map((mp, index) => (
                  <motion.div
                    key={mp.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-card rounded-xl border border-border p-4 md:p-6 shadow-card cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setSelectedMarketplaceId(mp.id)}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-display font-semibold text-lg">{mp.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            mp.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                            mp.status === 'active' ? 'bg-blue-500/10 text-blue-600' :
                            'bg-amber-500/10 text-amber-600'
                          }`}>
                            {mp.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {mp.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {mp.location}
                            </span>
                          )}
                          {mp.eventDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(mp.eventDate).toLocaleDateString()}
                            </span>
                          )}
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
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected Marketplace Report */}
        {selectedMarketplaceId && (
          <div className="space-y-6">
            {loadingReport ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : report ? (
              <>
                {/* Marketplace Info Header */}
                <div className="bg-card rounded-xl border border-border p-4 md:p-6 shadow-card mb-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="font-display font-bold text-xl">{report.marketplace.name}</h2>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                        {report.marketplace.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {report.marketplace.location}
                          </span>
                        )}
                        {report.marketplace.eventDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(report.marketplace.eventDate).toLocaleDateString()}
                          </span>
                        )}
                        {report.marketplace.outreachPartner && (
                          <span className="flex items-center gap-1 text-primary font-medium">
                            <Building2 className="w-4 h-4" />
                            {report.marketplace.outreachPartner}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className={`text-sm px-3 py-1 rounded-full self-start ${
                      report.marketplace.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' :
                      report.marketplace.status === 'active' ? 'bg-blue-500/10 text-blue-600' :
                      'bg-amber-500/10 text-amber-600'
                    }`}>
                      {report.marketplace.status}
                    </span>
                  </div>
                </div>

                {/* Header Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="bg-card rounded-xl border border-border p-4 shadow-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary-soft flex items-center justify-center">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{report.beneficiaries.total}</p>
                        <p className="text-xs text-muted-foreground">Beneficiaries</p>
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
                <MarketplaceDemographicsEditor
                  marketplaceId={selectedMarketplaceId}
                  marketplaceName={report.marketplace.name}
                  marketplaceLocation={report.marketplace.location}
                  marketplaceDate={report.marketplace.eventDate}
                />

                {/* Items Section */}
                <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                  <button
                    onClick={() => toggleSection('items')}
                    className="w-full p-4 md:p-6 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-emerald-500" />
                      <h3 className="font-display font-semibold text-lg">Item Distribution</h3>
                    </div>
                    {expandedSections.items ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  
                  {expandedSections.items && (
                    <div className="px-4 md:px-6 pb-6">
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

                      {/* Category Summary */}
                      {Object.keys(report.items.byCategory).length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                            <Tags className="w-4 h-4" />
                            By Category
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {Object.entries(report.items.byCategory).map(([category, data]) => (
                              <div key={category} className="bg-muted/30 rounded-lg p-3">
                                <p className="font-medium text-sm mb-2">{category}</p>
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="text-muted-foreground">Allocated: <span className="font-semibold text-foreground">{data.allocated}</span></span>
                                  <span className="text-emerald-600">Distributed: {data.distributed}</span>
                                  <span className="text-amber-600">Left: {data.remaining}</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                                  <div 
                                    className="h-full bg-emerald-500 rounded-full transition-all"
                                    style={{ width: `${data.allocated > 0 ? (data.distributed / data.allocated) * 100 : 0}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Item Type Breakdown */}
                      {report.items.byItemType.length > 0 ? (
                        <>
                          <h4 className="text-sm font-medium text-muted-foreground mb-3">By Item Type</h4>
                          <div className="space-y-3">
                            {report.items.byItemType.map((item) => (
                              <div key={item.itemId} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                                <span className="text-2xl">{item.itemIcon}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="font-medium">{item.itemName}</p>
                                    {item.category && (
                                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                                        {item.category}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                        style={{ width: `${item.allocated > 0 ? (item.distributed / item.allocated) * 100 : 0}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {item.distributed}/{item.allocated}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-amber-600">{item.remaining}</p>
                                  <p className="text-xs text-muted-foreground">left</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p>No items allocated to this marketplace</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Volunteers Section */}
                <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                  <button
                    onClick={() => toggleSection('volunteers')}
                    className="w-full p-4 md:p-6 flex items-center justify-between text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-blue-500" />
                      <h3 className="font-display font-semibold text-lg">Volunteer Activity</h3>
                    </div>
                    {expandedSections.volunteers ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  
                  {expandedSections.volunteers && (
                    <div className="px-4 md:px-6 pb-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-500/10 rounded-lg p-6 text-center">
                          <p className="text-3xl font-bold text-blue-600">{report.volunteers?.total || 0}</p>
                          <p className="text-sm text-muted-foreground mt-1">Total Volunteers</p>
                        </div>
                        <div className="bg-purple-500/10 rounded-lg p-6 text-center">
                          <p className="text-3xl font-bold text-purple-600">{report.volunteers?.totalHours.toFixed(1) || 0}</p>
                          <p className="text-sm text-muted-foreground mt-1">Total Hours Worked</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <PieChartIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a marketplace to view its report</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
