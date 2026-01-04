import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Package, 
  TrendingUp, 
  CreditCard,
  ArrowLeft,
  Activity,
  Loader2,
  User,
  Heart,
  Baby,
  Globe,
  UserCheck,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQRCards, useItemTypes, useBeneficiaryDemographics, useVolunteerQRCards } from '@/hooks/useSupabaseData';
import { useMarketplaceAllocations } from '@/hooks/useMarketplaceAllocations';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { Progress } from '@/components/ui/progress';

interface StatisticsDashboardProps {
  onBack: () => void;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export const StatisticsDashboard = ({ onBack }: StatisticsDashboardProps) => {
  const { data: qrCards = [], isLoading: cardsLoading } = useQRCards();
  const { data: itemTypes = [], isLoading: itemsLoading } = useItemTypes();
  const { data: demographics, isLoading: demographicsLoading } = useBeneficiaryDemographics();
  const { data: volunteerCards = [], isLoading: volunteersLoading } = useVolunteerQRCards();
  const { data: allocations = [], isLoading: allocationsLoading } = useMarketplaceAllocations();

  const isLoading = cardsLoading || itemsLoading || demographicsLoading || volunteersLoading || allocationsLoading;

  const stats = useMemo(() => {
    const activeCards = qrCards.filter(c => c.status === 'active').length;
    const checkedOutCards = qrCards.filter(c => c.status === 'checked_out').length;
    // Count cards that have been used (not in 'ready' status)
    const beneficiariesServed = qrCards.filter(c => c.status !== 'ready').length;
    
    // Use marketplace allocations for accurate distributed count
    const totalDistributed = allocations.reduce((sum, a) => sum + a.distributedQuantity, 0);
    
    return {
      activeCards,
      beneficiariesServed,
      totalDistributed,
      totalCards: qrCards.length
    };
  }, [qrCards, allocations]);

  // Volunteer statistics
  const volunteerStats = useMemo(() => {
    const checkedIn = volunteerCards.filter(v => v.status === 'checked_in');
    const checkedOut = volunteerCards.filter(v => v.status === 'checked_out');
    const totalHoursWorked = volunteerCards.reduce((sum, v) => sum + (v.total_hours_worked || 0), 0);

    return {
      totalVolunteers: volunteerCards.length,
      currentlyActive: checkedIn.length,
      checkedOut: checkedOut.length,
      totalHoursWorked: Math.round(totalHoursWorked * 10) / 10,
    };
  }, [volunteerCards]);

  const categoryData = useMemo(() => {
    // Use allocations for distributed item data
    return allocations
      .filter(alloc => alloc.distributedQuantity > 0)
      .map(alloc => ({
        name: alloc.itemName || 'Unknown',
        value: alloc.distributedQuantity,
        icon: alloc.itemIcon || '📦'
      }))
      .sort((a, b) => b.value - a.value);
  }, [allocations]);

  const genderData = useMemo(() => {
    if (!demographics) return [];
    return demographics.genderBreakdown.map(item => ({
      name: item.gender.charAt(0).toUpperCase() + item.gender.slice(1),
      value: item.count
    }));
  }, [demographics]);

  const maritalData = useMemo(() => {
    if (!demographics) return [];
    return demographics.maritalBreakdown.map(item => ({
      name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
      value: item.count
    }));
  }, [demographics]);

  const nationalityData = useMemo(() => {
    if (!demographics) return [];
    return demographics.nationalityBreakdown
      .slice(0, 5)
      .map(item => ({
        name: item.nationality.charAt(0).toUpperCase() + item.nationality.slice(1),
        value: item.count
      }));
  }, [demographics]);

  const summaryCards = [
    {
      title: 'Beneficiaries Served',
      value: stats.beneficiariesServed,
      icon: Users,
      color: 'text-primary'
    },
    {
      title: 'Items Distributed',
      value: stats.totalDistributed,
      icon: Package,
      color: 'text-emerald-500'
    },
    {
      title: 'Active Cards',
      value: stats.activeCards,
      icon: CreditCard,
      color: 'text-amber-500'
    },
    {
      title: 'Active Volunteers',
      value: volunteerStats.currentlyActive,
      icon: UserCheck,
      color: 'text-success'
    },
    {
      title: 'Total Children',
      value: demographics?.totalChildren || 0,
      icon: Baby,
      color: 'text-pink-500'
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Live Statistics
            </h1>
            <p className="text-muted-foreground">Real-time distribution analytics</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {summaryCards.map((card, index) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-card border-border">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs md:text-sm text-muted-foreground">{card.title}</p>
                      <p className="text-2xl md:text-3xl font-bold text-foreground">{card.value}</p>
                    </div>
                    <card.icon className={`h-8 w-8 md:h-10 md:w-10 ${card.color} opacity-80`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Items by Category */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-card border-border h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Package className="h-5 w-5 text-primary" />
                  Items by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categoryData.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}
                        >
                          {categoryData.map((_, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={COLORS[index % COLORS.length]} 
                            />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No distribution data yet
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Distribution Bar Chart */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-card border-border h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Distribution by Item Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categoryData.length > 0 ? (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={80}
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar 
                          dataKey="value" 
                          fill="hsl(var(--primary))"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No distribution data yet
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Demographics Section */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Gender Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="bg-card border-border h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <User className="h-5 w-5 text-primary" />
                  Gender Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {genderData.length > 0 ? (
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={genderData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {genderData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    No demographic data yet
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Marital Status Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="bg-card border-border h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Heart className="h-5 w-5 text-primary" />
                  Marital Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {maritalData.length > 0 ? (
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={maritalData}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {maritalData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    No demographic data yet
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Nationality Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card className="bg-card border-border h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Globe className="h-5 w-5 text-primary" />
                  Top Nationalities
                </CardTitle>
              </CardHeader>
              <CardContent>
                {nationalityData.length > 0 ? (
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={nationalityData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={60}
                          stroke="hsl(var(--muted-foreground))"
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar 
                          dataKey="value" 
                          fill="hsl(var(--chart-2))"
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                    No demographic data yet
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Volunteer Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <UserCheck className="h-5 w-5 text-success" />
                Volunteer Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-success">{volunteerStats.currentlyActive}</p>
                  <p className="text-xs text-muted-foreground">Currently Active</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{volunteerStats.totalVolunteers}</p>
                  <p className="text-xs text-muted-foreground">Total Volunteers</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-amber-500">{volunteerStats.totalHoursWorked}</p>
                  <p className="text-xs text-muted-foreground">Hours Worked</p>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-muted-foreground">{volunteerStats.checkedOut}</p>
                  <p className="text-xs text-muted-foreground">Checked Out</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active vs Total</span>
                  <span className="font-medium">
                    {volunteerStats.currentlyActive} / {volunteerStats.totalVolunteers}
                  </span>
                </div>
                <Progress 
                  value={volunteerStats.totalVolunteers > 0 
                    ? (volunteerStats.currentlyActive / volunteerStats.totalVolunteers) * 100 
                    : 0
                  } 
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className="bg-card border-border">
            <CardContent className="p-6 text-center">
              <Activity className="h-8 w-8 text-primary mx-auto mb-3" />
              <p className="text-muted-foreground">
                Statistics update in real-time as distributions occur.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
};
