import { useState } from 'react';
import { motion } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import TrainingSlideshow from '@/components/training/TrainingSlideshow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ArrowRight } from 'lucide-react';
import surplussLogo from '@/assets/surpluss-full-logo.svg';

export interface TrainingUserInfo {
  firstName: string;
  lastName: string;
  email: string;
}

const registrationSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(50, 'First name must be less than 50 characters'),
  lastName: z.string().trim().min(1, 'Last name is required').max(50, 'Last name must be less than 50 characters'),
  email: z.string().trim().email('Please enter a valid email address').max(100, 'Email must be less than 100 characters'),
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

const TrainingPage = () => {
  const [userInfo, setUserInfo] = useState<TrainingUserInfo | null>(null);

  const form = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
    },
  });

  const onSubmit = (data: RegistrationFormData) => {
    setUserInfo({
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim().toLowerCase(),
    });
  };

  // If user has registered, show the training
  if (userInfo) {
    return <TrainingSlideshow userInfo={userInfo} />;
  }

  // Registration form
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
            <div className="flex justify-center mb-6">
              <img src={surplussLogo} alt="Surpluss" className="h-16" />
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john.doe@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" size="lg">
                  Start Training
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            </Form>
            <p className="text-xs text-muted-foreground text-center mt-4">
              Your certificate will be sent to this email upon completion.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default TrainingPage;
