import { useState } from 'react';
import { ArrowLeft, Copy, Check, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ExternalSurveyLinksManagerProps {
  onBack: () => void;
}

const SURVEY_URL = 'https://gif.thesurpluss.com/survey';

export const ExternalSurveyLinksManager = ({ onBack }: ExternalSurveyLinksManagerProps) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(SURVEY_URL);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = SURVEY_URL;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast({ title: 'Link Copied!', description: 'Share this with external companies for their SMS blast.' });
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
          <h2 className="text-xl font-display font-bold">External Survey Link</h2>
          <p className="text-sm text-muted-foreground">Share this link with external company volunteers via SMS blast</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Survey Link</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-lg px-4 py-3 text-sm font-mono break-all border border-border">
              {SURVEY_URL}
            </div>
            <Button size="icon" variant="outline" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Link2 className="h-4 w-4 mr-2" />
          {copied ? 'Copied!' : 'Copy Link'}
        </Button>
      </div>
    </div>
  );
};
