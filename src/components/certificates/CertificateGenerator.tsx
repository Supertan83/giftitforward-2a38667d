import { jsPDF } from 'jspdf';

export type CertificateType = 'completion' | 'attendance';

interface CertificateData {
  firstName: string;
  lastName: string;
  type: CertificateType;
}

// Helper to load image and add to canvas
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

// Generate certificate as an image URL for preview (avoids Chrome iframe blocking)
export const generateCertificateImageURL = async ({
  firstName,
  lastName,
  type,
}: CertificateData): Promise<string> => {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Could not get canvas context');

  // Load background image
  const backgroundPath = type === 'completion' 
    ? '/images/certificate-completion-background.jpg'
    : '/images/certificate-attendance-background.jpg';
  
  const img = await loadImage(backgroundPath);
  ctx.drawImage(img, 0, 0, 1920, 1080);

  const fullName = `${firstName} ${lastName}`;

  if (type === 'completion') {
    // Write volunteer name below "THIS CERTIFIES THAT" - positioned in blank area before description
    ctx.font = 'bold 48px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#54585A'; // DH Grey
    ctx.textAlign = 'left';
    ctx.fillText(fullName, 110, 580);
  } else {
    // For attendance certificate - place name under "PRESENTED TO"
    ctx.font = 'bold 48px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#54585A'; // DH Grey
    ctx.textAlign = 'left';
    ctx.fillText(fullName, 110, 600);
  }

  // Return as blob URL
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(URL.createObjectURL(blob));
      } else {
        reject(new Error('Failed to create blob'));
      }
    }, 'image/png');
  });
};

// Generate certificate PDF blob for download
export const generateCertificatePDFBlob = async ({
  firstName,
  lastName,
  type,
}: CertificateData): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [1920, 1080],
  });

  // Load background image
  const backgroundPath = type === 'completion' 
    ? '/images/certificate-completion-background.jpg'
    : '/images/certificate-attendance-background.jpg';
  
  const img = await loadImage(backgroundPath);
  doc.addImage(img, 'JPEG', 0, 0, 1920, 1080);

  const fullName = `${firstName} ${lastName}`;

  if (type === 'completion') {
    // Write volunteer name below "THIS CERTIFIES THAT" - positioned in blank area before description
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(48);
    doc.setTextColor(84, 88, 90); // #54585A - DH Grey
    doc.text(fullName, 110, 580);
  } else {
    // For attendance certificate - place name under "PRESENTED TO"
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(48);
    doc.setTextColor(84, 88, 90); // #54585A - DH Grey
    doc.text(fullName, 110, 600);
  }

  return doc.output('blob');
};

// Generate certificate PDF and return as base64 (for email sending)
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
  
  const img = await loadImage(backgroundPath);
  doc.addImage(img, 'JPEG', 0, 0, 1920, 1080);

  const fullName = `${firstName} ${lastName}`;

  if (type === 'completion') {
    // Write volunteer name below "THIS CERTIFIES THAT" - positioned in blank area before description
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(48);
    doc.setTextColor(84, 88, 90); // #54585A - DH Grey
    doc.text(fullName, 110, 580);
  } else {
    // For attendance certificate - place name under "PRESENTED TO"
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(48);
    doc.setTextColor(84, 88, 90); // #54585A - DH Grey
    doc.text(fullName, 110, 600);
  }

  // Return base64 string (without data:application/pdf;base64, prefix)
  return doc.output('datauristring').split(',')[1];
};
