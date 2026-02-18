

## Batch-Grouped Registered QR Cards

### Overview
Add a batch registration system so that each time cards are registered, they get a shared batch ID. The "Registered" tab will display cards grouped by batch (newest first), with collapsible sections. Each batch can be selected entirely for bulk deletion.

### What Changes

#### 1. Database Migration
Add a `registration_batch` column to the `qr_cards` table:
```sql
ALTER TABLE public.qr_cards 
  ADD COLUMN registration_batch UUID DEFAULT NULL;
```

When cards are registered together, they all share the same batch UUID.

#### 2. Update `addCards` mutation in `useSupabaseData.ts`
- Generate a single `crypto.randomUUID()` as the batch ID
- Pass it to every card in the insert call via the new `registration_batch` column

#### 3. Redesign the "Registered" tab in `QRCodeGenerator.tsx`

**Current:** Flat table of all registered cards with individual checkboxes.

**New:** Cards grouped by batch in collapsible sections:

```text
+--------------------------------------------------+
| Registered Cards (150)                            |
+--------------------------------------------------+
| [v] Batch: Feb 18, 2026 14:30 (50 cards)  [Select All] |
|   [ ] QR-ABC123  inactive  0/15  [Preview][Remove]     |
|   [ ] QR-DEF456  inactive  0/15  [Preview][Remove]     |
|   ...                                                    |
+--------------------------------------------------+
| [v] Batch: Feb 17, 2026 09:15 (100 cards) [Select All] |
|   [ ] QR-GHI789  inactive  0/15  [Preview][Remove]     |
|   ...                                                    |
+--------------------------------------------------+
| [>] Ungrouped (legacy cards)                            |
+--------------------------------------------------+
```

Key behaviors:
- Each batch section is collapsible (using Collapsible component)
- "Select All" per batch selects all cards in that batch
- Top-level "Unregister Selected" button works across batches
- Batches sorted newest first
- Cards without a batch ID (existing/legacy) go into an "Ungrouped" section at the bottom

#### 4. Grouping Logic (frontend)

Group `qrCards` by `registration_batch`:
- Cards with a batch UUID are grouped together
- The batch timestamp is derived from the earliest `created_at` in the group
- Cards with `null` batch go to "Ungrouped"

### Technical Details

**Files modified:**
- Database migration -- add `registration_batch` column
- `src/hooks/useSupabaseData.ts` -- update `addCards` mutation to include batch ID; update `useQRCards` query to include the new column
- `src/components/admin/QRCodeGenerator.tsx` -- redesign the "Registered" tab with batch grouping, collapsible sections, per-batch select-all

**No new dependencies needed** -- already have `@radix-ui/react-collapsible` installed.

**Data model change:**
- `qr_cards.registration_batch` (UUID, nullable) -- null for legacy cards, shared UUID for batch-registered cards

