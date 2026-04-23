

## Fix: Bulk-uploaded Volunteer QR Cards Show as "Unassigned"

### Root cause

In `supabase/functions/bulk-create-volunteers/index.ts` (lines 617–627), the QR card is inserted into `volunteer_qr_cards` **before** the `pending_volunteers` row is created, and the `volunteer_id` field is never set:

```ts
await supabaseAdmin
  .from('volunteer_qr_cards')
  .insert({
    unique_id: qrCodeId,
    status: 'inactive',
    // ❌ volunteer_id missing
  })
```

Because `VolunteerQRCardsViewer` joins `volunteer_qr_cards.volunteer_id → pending_volunteers(id)` to display the volunteer name, every bulk-created card with a NULL `volunteer_id` renders as "Unassigned".

Confirmed in the live database:
- **117 orphan cards** total (`volunteer_id IS NULL`), all created by this code path
- **37 of them** were created on April 21 alone during the most recent bulk upload
- All real bulk_upload `pending_volunteers` rows DO have a properly-linked card from another path, so the orphans are pure duplicates (one stray per bulk-uploaded volunteer)

### Plan

**1. Code fix** — `supabase/functions/bulk-create-volunteers/index.ts`

Reorder the inserts so `pending_volunteers` is created first, then attach its `id` to the QR card:

```ts
// Insert pending_volunteers FIRST and capture its id
const { data: pvRow, error: pvError } = await supabaseAdmin
  .from('pending_volunteers')
  .insert({ /* same fields as today */ })
  .select('id')
  .single()

// Then create QR card linked to that volunteer + pass marketplace if known
await supabaseAdmin
  .from('volunteer_qr_cards')
  .insert({
    unique_id: qrCodeId,
    status: 'inactive',
    volunteer_id: pvRow?.id ?? null,
    marketplace_id: <resolved marketplace id if any>,
  })
```

This matches the pattern already used in `register-onsite-volunteer` (line 230) and `create-test-volunteers` (line 72), which both link `volunteer_id` correctly.

**2. Data backfill (one-time)** — clean up the 117 existing orphan cards

For every `volunteer_qr_cards` row where `volunteer_id IS NULL` and `status = 'inactive'` (never used), soft-delete it (`deleted_at = now()`). They are duplicates — every bulk-uploaded volunteer already has a properly-linked card, so deleting the orphans is safe. Any orphan that somehow has activity (`status != 'inactive'` or has attendance records) will be skipped and listed for manual review.

Pre-check before delete:
```sql
SELECT COUNT(*) FROM volunteer_qr_cards
WHERE volunteer_id IS NULL AND deleted_at IS NULL AND status != 'inactive';
```

If that returns 0, all 117 are safe to soft-delete.

### Result

- New bulk uploads → cards immediately show the correct volunteer name in the "Volunteer QR Cards" tab.
- Existing 117 stray "Unassigned" entries removed from the list.
- No impact on existing assigned cards, attendance records, or sync flows.

