import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import gifLogo from '@/assets/gift-it-forward-logo.png';

const ORGANIZATIONS = [
  'Nabdh El Emarat',
  'ACKAF',
  'Volunteers.ae',
  'CDA',
  'Venue Volunteers',
  'Other',
];

interface MarketplaceOption {
  id: string;
  name: string;
}

export default function OnsiteRegistrationPage() {
  const { toast } = useToast();
  const [marketplaces, setMarketplaces] = useState<MarketplaceOption[]>([]);
  const [loadingMarketplaces, setLoadingMarketplaces] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [marketplaceId, setMarketplaceId] = useState('');
  const [gender, setGender] = useState('');
  const [organization, setOrganization] = useState('');
  const [otherOrg, setOtherOrg] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ qr_code_id: string; volunteer_name: string } | null>(null);

  useEffect(() => {
    const fetchMarketplaces = async () => {
      const { data } = await supabase
        .from('marketplace_events')
        .select('id, name')
        .order('event_date', { ascending: false });
      setMarketplaces(data || []);
      setLoadingMarketplaces(false);
    };
    fetchMarketplaces();
  }, []);

  const handleSubmit = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: 'Name required', description: 'Please enter your first and last name.', variant: 'destructive' });
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ title: 'Valid email required', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }
    if (!marketplaceId) {
      toast({ title: 'Marketplace required', description: 'Please select a marketplace event.', variant: 'destructive' });
      return;
    }

    const companyName = organization === 'Other' ? otherOrg.trim() : organization;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('register-onsite-volunteer', {
        body: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          marketplace_id: marketplaceId,
          gender: gender || null,
          company_name: companyName || null,
        },
      });

      if (error) throw error;
      if (data && !data.success) {
        toast({ title: 'Registration failed', description: data.error, variant: 'destructive' });
        return;
      }

      setSuccess({ qr_code_id: data.qr_code_id, volunteer_name: data.volunteer_name });
    } catch (err: any) {
      const msg = err?.message || 'Something went wrong. Please try again.';
      toast({ title: 'Registration failed', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(success.qr_code_id)}`;
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center bg-success/20">
            <CheckCircle2 className="w-12 h-12 text-success" />
          </div>
          <h2 className="font-display font-bold text-2xl text-white mb-2">Registration Complete!</h2>
          <p className="text-white/70 mb-6">Welcome, {success.volunteer_name}! Your QR code has been emailed to you.</p>

          <div className="bg-white rounded-xl p-6 mb-6 inline-block">
            <img src={qrImageUrl} alt="Your Volunteer QR Code" width={200} height={200} />
            <p className="text-xs text-gray-500 mt-2">{success.qr_code_id}</p>
          </div>

          <p className="text-white/50 text-sm">Please save a screenshot of your QR code. Show it to the team on-site to check in.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <header className="bg-white border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center">
          <img src={gifLogo} alt="Gift It Forward" className="h-10 object-contain" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="text-center">
            <h1 className="font-display font-bold text-2xl text-white mb-2">Volunteer Registration</h1>
            <p className="text-white/70">Register as an on-site volunteer to receive your QR code.</p>
          </div>

          <div className="bg-white/5 rounded-xl p-6 border border-white/10 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-white mb-1 block">First Name *</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" className="bg-white/5 border-white/20 text-white placeholder:text-white/40" maxLength={100} />
              </div>
              <div>
                <Label className="text-white mb-1 block">Last Name *</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" className="bg-white/5 border-white/20 text-white placeholder:text-white/40" maxLength={100} />
              </div>
            </div>

            <div>
              <Label className="text-white mb-1 block">Email *</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="bg-white/5 border-white/20 text-white placeholder:text-white/40" maxLength={255} />
            </div>

            <div>
              <Label className="text-white mb-1 block">Marketplace Event *</Label>
              {loadingMarketplaces ? (
                <div className="flex items-center gap-2 text-white/50 py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading events...</div>
              ) : (
                <Select value={marketplaceId} onValueChange={setMarketplaceId}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white"><SelectValue placeholder="Select marketplace" /></SelectTrigger>
                  <SelectContent>
                    {marketplaces.map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label className="text-white mb-1 block">Gender</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white"><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-white mb-1 block">Organization / Company Name</Label>
              <Select value={organization} onValueChange={setOrganization}>
                <SelectTrigger className="bg-white/5 border-white/20 text-white"><SelectValue placeholder="Select organization" /></SelectTrigger>
                <SelectContent>
                  {ORGANIZATIONS.map(org => (
                    <SelectItem key={org} value={org}>{org}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {organization === 'Other' && (
                <Input value={otherOrg} onChange={e => setOtherOrg(e.target.value)} placeholder="Enter organization name" className="mt-2 bg-white/5 border-white/20 text-white placeholder:text-white/40" maxLength={200} />
              )}
            </div>
          </div>

          <Button size="lg" onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Register
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
