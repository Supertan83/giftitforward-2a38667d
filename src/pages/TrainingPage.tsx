import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import TrainingSlideshow from '@/components/training/TrainingSlideshow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import surplussLogo from '@/assets/surpluss-full-logo.svg';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TrainingUserInfo {
  firstName: string;
  lastName: string;
  email: string;
}

const TrainingPage = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<TrainingUserInfo | null>(null);
  const [isLoadingUserInfo, setIsLoadingUserInfo] = useState(true);
  const [hasStartedTraining, setHasStartedTraining] = useState(false);

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth', { state: { redirectTo: '/training' } });
    }
  }, [user, authLoading, navigate]);

  // Fetch user info from pending_volunteers
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!user?.email) return;
      
      try {
        // Try to get user info from pending_volunteers
        const { data: volunteer, error } = await supabase
          .from('pending_volunteers')
          .select('first_name, last_name, email')
          .eq('email', user.email)
          .maybeSingle();

        if (error) {
          console.error('Error fetching volunteer info:', error);
        }

        if (volunteer) {
          setUserInfo({
            firstName: volunteer.first_name,
            lastName: volunteer.last_name,
            email: volunteer.email,
          });
        } else {
          // Fallback: Use email parts if no volunteer record found
          const emailName = user.email.split('@')[0];
          const nameParts = emailName.split(/[._-]/);
          setUserInfo({
            firstName: nameParts[0] ? nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1) : 'Volunteer',
            lastName: nameParts[1] ? nameParts[1].charAt(0).toUpperCase() + nameParts[1].slice(1) : '',
            email: user.email,
          });
        }
      } catch (err) {
        console.error('Error in fetchUserInfo:', err);
        toast({
          title: 'Error',
          description: 'Failed to load your information. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingUserInfo(false);
      }
    };

    if (user) {
      fetchUserInfo();
    }
  }, [user, toast]);

  // Show loading while auth is being checked
  if (authLoading || isLoadingUserInfo) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-white/70">Loading...</p>
        </motion.div>
      </div>
    );
  }

  // If not logged in, don't render anything (redirect will happen)
  if (!user) {
    return null;
  }

  // If user has started training, show the slideshow
  if (hasStartedTraining && userInfo) {
    return <TrainingSlideshow userInfo={userInfo} />;
  }

  // Welcome screen before starting training
  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="bg-card/95 backdrop-blur border-border/50">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-3">
              <img src={surplussLogo} alt="Surpluss" className="h-32" />
            </div>
            <CardTitle className="font-display text-2xl">GIF Volunteer Training</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            {userInfo && (
              <div className="mb-6">
                <p className="text-lg text-foreground">
                  Welcome, <span className="font-semibold">{userInfo.firstName} {userInfo.lastName}</span>!
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Logged in as {userInfo.email}
                </p>
              </div>
            )}
            
            <p className="text-muted-foreground mb-6">
              Complete the training module and quiz to receive your Circular Economy certificate.
            </p>
            
            <button
              onClick={() => setHasStartedTraining(true)}
              className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              Start Training
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            
            <p className="text-xs text-muted-foreground mt-4">
              Your certificate will be automatically sent to {userInfo?.email} upon completion.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default TrainingPage;