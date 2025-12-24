import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const emailSchema = z.object({
  email: z.string().email('Please enter a valid email')
});

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const {
    signIn,
    signUp,
    user,
    userRole,
    isLoading
  } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && userRole) {
      navigate('/');
    }
  }, [user, userRole, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = authSchema.safeParse({
      email,
      password
    });
    if (!validation.success) {
      const fieldErrors: {
        email?: string;
        password?: string;
      } = {};
      validation.error.errors.forEach(err => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setIsSubmitting(true);
    try {
      if (isLogin) {
        const {
          error
        } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast.error('Invalid email or password');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Welcome back!');
        }
      } else {
        const {
          error
        } = await signUp(email, password);
        if (error) {
          if (error.message.includes('already registered')) {
            toast.error('This email is already registered. Please sign in.');
          } else {
            toast.error(error.message);
          }
        } else {
          toast.success('Account created! Please contact an admin to assign your role.');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const validation = emailSchema.safeParse({ email });
    if (!validation.success) {
      setErrors({ email: validation.error.errors[0].message });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Password reset email sent! Check your inbox.');
        setIsForgotPassword(false);
        setEmail('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }

  return <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <motion.div initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} className="w-full max-w-md">
          {/* Hero */}
          <div className="text-center mb-6 md:mb-8">
            <BrandLogo size="lg" className="mx-auto mb-4" />
            <h1 className="font-display font-bold text-2xl md:text-3xl mb-2">
              {isForgotPassword ? 'Reset Password' : isLogin ? 'Welcome To GIF' : 'Join Our Team'}
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              {isForgotPassword 
                ? 'Enter your email to receive a password reset link' 
                : isLogin 
                  ? 'Sign in to continue to the distribution system' 
                  : 'Create an account to get started'}
            </p>
          </div>

          {/* Form Card */}
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          delay: 0.2
        }} className="bg-card rounded-xl md:rounded-2xl border border-border shadow-elevated p-4 md:p-6">
            {isForgotPassword ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      type="email" 
                      placeholder="you@example.com" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      className="pl-10" 
                      disabled={isSubmitting} 
                    />
                  </div>
                  {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                  Send Reset Link
                </Button>

                <div className="text-center">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsForgotPassword(false);
                      setErrors({});
                    }} 
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                    disabled={isSubmitting}
                  >
                    <ArrowLeft className="w-3 h-3" />
                    Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="pl-10" disabled={isSubmitting} />
                    </div>
                    {errors.email && <p className="text-destructive text-xs">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-foreground">Password</label>
                      {isLogin && (
                        <button 
                          type="button" 
                          onClick={() => {
                            setIsForgotPassword(true);
                            setErrors({});
                            setPassword('');
                          }} 
                          className="text-xs text-primary hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-10" disabled={isSubmitting} />
                    </div>
                    {errors.password && <p className="text-destructive text-xs">{errors.password}</p>}
                  </div>

                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowRight className="w-4 h-4 mr-2" />}
                    {isLogin ? 'Sign In' : 'Create Account'}
                  </Button>
                </form>

                {/* Signup toggle hidden - uncomment to re-enable */}
                {/* <div className="mt-4 pt-4 border-t border-border text-center">
                  <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-sm text-primary hover:underline" disabled={isSubmitting}>
                    {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                  </button>
                </div> */}
              </>
            )}
          </motion.div>

          {!isForgotPassword && (
            <p className="text-center text-xs text-muted-foreground mt-4">
              Contact your administrator after signing up to get your role assigned.
            </p>
          )}
        </motion.div>
      </main>
    </div>;
};
export default AuthPage;