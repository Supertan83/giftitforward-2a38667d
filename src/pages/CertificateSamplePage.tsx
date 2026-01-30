import { CertificateSampleDownloader } from '@/components/certificates/CertificateSampleGenerator';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CertificateSamplePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Certificate Size Test</h1>
          <p className="text-muted-foreground">
            Download sample certificates with the new A4 landscape dimensions (841.89 x 595.276 px) 
            to verify the sizing, fonts, and logo proportions before applying to the system.
          </p>
        </div>

        <CertificateSampleDownloader />

        <div className="p-4 bg-muted rounded-lg text-sm space-y-2">
          <p><strong>Current dimensions:</strong> 1920 x 1080 px</p>
          <p><strong>New dimensions:</strong> 841.89 x 595.276 px (A4 landscape)</p>
          <p><strong>Scale factor:</strong> ~44% width, ~55% height</p>
          <p><strong>Font size:</strong> Scaled from 48px to ~26px</p>
        </div>
      </div>
    </div>
  );
};

export default CertificateSamplePage;
