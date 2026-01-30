
# Fix Certificate Name Alignment Consistency

## Problem Identified

The system generates certificates in **two different ways** with **different name positions**:

| Location | Position | Alignment | Font | Font Size |
|----------|----------|-----------|------|-----------|
| TrainingQuiz.tsx (email after training) | (960, 460) | Center | Helvetica | 72px |
| CertificateGenerator.tsx (admin preview + survey) | (170, 480) | Left | 29LT Bukra | 48px |

**Result**: When users complete training, the certificate they receive via email has the name in a different position than what admins see in the preview.

---

## Solution

Remove the duplicate certificate generation code from `TrainingQuiz.tsx` and use the centralized `CertificateGenerator.tsx` instead. This ensures all certificates (email, download, admin preview) use identical positioning.

---

## Technical Changes

### File: `src/components/training/TrainingQuiz.tsx`

**1. Add import for centralized certificate generator**
```typescript
import { generateCertificatePDF } from '@/components/certificates/CertificateGenerator';
```

**2. Remove duplicate `generateCertificatePDF` function (lines 138-166)**

Delete this entire local function that has the wrong positioning.

**3. Update `sendCertificateEmail` function (around line 211)**

Change from:
```typescript
const pdfDataUri = await generateCertificatePDF();
const base64Data = pdfDataUri.split(',')[1];
```

To:
```typescript
const base64Data = await generateCertificatePDF({ 
  firstName: userInfo.firstName?.trim() || '', 
  lastName: userInfo.lastName?.trim() || '', 
  type: 'completion' 
});
```

**4. Update `downloadCertificate` function (lines 168-209)**

Replace the inline jsPDF code with the centralized generator:
```typescript
import { generateCertificatePDFBlob } from '@/components/certificates/CertificateGenerator';

const downloadCertificate = async () => {
  setIsGenerating(true);
  try {
    const blob = await generateCertificatePDFBlob({
      firstName: userInfo.firstName?.trim() || '',
      lastName: userInfo.lastName?.trim() || '',
      type: 'completion'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `completion-certificate-${userInfo.firstName}-${userInfo.lastName}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Certificate Downloaded',
      description: 'Your certificate has been saved to your device.',
    });
  } catch (error) {
    console.error('Error generating certificate:', error);
    toast({
      title: 'Download Failed',
      description: 'Failed to generate certificate. Please try again.',
      variant: 'destructive',
    });
  } finally {
    setIsGenerating(false);
  }
};
```

**5. Remove unused jsPDF import**

Delete the direct import since we now use the centralized generator:
```typescript
// Remove this line:
import jsPDF from 'jspdf';
```

---

## Certificate Position Specifications

After this fix, ALL certificates will use these consistent settings:

| Certificate Type | X Position | Y Position | Alignment | Font | Size |
|-----------------|------------|------------|-----------|------|------|
| Completion | 170 | 480 | Left | 29LT Bukra | 48px |
| Attendance | 170 | 495 | Left | 29LT Bukra | 48px |

The name will appear directly below "THIS CERTIFIES THAT" header, left-aligned to match the background design.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/training/TrainingQuiz.tsx` | Remove duplicate certificate code, use centralized generator |

---

## Benefits

1. **Single source of truth** - All certificate generation uses one component
2. **Consistent positioning** - Email, download, and preview all match
3. **Easier maintenance** - Future position changes only need one edit
4. **Correct font** - Uses the proper 29LT Bukra brand font
5. **Proper alignment** - Left-aligned under "THIS CERTIFIES THAT" as designed

---

## Testing After Implementation

1. Complete training as a volunteer and receive email - verify name position
2. Download certificate from training completion screen - verify matches email
3. Check admin "View Certificate" preview - verify all three match
4. Compare side-by-side: email attachment vs admin preview
