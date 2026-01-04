import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { VolunteerInterface } from '@/components/VolunteerInterface';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { EmployeeDashboard } from '@/components/EmployeeDashboard';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, userRole, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !userRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-6">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your role...</p>
          <p className="text-xs text-muted-foreground mt-2">
            If this takes too long, contact an admin to assign your role.
          </p>
        </div>
      </div>
    );
  }

  if (userRole === 'admin') {
    return <AdminDashboard />;
  }

  if (userRole === 'employee') {
    return <EmployeeDashboard />;
  }

  return <VolunteerInterface />;
};

export default Index;
