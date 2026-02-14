import { useState } from 'react';
import { ArrowLeft, Copy, Check, Link2, ExternalLink, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMarketplaces } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

interface ExternalSurveyLinksManagerProps {
  onBack: () => void;
}

export const ExternalSurveyLinksManager = ({ onBack }: ExternalSurveyLinksManagerProps) => {
  const { data: marketplaces = [] } = useMarketplaces();
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Fetch response counts per marketplace
  const { data: responseCounts = {} } = useQuery({
    queryKey: ['external-survey-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('external_survey_responses' as any)
        .select('marketplace_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data as any[])?.forEach((r: any) => {
        counts[r.marketplace_id] = (counts[r.marketplace_id] || 0) + 1;
      });
      return counts;
    },
  });

  const surveyUrl = selectedMarketplace
    ? `${window.location.origin}/external-survey?marketplace=${selectedMarketplace}`
    : '';

  const handleCopy = async () => {
    if (!surveyUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(surveyUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = surveyUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast({ title: 'Link Copied!', description: 'Share this with the external company for their SMS blast.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy Failed', variant: 'destructive' });
    }
  };

  return (
    <div className="py-4 md:py-6 px-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-display font-bold">External Survey Links</h2>
          <p className="text-sm text-muted-foreground">Generate shareable survey links for external company volunteers</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Select Marketplace</label>
          <Select value={selectedMarketplace} onValueChange={setSelectedMarketplace}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choose a marketplace..." />
            </SelectTrigger>
            <SelectContent>
              {marketplaces.map((mp) => (
                <SelectItem key={mp.id} value={mp.id}>
                  <div className="flex items-center gap-2">
                    <span>{mp.name}</span>
                    {(responseCounts as Record<string, number>)[mp.id] && (
                      <Badge variant="secondary" className="text-xs">
                        {(responseCounts as Record<string, number>)[mp.id]} responses
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {surveyUrl && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Survey Link</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-lg px-4 py-3 text-sm font-mono break-all border border-border">
                  {surveyUrl}
                </div>
                <Button size="icon" variant="outline" onClick={handleCopy} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Link2 className="h-4 w-4 mr-2" />
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={surveyUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Preview
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* Response counts summary */}
        {Object.keys(responseCounts).length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Responses Received
            </h3>
            <div className="space-y-2">
              {marketplaces
                .filter((mp) => (responseCounts as Record<string, number>)[mp.id])
                .map((mp) => (
                  <div key={mp.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm">{mp.name}</span>
                    <Badge variant="secondary">{(responseCounts as Record<string, number>)[mp.id]} responses</Badge>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
