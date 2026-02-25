

## Fix: Valid QR Cards Intermittently Return "Card Not Found"

### Problem
System-generated and registered QR cards intermittently fail lookup with "QR Card Not Found". Since these cards definitely exist in the database, the issue is invisible characters (newlines, carriage returns, control chars) appended by the camera-based QR scanner during decode. The backend RPCs already use SQL `TRIM()`, but direct Supabase client queries in `useSupabaseData.ts` do not sanitize the input.

### Root Cause
- The `html5-qrcode` library occasionally appends `\n`, `\r`, or other control characters depending on scan angle/lighting
- All 13 `.ilike('unique_id', uniqueId)` queries in `useSupabaseData.ts` pass the raw scanned value without sanitization
- Manual entry in `QRScanner.tsx` only does `.trim()` (strips whitespace but not control characters)
- This makes the bug intermittent: some scans decode cleanly, others don't

### Fix (2 files, defense-in-depth)

**File 1: `src/components/QRScanner.tsx`** -- Sanitize at source
- Add a `sanitizeQRCode` helper that strips whitespace AND control characters
- Apply it to camera scan output (line 100: `onScan(decodedText)`)
- Apply it to manual entry (line 185: `onScan(manualCode.trim())`)

**File 2: `src/hooks/useSupabaseData.ts`** -- Sanitize before every query
- Add the same sanitization at the top of every mutation that receives a `uniqueId` or `cardUniqueId`
- Covers all 13 `.ilike('unique_id', ...)` call sites as a safety net

### Sanitization Logic
```text
const sanitize = (id: string) => id.trim().replace(/[\r\n\x00-\x1F\x7F]/g, '');
```
This strips: leading/trailing whitespace, carriage returns, newlines, null bytes, and all ASCII control characters (0x00-0x1F, 0x7F).

### Defense-in-Depth Layers
```text
Layer 1: QRScanner.tsx        -- clean at scan source (camera + manual)
Layer 2: useSupabaseData.ts   -- clean before every DB query (13 locations)
Layer 3: SQL RPCs             -- TRIM() already in place (distribute/return RPCs)
```

### Affected Mutations (all in useSupabaseData.ts)
1. `findCardByUniqueId` (line 176)
2. `activateCard` (line 210)
3. `distributeItem` (line 274)
4. `returnItem` (line 362)
5. `checkoutCard` (line 433)
6. `unblockCard` (line 471)
7. `deleteCard` lookup (line 680)
8. `deleteCard` delete (line 694)
9. `checkInVolunteer` (line 1469)
10. `checkOutVolunteer` (line 1519)
11. `assignVolunteerCard` (line 1606)
12. `resetVolunteerCard` (line 1626)

### No Database Changes Required
The fix is purely frontend sanitization. No migrations or RPC changes needed.

