import { jsPDF } from 'jspdf';

// Sample certificate generator with A4 landscape dimensions
// Width: 841.89 px, Height: 595.276 px

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

const loadFontAsBase64 = async (fontPath: string): Promise<string> => {
  const response = await fetch(fontPath);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  return base64;
};

// New dimensions (A4 landscape)
const NEW_WIDTH = 841.89;
const NEW_HEIGHT = 595.276;

// Scale factors from original 1920x1080
const SCALE_X = NEW_WIDTH / 1920;
const SCALE_Y = NEW_HEIGHT / 1080;

export const generateSampleCertificatePDF = async (
  firstName: string,
  lastName: string,
  type: 'completion' | 'attendance'
): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [NEW_WIDTH, NEW_HEIGHT],
  });

  // Load and add custom font
  const fontBase64 = await loadFontAsBase64('/fonts/29lt-bukra.ttf');
  doc.addFileToVFS('29lt-bukra.ttf', fontBase64);
  doc.addFont('29lt-bukra.ttf', '29LTBukra', 'normal');

  // Load background image
  const backgroundPath = type === 'completion' 
    ? '/images/certificate-completion-background.jpg'
    : '/images/certificate-attendance-background.jpg';
  
  const img = await loadImage(backgroundPath);
  doc.addImage(img, 'JPEG', 0, 0, NEW_WIDTH, NEW_HEIGHT);

  const fullName = `${firstName} ${lastName}`;

  // Use custom 29LT Bukra font for the name
  doc.setFont('29LTBukra', 'normal');
  
  // Scale font size proportionally (original was 48px)
  const scaledFontSize = Math.round(48 * SCALE_Y);
  doc.setFontSize(scaledFontSize);
  doc.setTextColor(84, 88, 90); // #54585A - DH Grey
  
  // Scale positions proportionally
  const scaledX = Math.round(170 * SCALE_X);
  
  if (type === 'completion') {
    // Original: 170, 590
    const scaledY = Math.round(590 * SCALE_Y);
    doc.text(fullName, scaledX, scaledY);
  } else {
    // Original: 170, 605
    const scaledY = Math.round(605 * SCALE_Y);
    doc.text(fullName, scaledX, scaledY);
  }

  return doc.output('blob');
};

// Component for testing
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

export const CertificateSampleDownloader = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<string | null>(null);

  const downloadSample = async (type: 'completion' | 'attendance') => {
    setIsGenerating(true);
    setGeneratingType(type);
    try {
      const blob = await generateSampleCertificatePDF('John', 'Doe', type);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sample-${type}-certificate-841x595.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating sample:', error);
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
    }
  };

  return (
    <div className="p-6 border rounded-lg bg-card space-y-4">
      <h3 className="font-semibold text-lg">Sample Certificate Downloads (841.89 x 595.276 px)</h3>
      <p className="text-sm text-muted-foreground">
        Download sample certificates with the new A4 landscape dimensions to verify sizing.
      </p>
      <div className="flex gap-3">
        <Button 
          onClick={() => downloadSample('completion')}
          disabled={isGenerating}
        >
          {isGenerating && generatingType === 'completion' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Download Completion Sample
        </Button>
        <Button 
          onClick={() => downloadSample('attendance')}
          disabled={isGenerating}
          variant="outline"
        >
          {isGenerating && generatingType === 'attendance' ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Download Attendance Sample
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Sample name: "John Doe" | Font scaled proportionally from 48px to ~26px
      </p>
    </div>
  );
};
