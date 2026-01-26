import { jsPDF } from 'jspdf';

export type CertificateType = 'completion' | 'attendance';

interface CertificateData {
  firstName: string;
  lastName: string;
  type: CertificateType;
}

// Generate certificate PDF and return as base64
export const generateCertificatePDF = async ({
  firstName,
  lastName,
  type,
}: CertificateData): Promise<string> => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [1920, 1080],
  });

  // Load background image
  const backgroundPath = type === 'completion' 
    ? '/images/certificate-completion-background.jpg'
    : '/images/certificate-attendance-background.jpg';
  
  const img = new Image();
  img.crossOrigin = 'anonymous';
  
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = backgroundPath;
  });

  // Add background image
  doc.addImage(img, 'JPEG', 0, 0, 1920, 1080);

  // Set font for name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(72);
  doc.setTextColor(84, 88, 90); // #54585A - DH Grey

  const fullName = `${firstName} ${lastName}`;

  if (type === 'completion') {
    // For completion certificate - place name where "(First Name) (Last Name)" placeholder is
    // Centered horizontally, positioned at approximately 42% from top
    doc.text(fullName, 960, 460, { align: 'center' });
  } else {
    // For attendance certificate - place name under "PRESENTED TO"
    // Centered horizontally, positioned at approximately 50% from top
    doc.text(fullName, 960, 540, { align: 'center' });
  }

  // Return base64 string (without data:application/pdf;base64, prefix)
  return doc.output('datauristring').split(',')[1];
};

// Generate certificate PDF for preview (returns blob URL)
export const generateCertificatePreviewURL = async ({
  firstName,
  lastName,
  type,
}: CertificateData): Promise<string> => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [1920, 1080],
  });

  // Load background image
  const backgroundPath = type === 'completion' 
    ? '/images/certificate-completion-background.jpg'
    : '/images/certificate-attendance-background.jpg';
  
  const img = new Image();
  img.crossOrigin = 'anonymous';
  
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = backgroundPath;
  });

  // Add background image
  doc.addImage(img, 'JPEG', 0, 0, 1920, 1080);

  // Set font for name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(72);
  doc.setTextColor(84, 88, 90); // #54585A - DH Grey

  const fullName = `${firstName} ${lastName}`;

  if (type === 'completion') {
    // For completion certificate - place name where "(First Name) (Last Name)" placeholder is
    doc.text(fullName, 960, 460, { align: 'center' });
  } else {
    // For attendance certificate - place name under "PRESENTED TO"
    doc.text(fullName, 960, 540, { align: 'center' });
  }

  // Return blob URL for preview
  const blob = doc.output('blob');
  return URL.createObjectURL(blob);
};
