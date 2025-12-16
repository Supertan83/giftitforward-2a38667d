import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Package, 
  TrendingUp, 
  CreditCard,
  ArrowLeft,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/store/useAppStore';
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
  AreaChart,
  Area,
  Legend
} from 'recharts';

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
  const { qrCards, itemTypes } = useAppStore();

  const stats = useMemo(() => {
    const activeCards = qrCards.filter(c => c.status === 'active').length;
    const checkedOutCards = qrCards.filter(c => c.status === 'checked_out' || 
      c.transactions.some(t => t.type === 'check_out')).length;
    const beneficiariesServed = qrCards.filter(c => 
      c.transactions.length > 0
    ).length;
    
    const totalDistributed = itemTypes.reduce((sum, item) => sum + item.distributed, 0);
    
    return {
      activeCards,
      beneficiariesServed,
      totalDistributed,
      totalCards: qrCards.length
    };
  }, [qrCards, itemTypes]);

  const categoryData = useMemo(() => {
    return itemTypes
      .filter(item => item.distributed > 0)
      .map(item => ({
        name: item.name,
        value: item.distributed,
        icon: item.icon
      }))
      .sort((a, b) => b.value - a.value);
  }, [itemTypes]);

  const hourlyData = useMemo(() => {
    const hourMap = new Map<number, { distributions: number; checkIns: number }>();
    
    // Initialize all hours
    for (let i = 0; i < 24; i++) {
      hourMap.set(i, { distributions: 0, checkIns: 0 });
    }
    
    // Aggregate transactions by hour
    qrCards.forEach(card => {
      card.transactions.forEach(tx => {
        const hour = new Date(tx.timestamp).getHours();
        const current = hourMap.get(hour)!;
        
        if (tx.type === 'distribution') {
          current.distributions++;
        } else if (tx.type === 'check_in') {
          current.checkIns++;
        }
      });
    });
    
    // Convert to array, filter to business hours (6am - 10pm)
    return Array.from(hourMap.entries())
      .filter(([hour]) => hour >= 6 && hour <= 22)
      .map(([hour, data]) => ({
        hour: `${hour}:00`,
        distributions: data.distributions,
        checkIns: data.checkIns
      }));
  }, [qrCards]);

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
      title: 'Total Cards',
      value: stats.totalCards,
      icon: Activity,
      color: 'text-blue-500'
    }
  ];

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

        {/* Hourly Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Activity className="h-5 w-5 text-primary" />
                Hourly Distribution Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData}>
                    <defs>
                      <linearGradient id="colorDistributions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCheckIns" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="hour" 
                      stroke="hsl(var(--muted-foreground))"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="distributions"
                      name="Distributions"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorDistributions)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="checkIns"
                      name="Check-ins"
                      stroke="hsl(var(--chart-2))"
                      fillOpacity={1}
                      fill="url(#colorCheckIns)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
};
