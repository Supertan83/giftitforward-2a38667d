import { useAppStore } from '@/store/useAppStore';
import { LoginPage } from '@/components/LoginPage';
import { VolunteerInterface } from '@/components/VolunteerInterface';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

const Index = () => {
  const { isAuthenticated, currentUser } = useAppStore();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (currentUser?.role === 'admin') {
    return <AdminDashboard />;
  }

  return <VolunteerInterface />;
};

export default Index;
