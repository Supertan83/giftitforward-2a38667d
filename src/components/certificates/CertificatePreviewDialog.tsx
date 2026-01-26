import { useState, useEffect } from 'react';
import { Loader2, FileText, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateCertificateImageURL, generateCertificatePDFBlob, CertificateType } from './CertificateGenerator';

interface CertificatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firstName: string;
  lastName: string;
  trainingCompleted?: boolean;
  surveyCompleted?: boolean;
}

export const CertificatePreviewDialog = ({
  open,
  onOpenChange,
  firstName,
  lastName,
  trainingCompleted = false,
  surveyCompleted = false,
}: CertificatePreviewDialogProps) => {
  const [activeTab, setActiveTab] = useState<CertificateType>('completion');
  const [completionImageUrl, setCompletionImageUrl] = useState<string | null>(null);
  const [attendanceImageUrl, setAttendanceImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && firstName && lastName) {
      generatePreviews();
    }
    
    return () => {
      // Cleanup blob URLs
      if (completionImageUrl) URL.revokeObjectURL(completionImageUrl);
      if (attendanceImageUrl) URL.revokeObjectURL(attendanceImageUrl);
    };
  }, [open, firstName, lastName]);

  const generatePreviews = async () => {
    setLoading(true);
    try {
      const [completion, attendance] = await Promise.all([
        generateCertificateImageURL({ firstName, lastName, type: 'completion' }),
        generateCertificateImageURL({ firstName, lastName, type: 'attendance' }),
      ]);
      setCompletionImageUrl(completion);
      setAttendanceImageUrl(attendance);
    } catch (error) {
      console.error('Error generating certificate previews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (type: CertificateType) => {
    try {
      const blob = await generateCertificatePDFBlob({ firstName, lastName, type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}-certificate-${firstName}-${lastName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading certificate:', error);
    }
  };

  const renderPreview = (imageUrl: string | null, type: CertificateType, description: string) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    
    if (imageUrl) {
      return (
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden bg-muted">
            <img
              src={imageUrl}
              alt={`${type} Certificate Preview`}
              className="w-full h-auto"
            />
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{description}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDownload(type)}
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex items-center justify-center h-96 bg-muted rounded-lg text-muted-foreground">
        Unable to generate preview
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Certificate Preview - {firstName} {lastName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CertificateType)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="completion" className="gap-2">
              Completion Certificate
              {trainingCompleted && (
                <span className="text-xs bg-success/20 text-success px-1.5 py-0.5 rounded">Sent</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="attendance" className="gap-2">
              Attendance Certificate
              {surveyCompleted && (
                <span className="text-xs bg-success/20 text-success px-1.5 py-0.5 rounded">Sent</span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="completion" className="mt-4">
            {renderPreview(completionImageUrl, 'completion', 'This certificate is sent after training completion.')}
          </TabsContent>

          <TabsContent value="attendance" className="mt-4">
            {renderPreview(attendanceImageUrl, 'attendance', 'This certificate is sent after survey completion.')}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
