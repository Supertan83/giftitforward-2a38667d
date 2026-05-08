# Why Marilyn & Cecilia show as "Inactive" in Marketplace Reports

## Root cause

Both volunteer QR cards (`VOL-MO0CM7T7-VG2O`, `VOL-MO1HN9MH-LHWF`) were **soft-deleted on 2026-05-06 09:35** (someone clicked "Remove from marketplace" earlier). After that, the cards were scanned again today and got their `status` flipped to `checked_in`, with fresh `volunteer_attendance` rows — but the `deleted_at` timestamp on the card row was never cleared.

The `useMarketplaceReport` hook in `src/hooks/useMarketplaceAllocations.ts` does:

- Fetch `volunteer_qr_cards` with `.is('deleted_at', null)` → these two cards are skipped.
- Filter attendance whose parent card is soft-deleted → today's attendance rows are also skipped.

Because the cards/attendance are skipped, the volunteers don't enter `volCardMap`. They then fall through to the form-registered branch (they're in `events_list` for this marketplace), which assigns `status: 'registered'`. The UI renders anything that isn't `checked_in`/`checked_out` as **"Inactive"**.

So the data is "right" from the report's point of view: it refuses to count a soft-deleted card. The bug is that the check-in flow let a soft-deleted card be scanned without un-deleting it.

## Fix — two parts

### 1. Data fix (immediate, unblocks the user)

Clear `deleted_at` on the two affected cards so today's check-ins are recognized:

```sql
UPDATE volunteer_qr_cards
SET deleted_at = NULL, updated_at = now()
WHERE id IN (
  '196017d9-2c68-415f-8b6b-ce31972346ea',  -- Marilyn Abarca
  '5e54f9a9-ad44-422b-b0d0-11d7630a66e0'   -- Cecilia Arellano
);
```

(Their attendance rows for today are already `deleted_at IS NULL`, so no further data change is needed. The Reports page will show them as "Checked In" on the next refresh.)

### 2. Code fix (prevents this from happening again)

Update the volunteer check-in RPC (`checkin_volunteer_card` / wherever the volunteer scan flow writes `status='checked_in'`) so that when a scanned card is soft-deleted, it **auto-clears `deleted_at`** as part of the check-in. Rationale: if a volunteer is being physically checked in on the field, the card is by definition active again — Reports should not silently hide them.

Concretely, in the same `UPDATE volunteer_qr_cards SET status='checked_in' …` statement used by the check-in RPC, also set `deleted_at = NULL`. No schema change, no RLS change.

## Out of scope

- Changing how "Remove from marketplace" works (it should still soft-delete; the issue is only that the inverse — re-scan — must undo it).
- Backfilling other historically soft-deleted-but-rescanned cards. We can run an audit query separately if you want.
