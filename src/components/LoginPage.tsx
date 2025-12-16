import { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, UserCog, Users, ArrowRight, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/useAppStore';
import { cn } from '@/lib/utils';

type RoleSelection = 'admin' | 'volunteer' | null;

export const LoginPage = () => {
  const [selectedRole, setSelectedRole] = useState<RoleSelection>(null);
  const { login } = useAppStore();

  const handleLogin = () => {
    if (selectedRole) {
      login(selectedRole);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero Section */}
      <div className="gradient-hero pt-12 pb-20 px-6 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary-foreground/5 rounded-full" />
        <div className="absolute -bottom-32 -left-16 w-80 h-80 bg-primary-foreground/5 rounded-full" />
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
            className="w-20 h-20 bg-primary-foreground/20 rounded-2xl flex items-center justify-center mx-auto mb-6"
          >
            <Heart className="w-10 h-10 text-primary-foreground" fill="currentColor" />
          </motion.div>
          
          <h1 className="text-3xl font-display font-bold text-primary-foreground mb-2">
            Charity Marketplace
          </h1>
          <p className="text-primary-foreground/80">
            Distribution System
          </p>
        </motion.div>
      </div>

      {/* Login Card */}
      <div className="flex-1 -mt-10 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-2xl border border-border shadow-elevated p-6 max-w-md mx-auto"
        >
          <h2 className="font-display font-semibold text-xl text-center mb-2">
            Welcome Back
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Select your role to continue
          </p>

          {/* Role Selection */}
          <div className="space-y-3 mb-6">
            <RoleCard
              role="admin"
              title="Admin"
              description="Manage inventory and allocate items to events"
              icon={UserCog}
              isSelected={selectedRole === 'admin'}
              onClick={() => setSelectedRole('admin')}
            />
            <RoleCard
              role="volunteer"
              title="Volunteer"
              description="Distribute items to beneficiaries at the marketplace"
              icon={Users}
              isSelected={selectedRole === 'volunteer'}
              onClick={() => setSelectedRole('volunteer')}
            />
          </div>

          {/* Login Button */}
          <Button
            onClick={handleLogin}
            disabled={!selectedRole}
            variant="hero"
            size="xl"
            className="w-full"
          >
            Continue as {selectedRole === 'admin' ? 'Admin' : selectedRole === 'volunteer' ? 'Volunteer' : '...'}
            <ArrowRight className="w-5 h-5" />
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Demo mode: No authentication required
          </p>
        </motion.div>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            Powered by <span className="font-semibold text-primary">Charity Aid</span>
          </p>
        </div>
      </div>
    </div>
  );
};

interface RoleCardProps {
  role: string;
  title: string;
  description: string;
  icon: React.ElementType;
  isSelected: boolean;
  onClick: () => void;
}

const RoleCard = ({ title, description, icon: Icon, isSelected, onClick }: RoleCardProps) => {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'w-full p-4 rounded-xl border-2 text-left transition-all duration-200',
        isSelected
          ? 'border-primary bg-primary-soft shadow-soft'
          : 'border-border bg-background hover:border-primary/50'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center',
          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        )}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-display font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className={cn(
          'w-6 h-6 rounded-full border-2 flex items-center justify-center mt-1',
          isSelected ? 'border-primary bg-primary' : 'border-border'
        )}>
          {isSelected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-2.5 h-2.5 bg-primary-foreground rounded-full"
            />
          )}
        </div>
      </div>
    </motion.button>
  );
};
