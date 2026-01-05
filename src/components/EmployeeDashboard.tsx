import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { User, UserCheck, BarChart3, LogOut, Unlock } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { VolunteerZone } from '@/components/zones/VolunteerZone';
import { StatsDashboardZone } from '@/components/zones/StatsDashboardZone';
import { UnblockCardsZone } from '@/components/zones/UnblockCardsZone';
import { useAuth } from '@/contexts/AuthContext';
import { useQRCards } from '@/hooks/useSupabaseData';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isToday, parseISO } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Zone = 'volunteers' | 'unblock' | 'stats';

export const EmployeeDashboard = () => {
  const [activeZone, setActiveZone] = useState<Zone>('volunteers');
  const { user, signOut } = useAuth();
  const { data: cards = [] } = useQRCards();

  // Count previous day blocked cards for badge
  const previousDayBlockedCount = useMemo(() => {
    return cards.filter(card => {
      const isBlocked = card.status === 'active' || card.status === 'checked_out' || card.marketplaceId;
      if (!isBlocked) return false;
      if (!card.activatedAt) return true; // No activation date means it's old
      return !isToday(parseISO(card.activatedAt));
    }).length;
  }, [cards]);

  const zones = [
    { id: 'volunteers' as Zone, label: 'Volunteers', icon: UserCheck, color: 'text-success', badge: 0 },
    { id: 'unblock' as Zone, label: 'Unblock', icon: Unlock, color: 'text-warning', badge: previousDayBlockedCount },
    { id: 'stats' as Zone, label: 'Stats', icon: BarChart3, color: 'text-primary', badge: 0 },
  ];

  const renderZone = () => {
    switch (activeZone) {
      case 'volunteers':
        return <VolunteerZone />;
      case 'unblock':
        return <UnblockCardsZone />;
      case 'stats':
        return <StatsDashboardZone />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <div>
              <h1 className="font-display font-bold text-sm">GIF (Gift it Forward)</h1>
              <p className="text-xs text-muted-foreground">Employee Mode</p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div>
                  <p className="font-medium">Employee</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {renderZone()}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-card border-t border-border sticky bottom-0 z-10 safe-area-inset-bottom">
        <div className="flex">
          {zones.map((zone) => {
            const Icon = zone.icon;
            const isActive = activeZone === zone.id;
            
            return (
              <button
                key={zone.id}
                onClick={() => setActiveZone(zone.id)}
                className={cn(
                  'flex-1 py-3 flex flex-col items-center gap-1 transition-all relative',
                  isActive ? zone.color : 'text-muted-foreground'
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="employeeActiveTab"
                    className="absolute top-0 left-2 right-2 h-0.5 bg-current rounded-full"
                  />
                )}
                <div className="relative">
                  <Icon className={cn('w-5 h-5', isActive && 'scale-110')} />
                  {zone.badge > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-3 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center"
                    >
                      {zone.badge > 99 ? '99+' : zone.badge}
                    </Badge>
                  )}
                </div>
                <span className={cn(
                  'text-xs font-medium',
                  isActive && 'font-semibold'
                )}>
                  {zone.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
