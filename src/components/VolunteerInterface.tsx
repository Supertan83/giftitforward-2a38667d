import { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, ShoppingBag, LogOut, User } from 'lucide-react';
import SurplussLogo from '@/assets/surpluss-logogram.svg';
import { EntranceZone } from '@/components/zones/EntranceZone';
import { MarketplaceZone } from '@/components/zones/MarketplaceZone';
import { ExitZone } from '@/components/zones/ExitZone';
import { useAuth } from '@/contexts/AuthContext';
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

type Zone = 'entrance' | 'marketplace' | 'exit';

const zones = [
  { id: 'entrance' as Zone, label: 'Entrance', icon: LogIn, color: 'text-primary' },
  { id: 'marketplace' as Zone, label: 'Marketplace', icon: ShoppingBag, color: 'text-warning' },
  { id: 'exit' as Zone, label: 'Exit', icon: LogOut, color: 'text-danger' },
];

export const VolunteerInterface = () => {
  const [activeZone, setActiveZone] = useState<Zone>('entrance');
  const { user, signOut } = useAuth();

  const renderZone = () => {
    switch (activeZone) {
      case 'entrance':
        return <EntranceZone />;
      case 'marketplace':
        return <MarketplaceZone />;
      case 'exit':
        return <ExitZone />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-10 flex items-center justify-center rounded-lg bg-brand-teal">
              <img src={SurplussLogo} alt="Surpluss" className="w-auto h-[80%]" />
            </div>
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
