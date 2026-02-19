

## Fix: Volunteers See "No Marketplace" on Dashboard

### Problem

Many volunteers are reporting they see "No marketplace" on their dashboard. There are two causes:

1. **Published site is outdated**: The fix we already made (looking up marketplace from the full list instead of the filtered list) has not been published yet. Volunteers on completed marketplaces (like "Lea's Marketplace") still can't see the name on the live site.

2. **Some volunteer cards have no marketplace assigned**: Three volunteer cards were checked in before marketplace selection was enforced, so their `marketplace_id` is NULL. No code fix can display a marketplace name that doesn't exist in the data.

### Plan

**Step 1: Data Fix -- Assign missing marketplace IDs**

Run a database update to assign the correct marketplace to the 3 cards with NULL marketplace_id. Based on their check-in dates, they should be assigned to the marketplace that was active at that time (Lea's Marketplace).

**Step 2: Improve the UI fallback display**

Update `VolunteerInterface.tsx` so that instead of showing "No marketplace" when the marketplace can't be found, it shows a more helpful message like "Marketplace assigned" -- confirming the volunteer is checked in even if the name can't be resolved.

**Step 3: Publish**

After both changes, publish the app so the live site at gif.thesurpluss.com gets the updates.

---

### Technical Details

**Database migration**: Update the 3 NULL marketplace_id cards:

```sql
UPDATE volunteer_qr_cards
SET marketplace_id = 'c98b7887-d68a-45b5-914d-814292663092'
WHERE id IN (
  '5c80f281-48e0-4516-9c89-04316c98365d',
  'c6f1778e-5122-42dc-b490-2bb860bdd310',
  '77252019-053e-416e-a862-b57b9d9dd808'
) AND marketplace_id IS NULL;
```

**File change** in `src/components/VolunteerInterface.tsx`:
- Change the fallback text from `'No marketplace'` to `'Marketplace assigned'` so it doesn't alarm volunteers if the name lookup fails for any reason.

