import { useState, useEffect } from 'react';
import { Loader2, FileText, Download, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateCertificatePreviewURL, CertificateType } from './CertificateGenerator';

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
  const [completionUrl, setCompletionUrl] = useState<string | null>(null);
  const [attendanceUrl, setAttendanceUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && firstName && lastName) {
      generatePreviews();
    }
    
    return () => {
      // Cleanup blob URLs
      if (completionUrl) URL.revokeObjectURL(completionUrl);
      if (attendanceUrl) URL.revokeObjectURL(attendanceUrl);
    };
  }, [open, firstName, lastName]);

  const generatePreviews = async () => {
    setLoading(true);
    try {
      const [completion, attendance] = await Promise.all([
        generateCertificatePreviewURL({ firstName, lastName, type: 'completion' }),
        generateCertificatePreviewURL({ firstName, lastName, type: 'attendance' }),
      ]);
      setCompletionUrl(completion);
      setAttendanceUrl(attendance);
    } catch (error) {
      console.error('Error generating certificate previews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (url: string | null, type: CertificateType) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}-certificate-${firstName}-${lastName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
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
            {loading ? (
              <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : completionUrl ? (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden bg-muted">
                  <iframe
                    src={completionUrl}
                    className="w-full h-[500px]"
                    title="Completion Certificate Preview"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    This certificate is sent after training completion.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(completionUrl, 'completion')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-96 bg-muted rounded-lg text-muted-foreground">
                Unable to generate preview
              </div>
            )}
          </TabsContent>

          <TabsContent value="attendance" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center h-96 bg-muted rounded-lg">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : attendanceUrl ? (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden bg-muted">
                  <iframe
                    src={attendanceUrl}
                    className="w-full h-[500px]"
                    title="Attendance Certificate Preview"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    This certificate is sent after survey completion.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(attendanceUrl, 'attendance')}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-96 bg-muted rounded-lg text-muted-foreground">
                Unable to generate preview
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
