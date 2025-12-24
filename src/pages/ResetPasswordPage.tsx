import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const passwordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a valid session from the reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Invalid or expired reset link. Please request a new one.');
        navigate('/auth');
      }
    };
    checkSession();
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = passwordSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      const fieldErrors: { password?: string; confirmPassword?: string } = {};
      validation.error.errors.forEach(err => {
        if (err.path[0] === 'password') fieldErrors.password = err.message;
        if (err.path[0] === 'confirmPassword') fieldErrors.confirmPassword = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast.error(error.message);
      } else {
        setIsSuccess(true);
        toast.success('Password updated successfully!');
        // Sign out and redirect to login after a short delay
        setTimeout(async () => {
          await supabase.auth.signOut();
          navigate('/auth');
        }, 2000);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <main className="flex-1 flex items-center justify-center p-4 md:p-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="w-full max-w-md text-center"
          >
            <div className="bg-card rounded-xl md:rounded-2xl border border-border shadow-elevated p-6 md:p-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h1 className="font-display font-bold text-2xl mb-2">Password Updated!</h1>
              <p className="text-muted-foreground text-sm">
                Your password has been reset successfully. Redirecting to login...
              </p>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="w-full max-w-md"
        >
          <div className="text-center mb-6 md:mb-8">
            <BrandLogo size="lg" className="mx-auto mb-4" />
            <h1 className="font-display font-bold text-2xl md:text-3xl mb-2">
              Set New Password
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              Enter your new password below
            </p>
          </div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            transition={{ delay: 0.2 }} 
            className="bg-card rounded-xl md:rounded-2xl border border-border shadow-elevated p-4 md:p-6"
          >
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="pl-10" 
                    disabled={isSubmitting} 
                  />
                </div>
                {errors.password && <p className="text-destructive text-xs">{errors.password}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    className="pl-10" 
                    disabled={isSubmitting} 
                  />
                </div>
                {errors.confirmPassword && <p className="text-destructive text-xs">{errors.confirmPassword}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                Update Password
              </Button>
            </form>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default ResetPasswordPage;
