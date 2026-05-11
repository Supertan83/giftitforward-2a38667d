## Root Cause

The local marketplace **"Inclusive Community: Family and People of Determination Marketplace Afternoon Event"** is linked to the wrong Surpluss event.

- Local `external_id` = **28** → Surpluss event titled *"Inclusive Community Family And People Of Determination Marketplace **March 12**"* (a CANCELLED older event with no allocations).
- The correct Surpluss event is **id = 49**, titled *"Inclusive Community: Family and People of Determination Marketplace Afternoon Event"* — this is the one shown in your Tractor screenshot with 30,945 / 65 materials.

That's why the sync fetches `event_id=28` from Tractor and gets 0 allocations back, then reports "Synced 0 allocations".

This wrong link was almost certainly created by the fuzzy auto-linker when both events existed; the older "March 12" cancelled event matched first.

## Fix

One-line data correction:

```sql
UPDATE public.marketplace_events
SET external_id = 49, updated_at = now()
WHERE id = '71792e7c-9f98-4103-bd26-0aec8e5f0ad6';
```

After the migration, click **Sync from Surpluss** again — it will pull the 65 materials from event 49 into the marketplace.

## Sister Marketplace Check

The "Morning Event" counterpart should also be verified — Surpluss has id=41 for *"Inclusive Community: Family and People of Determination Marketplace Morning Event"*. I'll check its current local link in the same migration and correct it if needed.

## Out of Scope

- No code changes to the sync function — its logic is correct, the data link was wrong.
- A separate hardening task (preventing the auto-linker from matching CANCELLED Surpluss events, or preferring exact title matches over fuzzy ones) can be done later if you want; happy to plan that as a follow-up.
