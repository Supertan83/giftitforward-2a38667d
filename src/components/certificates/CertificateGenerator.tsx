import { jsPDF } from 'jspdf';

export type CertificateType = 'completion' | 'attendance';

interface CertificateData {
  firstName: string;
  lastName: string;
  type: CertificateType;
}

// New A4 landscape dimensions
const PDF_WIDTH = 841.89;
const PDF_HEIGHT = 595.276;

// Scale factors from original 1920x1080
const SCALE_X = PDF_WIDTH / 1920;
const SCALE_Y = PDF_HEIGHT / 1080;

// Scaled positions
const NAME_X = Math.round(170 * SCALE_X);
const NAME_Y_COMPLETION = Math.round(590 * SCALE_Y);
const NAME_Y_ATTENDANCE = Math.round(605 * SCALE_Y);
const FONT_SIZE = Math.round(48 * SCALE_Y);

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
  
  // Use new dimensions for canvas
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(PDF_WIDTH);
  canvas.height = Math.round(PDF_HEIGHT);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Could not get canvas context');

  // Load background image
  const backgroundPath = type === 'completion' 
    ? '/images/certificate-completion-background.jpg'
    : '/images/certificate-attendance-background.jpg';
  
  const img = await loadImage(backgroundPath);
  ctx.drawImage(img, 0, 0, PDF_WIDTH, PDF_HEIGHT);

  const fullName = `${firstName} ${lastName}`;

  // Use custom 29LT Bukra font for the name with scaled size
  ctx.font = `bold ${FONT_SIZE}px "29LT Bukra", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = '#54585A'; // DH Grey
  ctx.textAlign = 'left';
  
  if (type === 'completion') {
    ctx.fillText(fullName, NAME_X, NAME_Y_COMPLETION);
  } else {
    ctx.fillText(fullName, NAME_X, NAME_Y_ATTENDANCE);
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
    format: [PDF_WIDTH, PDF_HEIGHT],
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
  doc.addImage(img, 'JPEG', 0, 0, PDF_WIDTH, PDF_HEIGHT);

  const fullName = `${firstName} ${lastName}`;

  // Use custom 29LT Bukra font for the name
  doc.setFont('29LTBukra', 'normal');
  doc.setFontSize(FONT_SIZE);
  doc.setTextColor(84, 88, 90); // #54585A - DH Grey
  
  if (type === 'completion') {
    doc.text(fullName, NAME_X, NAME_Y_COMPLETION);
  } else {
    doc.text(fullName, NAME_X, NAME_Y_ATTENDANCE);
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
    format: [PDF_WIDTH, PDF_HEIGHT],
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
  doc.addImage(img, 'JPEG', 0, 0, PDF_WIDTH, PDF_HEIGHT);

  const fullName = `${firstName} ${lastName}`;

  // Use custom 29LT Bukra font for the name
  doc.setFont('29LTBukra', 'normal');
  doc.setFontSize(FONT_SIZE);
  doc.setTextColor(84, 88, 90); // #54585A - DH Grey
  
  if (type === 'completion') {
    doc.text(fullName, NAME_X, NAME_Y_COMPLETION);
  } else {
    doc.text(fullName, NAME_X, NAME_Y_ATTENDANCE);
  }

  // Return base64 string (without data:application/pdf;base64, prefix)
  return doc.output('datauristring').split(',')[1];
};
