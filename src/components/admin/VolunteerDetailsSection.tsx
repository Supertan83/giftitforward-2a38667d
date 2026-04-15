import { motion } from 'framer-motion';
import { Users, UserCheck, UserX, UsersRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useVolunteerDetails } from '@/hooks/useVolunteerDetails';
import { Skeleton } from '@/components/ui/skeleton';

interface VolunteerDetailsSectionProps {
  marketplaceName?: string;
  marketplaceId?: string;
}

export const VolunteerDetailsSection = ({ marketplaceName, marketplaceId }: VolunteerDetailsSectionProps) => {
  const { data, isLoading } = useVolunteerDetails(marketplaceName, marketplaceId);

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-40" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const summaryCards = [
    {
      label: 'Total Registered',
      value: data.totalRegistered.toLocaleString(),
      sub: `QR Cards: ${data.totalWithQRCards}`,
      color: 'text-primary',
      bgColor: 'bg-primary/5 border-primary/20',
    },
    {
      label: 'Total Attended',
      value: data.totalAttended.toLocaleString(),
      sub: 'Checked in / out',
      color: 'text-success',
      bgColor: 'bg-success/5 border-success/20',
    },
    {
      label: 'Family Members',
      value: data.familyMembers.toLocaleString(),
      sub: `Registered: ${data.totalRegistered}`,
      color: 'text-violet-600',
      bgColor: 'bg-violet-500/5 border-violet-500/20',
    },
    {
      label: 'Drop-out Rate',
      value: `${data.dropoutRate}%`,
      sub: `${data.totalRegistered - data.totalAttended} did not attend`,
      color: 'text-destructive',
      bgColor: 'bg-destructive/5 border-destructive/20',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.85 }}
    >
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <UsersRound className="h-5 w-5 text-primary" />
            Volunteer Details
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Comprehensive volunteer tracking and attendance data
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {summaryCards.map((card, i) => (
              <div
                key={card.label}
                className={`rounded-lg border p-3 md:p-4 ${card.bgColor}`}
              >
                <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                <p className={`text-xl md:text-2xl font-bold ${card.color}`}>
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Category Breakdown Table - Desktop */}
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
                {data.categoryBreakdown.map((row) => (
                  <tr key={row.category} className="border-b border-border/50 last:border-0">
                    <td className="py-3 px-2 font-medium text-foreground">{row.category}</td>
                    <td className="py-3 px-2 text-foreground">{row.registered}</td>
                    <td className="py-3 px-2 text-success font-medium">{row.attended}</td>
                    <td className="py-3 px-2 text-warning font-medium">{row.dropoutRate}%</td>
                    <td className="py-3 px-2 text-foreground">{row.maleCount} / {row.femaleCount}</td>
                    <td className="py-3 px-2 text-muted-foreground text-xs">
                      {row.topCompanies.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Category Breakdown Cards - Mobile */}
          <div className="space-y-3 md:hidden">
            {data.categoryBreakdown.map((row) => (
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
                <p className="text-xs text-muted-foreground">
                  {row.topCompanies.join(', ')}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
