import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, ShoppingBag, LogOut, User, MapPin } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { EntranceZone } from '@/components/zones/EntranceZone';
import { MarketplaceZone } from '@/components/zones/MarketplaceZone';
import { ExitZone } from '@/components/zones/ExitZone';
import { useAuth } from '@/contexts/AuthContext';
import { useMarketplaces } from '@/hooks/useSupabaseData';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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

  // Filter to show only upcoming or active marketplaces
  const availableMarketplaces = marketplaces.filter(m => m.status === 'upcoming' || m.status === 'active');
  const selectedMarketplace = availableMarketplaces.find(m => m.id === selectedMarketplaceId);

  const renderZone = () => {
    switch (activeZone) {
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
        
        {/* Global Marketplace Selector */}
        <div className="px-4 pb-3 border-t border-border/50 pt-2">
          <div className="flex items-center gap-2 mb-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Active Marketplace</span>
          </div>
          <Select
            value={selectedMarketplaceId}
            onValueChange={setSelectedMarketplaceId}
            disabled={isLoadingMarketplaces}
          >
            <SelectTrigger className="w-full h-9">
              <SelectValue placeholder="Select marketplace..." />
            </SelectTrigger>
            <SelectContent>
              {availableMarketplaces.map((marketplace) => (
                <SelectItem key={marketplace.id} value={marketplace.id}>
                  <div className="flex items-center gap-2">
                    <span>{marketplace.name}</span>
                    {marketplace.location && (
                      <span className="text-muted-foreground text-xs">
                        ({marketplace.location})
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
              {availableMarketplaces.length === 0 && (
                <SelectItem value="none" disabled>
                  No marketplaces available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {selectedMarketplace && selectedMarketplace.event_date && (
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(selectedMarketplace.event_date).toLocaleDateString()}
            </p>
          )}
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
