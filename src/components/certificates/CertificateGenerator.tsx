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

// Helper to load custom font as base64
const loadFontAsBase64 = async (fontPath: string): Promise<string> => {
  const response = await fetch(fontPath);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(
    new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
  );
  return base64;
};

// Helper to load custom font for canvas
const loadFontForCanvas = async (): Promise<void> => {
  const font = new FontFace('29LT Bukra', 'url(/fonts/29lt-bukra.ttf)');
  await font.load();
  document.fonts.add(font);
};

// Generate certificate as an image URL for preview (avoids Chrome iframe blocking)
export const generateCertificateImageURL = async ({
  firstName,
  lastName,
  type,
}: CertificateData): Promise<string> => {
  // Load custom font for canvas
  await loadFontForCanvas();
  
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

  // Use custom 29LT Bukra font for the name
  ctx.font = 'bold 48px "29LT Bukra", Helvetica, Arial, sans-serif';
  ctx.fillStyle = '#54585A'; // DH Grey
  ctx.textAlign = 'left';
  
  if (type === 'completion') {
    // Position name below "THIS CERTIFIES THAT" header
    ctx.fillText(fullName, 170, 590);
  } else {
    // Position name below "PRESENTED TO" header (15px lower than completion)
    ctx.fillText(fullName, 170, 605);
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

  // Load and add custom font
  const fontBase64 = await loadFontAsBase64('/fonts/29lt-bukra.ttf');
  doc.addFileToVFS('29lt-bukra.ttf', fontBase64);
  doc.addFont('29lt-bukra.ttf', '29LTBukra', 'normal');

  // Load background image
  const backgroundPath = type === 'completion' 
    ? '/images/certificate-completion-background.jpg'
    : '/images/certificate-attendance-background.jpg';
  
  const img = await loadImage(backgroundPath);
  doc.addImage(img, 'JPEG', 0, 0, 1920, 1080);

  const fullName = `${firstName} ${lastName}`;

  // Use custom 29LT Bukra font for the name
  doc.setFont('29LTBukra', 'normal');
  doc.setFontSize(48);
  doc.setTextColor(84, 88, 90); // #54585A - DH Grey
  
  if (type === 'completion') {
    // Position name below "THIS CERTIFIES THAT" header
    doc.text(fullName, 170, 590);
  } else {
    // Position name below "PRESENTED TO" header (15px lower than completion)
    doc.text(fullName, 170, 605);
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

  // Load and add custom font
  const fontBase64 = await loadFontAsBase64('/fonts/29lt-bukra.ttf');
  doc.addFileToVFS('29lt-bukra.ttf', fontBase64);
  doc.addFont('29lt-bukra.ttf', '29LTBukra', 'normal');

  // Load background image
  const backgroundPath = type === 'completion' 
    ? '/images/certificate-completion-background.jpg'
    : '/images/certificate-attendance-background.jpg';
  
  const img = await loadImage(backgroundPath);
  doc.addImage(img, 'JPEG', 0, 0, 1920, 1080);

  const fullName = `${firstName} ${lastName}`;

  // Use custom 29LT Bukra font for the name
  doc.setFont('29LTBukra', 'normal');
  doc.setFontSize(48);
  doc.setTextColor(84, 88, 90); // #54585A - DH Grey
  
  if (type === 'completion') {
    // Position name below "THIS CERTIFIES THAT" header
    doc.text(fullName, 170, 590);
  } else {
    // Position name below "PRESENTED TO" header (15px lower than completion)
    doc.text(fullName, 170, 605);
  }

  // Return base64 string (without data:application/pdf;base64, prefix)
  return doc.output('datauristring').split(',')[1];
};
