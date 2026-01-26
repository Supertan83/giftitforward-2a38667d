
# Fix Survey Page Certificate Generation

## Problem
The Volunteer Survey Page (`/volunteer-survey?token=...`) has its own duplicate certificate generation logic that doesn't use the updated `CertificateGenerator.tsx` component. This causes:
- Incorrect name positioning (centered at x:960, y:540 instead of left-aligned at x:150, y:600)
- Wrong font size (72px instead of 48px)
- Old certificate design being downloaded and emailed after survey completion

## Solution
Refactor `VolunteerSurveyPage.tsx` to reuse the shared `CertificateGenerator.tsx` functions instead of duplicating the logic.

## Changes Required

### 1. Update VolunteerSurveyPage.tsx

**Remove duplicate code:**
- Delete the local `generateCertificatePDF` function (lines 174-202)
- Delete the local `downloadCertificate` function's PDF generation logic (lines 204-247)

**Import shared generator:**
```typescript
import { 
  generateCertificatePDF, 
  generateCertificatePDFBlob 
} from '@/components/certificates/CertificateGenerator';
```

**Update `downloadCertificate` function:**
- Parse volunteer name into firstName and lastName
- Call `generateCertificatePDFBlob({ firstName, lastName, type: 'attendance' })`
- Create download link from blob

**Update `sendCertificateEmail` function:**
- Parse volunteer name into firstName and lastName
- Call `generateCertificatePDF({ firstName, lastName, type: 'attendance' })`
- Use returned base64 for email

## Technical Details

The refactored code will:
1. Split `volunteer_name` into `firstName` and `lastName` (already done partially on lines 257-259)
2. Use consistent positioning: `x: 150`, `y: 600` for attendance certificates
3. Use consistent font: `48px helvetica bold`
4. Use consistent color: `#54585A` (DH Grey)

## Testing After Implementation

1. Navigate to `/volunteer-survey?token=YOUR_TOKEN`
2. Complete the survey
3. Verify the downloaded certificate has the name at position (150, 600)
4. Verify the emailed certificate matches the downloaded version
5. Compare with certificates generated from the Admin Dashboard preview
