import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Search, ClipboardList, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface SurveyReview {
  name: string;
  completedAt: string;
  source: 'internal' | 'external';
  answers: Record<string, string>;
}

export const ReviewSurveyZone = () => {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['survey-reviews', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/get-survey-reviews?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      if (!res.ok) throw new Error('Failed to fetch surveys');
      return res.json() as Promise<{ surveys: SurveyReview[]; questionMap: Record<string, string> }>;
    },
    staleTime: 30_000,
  });

  const surveys = data?.surveys || [];
  const questionMap = data?.questionMap || {};

  const renderAnswerLabel = (key: string) => {
    return questionMap[key] || key;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Survey Reviews</h2>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : surveys.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No completed surveys found</p>
        </div>
      ) : (
        <Accordion type="single" collapsible className="space-y-2">
          {surveys.map((survey, idx) => (
            <AccordionItem key={idx} value={`survey-${idx}`} className="border rounded-lg px-1">
              <AccordionTrigger className="hover:no-underline py-3 px-2">
                <div className="flex flex-col items-start gap-1 text-left">
                  <span className="font-medium text-sm">{survey.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(survey.completedAt), 'MMM d, yyyy')}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {survey.source === 'internal' ? 'Volunteer' : 'External'}
                    </Badge>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-2 pb-3">
                <div className="space-y-3">
                  {Object.entries(survey.answers).map(([key, value]) => (
                    <div key={key} className="space-y-0.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        {renderAnswerLabel(key)}
                      </p>
                      <p className="text-sm">{String(value)}</p>
                    </div>
                  ))}
                  {Object.keys(survey.answers).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No answers recorded</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
};
