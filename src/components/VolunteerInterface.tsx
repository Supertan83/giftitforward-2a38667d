import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LogIn, ShoppingBag, LogOut, User, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { EntranceZone } from '@/components/zones/EntranceZone';
import { MarketplaceZone } from '@/components/zones/MarketplaceZone';
import { ExitZone } from '@/components/zones/ExitZone';
import { useAuth } from '@/contexts/AuthContext';
import { useMarketplaces } from '@/hooks/useSupabaseData';
import { useVolunteerCheckInStatus, VolunteerZone as VolunteerZoneType } from '@/hooks/useVolunteerCheckInStatus';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Zone = 'entrance' | 'marketplace' | 'exit';

const zones = [
  { id: 'entrance' as Zone, label: 'Entrance', icon: LogIn, color: 'text-primary' },
  { id: 'marketplace' as Zone, label: 'Marketplace', icon: ShoppingBag, color: 'text-warning' },
  { id: 'exit' as Zone, label: 'Exit', icon: LogOut, color: 'text-danger' },
];

export const VolunteerInterface = () => {
  const [activeZone, setActiveZone] = useState<Zone>('entrance');
  const [selectedMarketplaceId, setSelectedMarketplaceId] = useState<string>('');
  const { user, signOut } = useAuth();
  const { data: marketplaces = [], isLoading: isLoadingMarketplaces } = useMarketplaces();
  const { data: checkInStatus, isLoading: isLoadingStatus } = useVolunteerCheckInStatus();

  // Filter to show only upcoming or active marketplaces
  const availableMarketplaces = marketplaces.filter(m => m.status === 'upcoming' || m.status === 'active');
  const selectedMarketplace = marketplaces.find(m => m.id === selectedMarketplaceId);

  // Set active zone to assigned zone when check-in status loads
  useEffect(() => {
    if (checkInStatus?.isCheckedIn && checkInStatus.assignedZone) {
      setActiveZone(checkInStatus.assignedZone);
    }
    if (checkInStatus?.marketplaceId) {
      setSelectedMarketplaceId(checkInStatus.marketplaceId);
    }
  }, [checkInStatus?.isCheckedIn, checkInStatus?.assignedZone, checkInStatus?.marketplaceId]);

  // Loading state
  if (isLoadingStatus) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Checking your status...</p>
        </div>
      </div>
    );
  }

  // Not checked in - show blocking message
  if (!checkInStatus?.isCheckedIn) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="bg-card border-b border-border sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrandLogo size="sm" />
              <div>
                <h1 className="font-display font-bold text-sm">GIF (Gift it Forward)</h1>
                <p className="text-xs text-muted-foreground">Volunteer Mode</p>
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
                    <p className="font-medium">Volunteer</p>
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

        {/* Not Checked In Message */}
        <main className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full"
          >
            <Card className="border-warning/50 bg-warning-soft/30">
              <CardHeader className="text-center pb-2">
                <div className="w-16 h-16 rounded-full bg-warning-soft flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-warning" />
                </div>
                <CardTitle className="text-xl">Check-In Required</CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-muted-foreground">
                  You need to check in at the marketplace first before you can access the volunteer dashboard.
                </p>
                <div className="bg-card rounded-lg p-4 border border-border">
                  <p className="text-sm font-medium mb-2">How to check in:</p>
                  <ol className="text-sm text-muted-foreground text-left space-y-2">
                    <li className="flex gap-2">
                      <span className="font-semibold text-foreground">1.</span>
                      Find an employee at the marketplace entrance
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-foreground">2.</span>
                      Show them your volunteer QR card
                    </li>
                    <li className="flex gap-2">
                      <span className="font-semibold text-foreground">3.</span>
                      They will scan your card and assign you to a zone
                    </li>
                  </ol>
                </div>
                <p className="text-xs text-muted-foreground">
                  This page will automatically update once you're checked in.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    );
  }

  // Get the assigned zone info
  const assignedZone = checkInStatus.assignedZone;
  const assignedZoneInfo = zones.find(z => z.id === assignedZone);

  const renderZone = () => {
    // Only render the assigned zone
    const zoneToRender = assignedZone || activeZone;
    
    switch (zoneToRender) {
      case 'entrance':
        return <EntranceZone selectedMarketplaceId={selectedMarketplaceId} />;
      case 'marketplace':
        return <MarketplaceZone selectedMarketplaceId={selectedMarketplaceId} />;
      case 'exit':
        return <ExitZone selectedMarketplaceId={selectedMarketplaceId} />;
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
              <p className="text-xs text-muted-foreground">Volunteer Mode</p>
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
                  <p className="font-medium">Volunteer</p>
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
        
        {/* Assigned Zone & Marketplace Info */}
        <div className="px-4 pb-3 border-t border-border/50 pt-2">
          <div className="flex items-center justify-between gap-4">
            {/* Assigned Zone Badge */}
            {assignedZoneInfo && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Assigned:</span>
                <div className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10",
                  assignedZoneInfo.color
                )}>
                  <assignedZoneInfo.icon className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{assignedZoneInfo.label}</span>
                </div>
              </div>
            )}
            
            {/* Marketplace Display */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5" />
              <span>{selectedMarketplace?.name || 'Marketplace assigned'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {renderZone()}
      </main>

      {/* Bottom Navigation - Only show assigned zone as active, hide others or show as disabled */}
      <nav className="bg-card border-t border-border sticky bottom-0 z-10 safe-area-inset-bottom">
        <div className="flex">
          {zones.map((zone) => {
            const Icon = zone.icon;
            const isAssigned = zone.id === assignedZone;
            const isActive = zone.id === (assignedZone || activeZone);
            
            // Only the assigned zone is clickable
            if (!isAssigned) {
              return (
                <div
                  key={zone.id}
                  className="flex-1 py-3 flex flex-col items-center gap-1 text-muted-foreground/40 cursor-not-allowed"
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{zone.label}</span>
                </div>
              );
            }
            
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
                    layoutId="activeTab"
                    className="absolute top-0 left-2 right-2 h-0.5 bg-current rounded-full"
                  />
                )}
                <Icon className={cn('w-5 h-5', isActive && 'scale-110')} />
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
